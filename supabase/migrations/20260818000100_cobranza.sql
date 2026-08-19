-- =============================================================
--  Cobranza de una orden: cuanto vale, cuanto se cobro, que falta
--
--  Hasta aca el sistema sabia hacer el trabajo y emitir los
--  papeles, pero no sabia si el trabajo se cobro. El unico rastro
--  era `remito.medio_pago`, un campo suelto del documento que no
--  dice cuanto ni cuando, y que no existe si el motor se entrego
--  sin remito.
--
--  Dos tablas:
--
--    pago      - cada cobro que entra. Parcial o total, con su
--                medio y su fecha. Es un libro: se agrega, no se
--                corrige.
--    cobranza  - el resumen por orden, mantenido por trigger.
--                Existe para que el listado pueda pedir "las
--                entregadas que deben plata" en una sola consulta
--                en vez de traer todo y sumar en el navegador.
--
--  Por que `cobranza` es una tabla aparte y no cuatro columnas en
--  `reparacion`: por las RLS. Un `lector` ve las reparaciones
--  --las necesita para trabajar-- pero no ve precios. Si los
--  importes vivieran en `reparacion`, cualquier consulta suya los
--  traeria. Aca la tabla entera es de editores, y al lector la
--  relacion embebida le vuelve vacia, igual que ya le pasa con
--  presupuesto, remito y factura.
--
--  ---------------------------------------------------------
--  El recargo de tarjeta
--
--  Un pago tiene dos numeros distintos y confundirlos rompe la
--  contabilidad del taller:
--
--    monto   - lo que se le descuenta a la deuda del cliente
--    cobrado - lo que el cliente entrega de verdad
--
--  Con efectivo son el mismo numero. Con tarjeta no: sobre una
--  deuda de $100.000 al 15%, el cliente paga $115.000 y la deuda
--  queda en cero. Si se guardara un solo numero habria que elegir
--  entre "quedo debiendo $15.000" (falso) o "el trabajo salio
--  $115.000" (tambien falso: el recargo es del servicio de cobro,
--  no del trabajo). Por eso se guarda `monto` y el porcentaje, y
--  `cobrado` sale de los dos.
-- =============================================================


-- ---------- El libro de pagos ----------

create table public.pago (
  id uuid primary key default gen_random_uuid(),

  -- cascade: los pagos son parte de la orden, no viven sin ella.
  -- Borrar una orden ya cobrada igual es dificil: si tiene remito,
  -- la FK de `remito` lo impide primero.
  reparacion_id uuid not null references public.reparacion(id) on delete cascade,

  fecha date not null default current_date,
  medio public.medio_pago not null,

  -- Lo que se imputa a la deuda. Ver el encabezado del archivo.
  monto numeric(12,2) not null,

  -- Recargo de servicio, en porcentaje. Por defecto 0: solo la
  -- tarjeta lo lleva, y la interfaz lo propone en 15 pudiendose
  -- cambiar en el momento de cobrar --hay clientes con acuerdo y
  -- promociones que lo bajan--.
  recargo_pct numeric(5,2) not null default 0,

  recargo numeric(12,2)
    generated always as (round(monto * recargo_pct / 100, 2)) stored,

  -- Lo que entra a la caja.
  cobrado numeric(12,2)
    generated always as (monto + round(monto * recargo_pct / 100, 2)) stored,

  nota text,

  creado_por uuid references auth.users(id) on delete set null,
  creado_en  timestamptz not null default now(),

  constraint pago_monto_positivo  check (monto > 0),
  constraint pago_recargo_valido  check (recargo_pct >= 0 and recargo_pct <= 100)
);

create index pago_reparacion_idx on public.pago (reparacion_id, fecha desc);

comment on column public.pago.monto is
  'Lo que se descuenta de la deuda. Con tarjeta NO es lo que paga el '
  'cliente: eso es `cobrado`, que le suma el recargo de servicio.';


-- ---------- El resumen por orden ----------

create table public.cobranza (
  reparacion_id uuid primary key
    references public.reparacion(id) on delete cascade,

  -- Puesto a mano. Manda sobre el documento: si alguien escribio un
  -- importe es porque sabe algo que el papel no dice --un trabajo
  -- que se cobra sin presupuesto, un arreglo de ultimo momento--.
  importe numeric(12,2),

  -- Sale del remito, y si no hay remito del ultimo presupuesto. Lo
  -- mantiene el trigger de mas abajo.
  importe_doc numeric(12,2),

  pagado  numeric(12,2) not null default 0,  -- suma de monto
  cobrado numeric(12,2) not null default 0,  -- suma de monto + recargo

  total numeric(12,2)
    generated always as (coalesce(importe, importe_doc)) stored,

  saldo numeric(12,2)
    generated always as (coalesce(importe, importe_doc, 0) - pagado) stored,

  -- Se calcula aca y no en el navegador para poder filtrar por el.
  -- "Mostrame las entregadas que deben plata" tiene que ser una
  -- consulta, no un recorrido de las 100 filas que se bajaron.
  --
  -- `sin_importe` no es lo mismo que `impago`: una orden que todavia
  -- no tiene ni presupuesto no debe nada, no hay con que compararla.
  -- Distinguirlas es lo que evita que la pantalla marque en rojo
  -- media lista de ordenes que recien entraron.
  estado text
    generated always as (
      case
        when coalesce(importe, importe_doc, 0) <= 0
          then (case when pagado > 0 then 'pagado' else 'sin_importe' end)
        when pagado <= 0 then 'impago'
        when pagado >= coalesce(importe, importe_doc, 0) then 'pagado'
        else 'parcial'
      end
    ) stored,

  actualizado_en timestamptz not null default now(),

  constraint cobranza_importe_no_negativo check (importe is null or importe >= 0)
);

