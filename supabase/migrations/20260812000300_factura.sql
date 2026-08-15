-- =============================================================
--  Factura electronica autorizada por ARCA (ex AFIP)
--
--  A diferencia del presupuesto y del remito, este comprobante existe
--  tambien fuera de esta base: una vez que ARCA devuelve el CAE, el
--  documento que vale es el que quedo registrado alla. Todo lo que sigue
--  esta ordenado alrededor de esa asimetria.
--
--    - El numero no sale de una sequence local. Lo dicta ARCA
--      (FECompUltimoAutorizado + 1) y se conoce recien en medio de una
--      llamada HTTP. Ver `factura_secuencia` mas abajo.
--    - Una fila con CAE es inmutable. Se anula con nota de credito, no
--      con un UPDATE.
--
--  El taller es monotributista, asi que el default es Factura C
--  (CbteTipo 11), que no discrimina IVA. El modelo soporta A y B por si
--  cambia de categoria, sin migracion.
-- =============================================================

create type public.estado_factura as enum (
  'pendiente', 'autorizada', 'rechazada', 'anulada'
);

create table public.factura (
  id uuid primary key default gen_random_uuid(),

  -- Todos nullables y `on delete set null`, ninguno obligatorio: un
  -- comprobante fiscal autorizado tiene que sobrevivir al borrado de la
  -- orden que lo origino. Lo necesario para reimprimirlo esta congelado
  -- en las columnas de mas abajo.
  reparacion_id uuid references public.reparacion(id) on delete set null,
  remito_id     uuid references public.remito(id)     on delete set null,
  cliente_id    uuid references public.cliente(id)    on delete set null,

  estado public.estado_factura not null default 'pendiente',

  -- ---- Identificacion ante ARCA ----
  cbte_tipo   smallint not null default 11,   -- 11 = Factura C
  punto_venta smallint not null,
  -- NULL hasta el momento de pedir el CAE. Ver el protocolo de emision.
  numero      bigint,
  cbte_fecha  date not null default current_date,

  -- Concepto 2 = servicios. Para 2 y 3 el webservice exige el periodo
  -- servido y el vencimiento de pago; para 1 (productos) van en null.
  concepto   smallint not null default 2,
  serv_desde date,
  serv_hasta date,
  vto_pago   date,

  -- ---- Receptor, congelado ----
  -- doc_tipo/doc_nro son los codigos de ARCA (80 CUIT, 86 CUIL, 96 DNI,
  -- 99 consumidor final con nro 0). Van separados de los del dominio
  -- porque son una tabla de codigos ajena, que puede cambiar sola.
  doc_tipo smallint not null default 99,
  doc_nro  bigint   not null default 0,

  cliente_nombre           text,
  cliente_documento        text,
  cliente_documento_tipo   public.tipo_documento,
  cliente_condicion_fiscal public.condicion_fiscal,
  cliente_domicilio        text,

  -- ---- Importes ----
  moneda     text          not null default 'PES',
  cotizacion numeric(12,6) not null default 1,
  subtotal   numeric(12,2) not null default 0,
  descuento  numeric(12,2) not null default 0,
  iva_pct    numeric(5,2)  not null default 0,
  imp_neto   numeric(12,2) not null default 0,
  imp_iva    numeric(12,2) not null default 0,
  total      numeric(12,2) not null default 0,

  -- ---- Respuesta de ARCA ----
  -- Se guarda entera y no solo el CAE: cuando un comprobante sale
  -- observado, el codigo de la observacion es lo unico que permite
  -- entender que paso sin volver a llamar al webservice.
  cae                text,
  cae_vencimiento    date,
  arca_resultado     char(1),   -- A aprobado / P parcial / R rechazado
  arca_observaciones jsonb,
  arca_errores       jsonb,
  arca_pedido_en     timestamptz,

  token_publico uuid not null default gen_random_uuid() unique,
  pdf_path      text,
  notas         text,

  creado_por     uuid references auth.users(id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint factura_autorizada_completa check (
    estado <> 'autorizada'
    or (cae is not null and cae_vencimiento is not null and numero is not null)
  ),
  constraint factura_servicios_con_periodo check (
    concepto = 1
    or (serv_desde is not null and serv_hasta is not null and vto_pago is not null)
  ),
  constraint factura_periodo_ordenado check (
    serv_hasta is null or serv_desde is null or serv_hasta >= serv_desde
  )
);

-- Ultima linea de defensa contra un numero duplicado, por debajo del
-- turno de emision y del propio chequeo de ARCA. Parcial porque las
-- pendientes todavia no tienen numero.
create unique index factura_numero_uk
  on public.factura (cbte_tipo, punto_venta, numero)
  where numero is not null;

create index factura_reparacion_idx on public.factura (reparacion_id);
create index factura_estado_idx     on public.factura (estado, creado_en desc);

create trigger factura_actualizada
  before update on public.factura
  for each row execute function public.tocar_actualizado_en();


create table public.factura_item (
  id         uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.factura(id) on delete cascade,
  orden      smallint not null default 0,

  catalogo_item_id uuid references public.catalogo_item(id) on delete set null,
  descripcion      text not null,
  cantidad         numeric(10,2) not null default 1,
  precio_unit      numeric(12,2) not null default 0,

  subtotal numeric(12,2)
    generated always as (round(cantidad * precio_unit, 2)) stored,

  constraint factura_item_cantidad_positiva check (cantidad > 0)
);

create index factura_item_factura_idx on public.factura_item (factura_id, orden);

comment on table public.factura_item is
  'Copia congelada de los renglones del remito al momento de emitir. No '
  'es una vista sobre remito_item: editar el remito despues no puede '
  'cambiar un documento que ARCA ya autorizo por un total concreto.';


-- ---------- Inmutabilidad ----------
--
-- Esto es lo unico que esta tabla tiene y las otras dos no.
--
-- ARCA autorizo un importe concreto para un numero concreto. Editar la
-- fila despues no cambia lo que quedo registrado alla: solo logra que el
-- PDF que se reimprime deje de coincidir con la declaracion jurada.

create or replace function public.trg_factura_inmutable()
returns trigger
language plpgsql
as $$
begin
  if old.cae is null then return new; end if;

  -- Se comparan las filas enteras menos lo que si puede moverse despues
  -- de autorizada. Comparar campo por campo obligaria a acordarse de
  -- sumar cada columna nueva a la lista, y la que se olvide queda
  -- editable en silencio.
  if to_jsonb(new) - 'pdf_path' - 'actualizado_en' - 'estado'
     is distinct from
     to_jsonb(old) - 'pdf_path' - 'actualizado_en' - 'estado'
  then
    raise exception
      'La factura % ya tiene CAE y no se puede modificar. Se anula con una nota de credito.',
      public.numero_comprobante(old.punto_venta, old.numero);
  end if;

  if new.estado not in ('autorizada', 'anulada') then
    raise exception 'Una factura con CAE no puede volver al estado %', new.estado;
  end if;

  return new;
end;
$$;

create trigger factura_inmutable
  before update on public.factura
  for each row execute function public.trg_factura_inmutable();


create or replace function public.trg_factura_no_se_borra()
returns trigger
language plpgsql
as $$
begin
  if old.cae is not null then
    raise exception 'La factura % esta autorizada por ARCA: no se borra.',
      public.numero_comprobante(old.punto_venta, old.numero);
  end if;
  return old;
end;
$$;

create trigger factura_no_se_borra
  before delete on public.factura
  for each row execute function public.trg_factura_no_se_borra();


create or replace function public.trg_factura_item_inmutable()
returns trigger
language plpgsql
as $$
declare
  v_cae text;
begin
  select cae into v_cae from public.factura
  where id = coalesce(new.factura_id, old.factura_id);

  if v_cae is not null then
    raise exception 'No se pueden tocar los renglones de una factura ya autorizada.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger factura_item_inmutable
  before insert or update or delete on public.factura_item
  for each row execute function public.trg_factura_item_inmutable();


-- ---------- Totales ----------

create or replace function public.recalcular_total_factura(p_factura_id uuid)
returns void
language sql
as $$
  with s as (
    select coalesce(sum(i.subtotal), 0) as bruto
    from public.factura_item i where i.factura_id = p_factura_id
  )
  update public.factura f set
    subtotal = s.bruto,
    total    = round((s.bruto - f.descuento) * (1 + f.iva_pct / 100), 2),
    -- La Factura C no discrimina IVA: para ARCA el total va entero en
    -- ImpNeto e ImpIVA queda en cero. Mandar ImpIVA > 0 en una C es
    -- rechazo directo del webservice.
    imp_iva = case when f.cbte_tipo in (11, 12, 13) then 0
                   else round((s.bruto - f.descuento) * (f.iva_pct / 100), 2) end,
    imp_neto = case when f.cbte_tipo in (11, 12, 13)
                    then round((s.bruto - f.descuento) * (1 + f.iva_pct / 100), 2)
                    else round(s.bruto - f.descuento, 2) end
  from s
  where f.id = p_factura_id
    and f.cae is null;   -- una autorizada no se recalcula nunca
$$;

create or replace function public.trg_factura_item_recalcula()
returns trigger
language plpgsql
as $$
begin
  perform public.recalcular_total_factura(coalesce(new.factura_id, old.factura_id));
  return coalesce(new, old);
end;
$$;

create trigger factura_item_recalcula
  after insert or update or delete on public.factura_item
  for each row execute function public.trg_factura_item_recalcula();

create or replace function public.trg_factura_recalcula()
returns trigger
language plpgsql
as $$
begin
  if new.descuento is distinct from old.descuento
     or new.iva_pct is distinct from old.iva_pct
     or new.cbte_tipo is distinct from old.cbte_tipo then
    perform public.recalcular_total_factura(new.id);
  end if;
  return new;
end;
$$;

create trigger factura_recalcula
  after update on public.factura
  for each row execute function public.trg_factura_recalcula();


-- ---------- Congelado del receptor y traduccion a codigos de ARCA ----------

create or replace function public.trg_congelar_cliente_factura()
returns trigger
language plpgsql
as $$
declare
  c public.cliente;
begin
  -- Una vez autorizada no se toca nada, ni siquiera para "mejorar" los
  -- datos del receptor: son parte de lo que se declaro.
  if new.cae is not null then return new; end if;

  if new.punto_venta is null then
    select punto_venta into new.punto_venta from public.configuracion where id = 1;
    new.punto_venta := coalesce(new.punto_venta, 1);
  end if;

  if new.cliente_id is not null
     and (old is null or old.cliente_id is distinct from new.cliente_id) then
    select * into c from public.cliente where id = new.cliente_id;
    if found then
      new.cliente_nombre           := c.nombre;
      new.cliente_documento        := c.documento;
      new.cliente_documento_tipo   := c.documento_tipo;
      new.cliente_condicion_fiscal := c.condicion_fiscal;
      new.cliente_domicilio        := c.direccion;
    end if;
  end if;

  new.doc_tipo := case new.cliente_documento_tipo
                    when 'cuit' then 80
                    when 'cuil' then 86
                    when 'dni'  then 96
                    else 99
                  end;
  new.doc_nro := coalesce(
    nullif(regexp_replace(coalesce(new.cliente_documento, ''), '\D', '', 'g'), '')::bigint,
    0);

  -- Sin documento cargado es consumidor final, que es lo correcto y no
  -- un error: el taller factura al mostrador todos los dias.
  if new.doc_nro = 0 then new.doc_tipo := 99; end if;

  return new;
end;
$$;

create trigger factura_congela_cliente
  before insert or update on public.factura
  for each row execute function public.trg_congelar_cliente_factura();


-- =============================================================
--  Turno de emision
--
--  El numero de una factura lo dicta ARCA. Como se averigua en medio de
--  una llamada HTTP, no hay transaccion que pueda abarcar todo el
--  proceso, y un pg_advisory_xact_lock se soltaria antes de que ARCA
--  conteste.
--
--  En su lugar, una fila con un turno que se toma y se devuelve. El
--  UPDATE condicional serializa: solo uno gana.
--
--  Ojo con que garantiza esto y que no. La unicidad la garantiza ARCA,
--  que rechaza con error 10016 cualquier numero que no sea el siguiente.
--  El turno existe para no quemar intentos, y `ultimo_numero` para poder
--  detectar un desfasaje entre lo que creemos y lo que ARCA tiene.
-- =============================================================

create table public.factura_secuencia (
  cbte_tipo     smallint not null,
  punto_venta   smallint not null,
  ultimo_numero bigint   not null default 0,  -- ultimo CONFIRMADO por ARCA

  emision_en_curso uuid references public.factura(id) on delete set null,
  tomado_en        timestamptz,

  primary key (cbte_tipo, punto_venta)
);

-- Sin policies a proposito: solo la Edge Function (service_role) la toca.
alter table public.factura_secuencia enable row level security;


create or replace function public.tomar_turno_factura(
  p_factura_id  uuid,
  p_cbte_tipo   smallint,
  p_punto_venta smallint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ultimo bigint;
begin
  insert into public.factura_secuencia (cbte_tipo, punto_venta)
  values (p_cbte_tipo, p_punto_venta)
  on conflict do nothing;

  -- El turno vencido a los 90 segundos cubre a la Edge Function que se
  -- murio en el medio: sin eso, un timeout dejaria el punto de venta
  -- trabado para siempre y habria que destrabarlo a mano en la consola.
  update public.factura_secuencia s
     set emision_en_curso = p_factura_id,
         tomado_en        = now()
   where s.cbte_tipo   = p_cbte_tipo
     and s.punto_venta = p_punto_venta
     and (s.emision_en_curso is null
          or s.emision_en_curso = p_factura_id          -- reintento del mismo
          or s.tomado_en < now() - interval '90 seconds')
  returning s.ultimo_numero into v_ultimo;

  if not found then
    raise exception
      'Hay otra factura emitiendose en el punto de venta %. Espera unos segundos y reintenta.',
      p_punto_venta
      using errcode = '55006';
  end if;

  return v_ultimo;
end;
$$;

revoke execute on function public.tomar_turno_factura(uuid, smallint, smallint)
  from public, anon, authenticated;


-- El numero se escribe ANTES de pedir el CAE. Es lo que hace que un
-- fallo entre medio sea recuperable: si ARCA autorizo y la escritura
-- posterior fallo, queda una fila pendiente CON numero, y
-- factura-reconciliar puede preguntarle a ARCA por ese numero exacto.
-- Sin esto, no habria a que preguntarle.
create or replace function public.anotar_intento_factura(
  p_factura_id uuid,
  p_numero     bigint,
  p_cbte_fecha date
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.factura
     set numero = p_numero, cbte_fecha = p_cbte_fecha, arca_pedido_en = now()
   where id = p_factura_id and cae is null;
$$;

revoke execute on function public.anotar_intento_factura(uuid, bigint, date)
  from public, anon, authenticated;


create or replace function public.confirmar_factura(
  p_factura_id uuid,
  p_cae        text,
  p_cae_vto    date,
  p_obs        jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.factura;
begin
  update public.factura
     set cae = p_cae, cae_vencimiento = p_cae_vto,
         estado = 'autorizada', arca_resultado = 'A', arca_observaciones = p_obs
   where id = p_factura_id and cae is null
  returning * into f;

  -- Idempotente: reconciliar dos veces la misma factura no hace nada la
  -- segunda vez, en vez de pisar el CAE o volver a mover la secuencia.
  if not found then return; end if;

  update public.factura_secuencia
     set ultimo_numero    = greatest(ultimo_numero, f.numero),
         emision_en_curso = null,
         tomado_en        = null
   where cbte_tipo = f.cbte_tipo and punto_venta = f.punto_venta;
end;
$$;

revoke execute on function public.confirmar_factura(uuid, text, date, jsonb)
  from public, anon, authenticated;


create or replace function public.rechazar_factura(
  p_factura_id uuid,
  p_errores    jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.factura;
begin
  update public.factura
     set estado = 'rechazada', arca_resultado = 'R', arca_errores = p_errores,
         -- El numero no se consumio: ARCA no lo autorizo, asi que sigue
         -- siendo el proximo disponible para el intento siguiente.
         numero = null
   where id = p_factura_id and cae is null
  returning * into f;

  if found then
    update public.factura_secuencia
       set emision_en_curso = null, tomado_en = null
     where cbte_tipo = f.cbte_tipo and punto_venta = f.punto_venta;
  end if;
end;
$$;

revoke execute on function public.rechazar_factura(uuid, jsonb)
  from public, anon, authenticated;


-- ---------- Alta desde el remito ----------

create or replace function public.crear_factura_desde_remito(p_remito_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  r    public.remito;
  v_id uuid;
begin
  select * into r from public.remito where id = p_remito_id;
  if not found then
    raise exception 'No existe ese remito';
  end if;

  if exists (
    select 1 from public.factura
    where remito_id = p_remito_id and estado in ('pendiente', 'autorizada')
  ) then
    raise exception 'Ese remito ya tiene una factura en curso o autorizada';
  end if;

  insert into public.factura (
    reparacion_id, remito_id, cliente_id,
    cbte_tipo, punto_venta, concepto,
    serv_desde, serv_hasta, vto_pago,
    descuento, iva_pct, creado_por
  )
  values (
    r.reparacion_id, r.id, r.cliente_id,
    -- Factura C mientras el emisor sea monotributista. Si algun dia pasa
    -- a responsable inscripto esto se decide por la condicion del
    -- receptor (A si esta inscripto, B si no).
    case (select condicion_fiscal from public.configuracion where id = 1)
      when 'responsable_inscripto' then
        case when r.cliente_condicion_fiscal = 'responsable_inscripto' then 1 else 6 end
      else 11
    end,
    r.punto_venta,
    2,                                  -- servicios
    r.fecha, r.fecha, r.fecha,
    r.descuento, r.iva_pct, auth.uid()
  )
  returning id into v_id;

  insert into public.factura_item
    (factura_id, orden, catalogo_item_id, descripcion, cantidad, precio_unit)
  select v_id, i.orden, i.catalogo_item_id, i.descripcion, i.cantidad, i.precio_unit
  from public.remito_item i
  where i.remito_id = p_remito_id
  order by i.orden;

  return v_id;
end;
$$;


-- ---------- Cache del ticket de acceso de ARCA ----------
--
-- El TA vale unas 12 horas y pedir otro mientras el anterior sigue vivo
-- hace que AFIP conteste "El CEE ya posee un TA valido". Se guarda y se
-- renueva recien cuando esta por vencer.

create table public.arca_token (
  servicio       text primary key default 'wsfe',
  token          text not null,
  sign           text not null,
  expira_en      timestamptz not null,
  actualizado_en timestamptz not null default now()
);

-- Sin policies: ni un super lo lee desde el navegador.
alter table public.arca_token enable row level security;


-- ---------- RLS ----------

alter table public.factura      enable row level security;
alter table public.factura_item enable row level security;

create policy factura_select on public.factura
  for select using (public.es_editor());

-- Lo que impide tocar una factura autorizada es el trigger, no la
-- policy: RLS no puede mirar el valor viejo de la fila, asi que no tiene
-- forma de distinguir "editar un borrador" de "editar una con CAE".
create policy factura_escribe on public.factura
  for all using (public.es_editor()) with check (public.es_editor());

create policy factura_item_select on public.factura_item
  for select using (public.es_editor());
create policy factura_item_escribe on public.factura_item
  for all using (public.es_editor()) with check (public.es_editor());


-- ---------- Vista publica de la factura ----------
-- Se comparte solo por envio explicito, nunca desde /estado: lleva el
-- documento del receptor y el CAE, y un numero de orden mas un apellido
-- adivinable es una puerta demasiado debil para eso.

create or replace function public.factura_publica(p_token uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'numero',          f.numero,
    'comprobante',     public.numero_comprobante(f.punto_venta, f.numero),
    'cbte_tipo',       f.cbte_tipo,
    'fecha',           f.cbte_fecha,
    'subtotal',        f.subtotal,
    'descuento',       f.descuento,
    'iva_pct',         f.iva_pct,
    'imp_neto',        f.imp_neto,
    'imp_iva',         f.imp_iva,
    'total',           f.total,
    'cae',             f.cae,
    'cae_vencimiento', f.cae_vencimiento,
    'notas',           f.notas,
    'emisor', jsonb_build_object(
      'razon_social',     cfg.razon_social,
      'nombre_fantasia',  cfg.nombre_fantasia,
      'cuit',             cfg.cuit,
      'domicilio',        cfg.domicilio,
      'localidad',        cfg.localidad,
      'telefono',         cfg.telefono,
      'email',            cfg.email,
      'condicion_fiscal', cfg.condicion_fiscal
    ),
    'cliente', jsonb_build_object(
      'nombre',           f.cliente_nombre,
      'documento',        f.cliente_documento,
      'documento_tipo',   f.cliente_documento_tipo,
      'condicion_fiscal', f.cliente_condicion_fiscal,
      'domicilio',        f.cliente_domicilio
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descripcion', i.descripcion,
        'cantidad',    i.cantidad,
        'precio_unit', i.precio_unit,
        'subtotal',    i.subtotal
      ) order by i.orden)
      from public.factura_item i where i.factura_id = f.id
    ), '[]'::jsonb)
  )
  from public.factura f
  cross join public.configuracion cfg
  where f.token_publico = p_token
    and cfg.id = 1
    -- Una pendiente o una rechazada no es un comprobante: no se muestra.
    and f.estado = 'autorizada'
$$;

grant execute on function public.factura_publica(uuid) to anon, authenticated;