-- El filtro que se usa todos los dias: quien debe.
create index cobranza_estado_idx on public.cobranza (estado);

comment on table public.cobranza is
  'Resumen de cobranza por orden. Todo lo que no sea `importe` lo '
  'mantienen triggers: no se escribe a mano desde la aplicacion.';


-- ---------- Recalculo ----------
--
-- Una sola funcion para las cuatro fuentes que pueden moverlo (un
-- pago, el remito, el presupuesto, o una orden nueva). Es un upsert
-- para que la fila exista siempre: la interfaz da por hecho que
-- puede escribir `importe` sin crearla antes.

create or replace function public.recalcular_cobranza(p_reparacion_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.cobranza (reparacion_id, importe_doc, pagado, cobrado, actualizado_en)
  select
    p_reparacion_id,
    -- El remito es el numero final --se emite con el motor ya
    -- terminado-- y por eso le gana al presupuesto, que es una
    -- estimacion hecha antes de abrir el motor.
    coalesce(
      (select r.total from public.remito r
       where r.reparacion_id = p_reparacion_id
       order by r.creado_en desc limit 1),
      (select p.total from public.presupuesto p
       where p.reparacion_id = p_reparacion_id
       order by p.creado_en desc limit 1)
    ),
    coalesce((select sum(g.monto)   from public.pago g
              where g.reparacion_id = p_reparacion_id), 0),
    coalesce((select sum(g.cobrado) from public.pago g
              where g.reparacion_id = p_reparacion_id), 0),
    now()
  on conflict (reparacion_id) do update set
    importe_doc    = excluded.importe_doc,
    pagado         = excluded.pagado,
    cobrado        = excluded.cobrado,
    actualizado_en = now();
$$;


-- Los documentos y los pagos avisan igual; lo unico que cambia es de
-- donde sacan la orden. En un UPDATE que mueve la fila de una orden a
-- otra hay que recalcular las dos.
--
-- Las ramas estan separadas por operacion a proposito: en un trigger
-- de INSERT la variable OLD no esta asignada y leerle un campo
-- --aunque sea adentro de un `and` que ya dio falso-- aborta la
-- sentencia.
create or replace function public.trg_recalcula_cobranza()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.reparacion_id is not null then
      perform public.recalcular_cobranza(new.reparacion_id);
    end if;

  elsif tg_op = 'DELETE' then
    if old.reparacion_id is not null then
      perform public.recalcular_cobranza(old.reparacion_id);
    end if;

  else
    if old.reparacion_id is not null then
      perform public.recalcular_cobranza(old.reparacion_id);
    end if;
    if new.reparacion_id is not null
       and new.reparacion_id is distinct from old.reparacion_id then
      perform public.recalcular_cobranza(new.reparacion_id);
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger pago_recalcula_cobranza
  after insert or update or delete on public.pago
  for each row execute function public.trg_recalcula_cobranza();

-- El total del remito y el del presupuesto los reescriben sus propios
-- triggers cuando cambia un renglon, asi que escuchar el UPDATE de la
-- cabecera alcanza para enterarse de todo.
create trigger remito_recalcula_cobranza
  after insert or update or delete on public.remito
  for each row execute function public.trg_recalcula_cobranza();

create trigger presupuesto_recalcula_cobranza
  after insert or update or delete on public.presupuesto
  for each row execute function public.trg_recalcula_cobranza();


-- La orden nueva nace con su fila, en cero.
create or replace function public.trg_reparacion_abre_cobranza()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.recalcular_cobranza(new.id);
  return new;
end;
$$;

create trigger reparacion_abre_cobranza
  after insert on public.reparacion
  for each row execute function public.trg_reparacion_abre_cobranza();


-- ---------- RLS ----------
-- Mismo criterio que presupuesto y remito: son importes, no los ve un
-- lector.

alter table public.pago     enable row level security;
alter table public.cobranza enable row level security;

create policy pago_select on public.pago
  for select using (public.es_editor());
create policy pago_escribe on public.pago
  for all using (public.es_editor()) with check (public.es_editor());

create policy cobranza_select on public.cobranza
  for select using (public.es_editor());
create policy cobranza_escribe on public.cobranza
  for all using (public.es_editor()) with check (public.es_editor());


-- ---------- Ordenes que ya existian ----------
--
-- Se les arma la fila con lo que se pueda deducir de sus documentos.
-- NO se les inventa ningun pago: `remito.medio_pago` dice con que
-- pago el cliente pero no cuanto ni cuando, y anotar un cobro que
-- nadie registro es escribir plata que quiza nunca entro. Las ordenes
-- viejas ya entregadas van a aparecer como impagas hasta que alguien
-- les cargue el pago, que es exactamente lo que la pantalla nueva
-- viene a resolver.

insert into public.cobranza (reparacion_id)
select id from public.reparacion
on conflict (reparacion_id) do nothing;

do $$
declare
  v_id uuid;
begin
  for v_id in select reparacion_id from public.cobranza loop
    perform public.recalcular_cobranza(v_id);
  end loop;
end;
$$;
