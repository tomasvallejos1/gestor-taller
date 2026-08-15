-- =============================================================
--  Remito: el documento de entrega
--
--  NO es un comprobante fiscal. No lleva CAE y no se informa a ARCA.
--  Se emite igual con formato de comprobante --letra X en el recuadro,
--  punto de venta y numero correlativo-- por lo mismo que el
--  presupuesto: es lo que el cliente reconoce cuando pasa a retirar, y
--  es lo que despues se convierte en factura sin rehacer nada.
--
--  Dice tres cosas que el presupuesto no puede decir: que el trabajo se
--  hizo, cuanto salio finalmente y con que pago el cliente.
--
--  Sus renglones se precargan del presupuesto pero son PROPIOS y
--  editables. Entre presupuestar y entregar aparece un repuesto que no
--  estaba o se saca uno que no hizo falta; si el remito referenciara los
--  renglones del presupuesto, corregir el presupuesto reescribiria el
--  papel que el cliente ya se llevo firmado.
-- =============================================================

create type public.medio_pago as enum (
  'efectivo', 'transferencia', 'debito', 'credito',
  'cheque', 'cuenta_corriente', 'otro'
);

create sequence public.remito_nro_seq;

create table public.remito (
  id uuid primary key default gen_random_uuid(),

  numero bigint not null default nextval('public.remito_nro_seq'),

  -- Lo completa el trigger desde `configuracion`. Es NOT NULL y aun asi
  -- se puede omitir en el INSERT: los triggers BEFORE corren antes de
  -- que Postgres valide las constraints de columna.
  punto_venta smallint not null,

  -- `restrict` y no `cascade`: una orden que ya se entrego no se borra.
  -- Es la unica FK dura de la tabla, y esta puesta a proposito.
  reparacion_id  uuid not null references public.reparacion(id)  on delete restrict,
  presupuesto_id uuid          references public.presupuesto(id) on delete set null,
  cliente_id     uuid          references public.cliente(id)     on delete set null,

  fecha      date not null default current_date,
  medio_pago public.medio_pago,

  -- Totales mantenidos por trigger, misma formula que el presupuesto.
  subtotal  numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,
  iva_pct   numeric(5,2)  not null default 0,
  total     numeric(12,2) not null default 0,

  notas text,

  -- Datos del receptor congelados al crear, igual que en presupuesto.
  -- Se suma el domicilio: corregir la direccion de un cliente hoy no
  -- puede cambiar el remito que se entrego el mes pasado.
  cliente_nombre           text,
  cliente_documento        text,
  cliente_documento_tipo   public.tipo_documento,
  cliente_condicion_fiscal public.condicion_fiscal,
  cliente_domicilio        text,

  -- Link compartible sin login, mismo criterio que el presupuesto: uuid
  -- aleatorio y no el numero, para que /r/1, /r/2 no recorran todas las
  -- entregas del taller.
  token_publico uuid not null default gen_random_uuid() unique,

  pdf_path text,

  creado_por     uuid references auth.users(id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  -- El par (punto de venta, numero) es lo que identifica al comprobante
  -- en el papel, asi que es lo que tiene que ser unico.
  constraint remito_numero_uk unique (punto_venta, numero),

  -- Una entrega por orden. El dia que haya entregas parciales se cae
  -- esta constraint y se agrega un `parte smallint`; nada mas cambia.
  constraint remito_una_por_orden unique (reparacion_id)
);

create index remito_cliente_idx on public.remito (cliente_id);
create index remito_fecha_idx   on public.remito (fecha desc);

create trigger remito_actualizado
  before update on public.remito
  for each row execute function public.tocar_actualizado_en();


create table public.remito_item (
  id        uuid primary key default gen_random_uuid(),
  remito_id uuid not null references public.remito(id) on delete cascade,
  orden     smallint not null default 0,

  -- Igual que en presupuesto_item: se copia descripcion y precio del
  -- catalogo en vez de referenciarlo. catalogo_item_id queda de rastro.
  catalogo_item_id uuid references public.catalogo_item(id) on delete set null,
  descripcion      text not null,
  cantidad         numeric(10,2) not null default 1,
  precio_unit      numeric(12,2) not null default 0,

  subtotal numeric(12,2)
    generated always as (round(cantidad * precio_unit, 2)) stored,

  constraint remito_item_cantidad_positiva check (cantidad > 0)
);

create index remito_item_remito_idx on public.remito_item (remito_id, orden);


-- ---------- Totales ----------
--
-- Calco de recalcular_total_presupuesto. Se repite en vez de
-- generalizarse en una sola funcion parametrizada por tabla porque la
-- formula tiene que poder divergir --un recargo por medio de pago, por
-- ejemplo-- sin tocar los presupuestos ya emitidos.

create or replace function public.recalcular_total_remito(p_remito_id uuid)
returns void
language sql
as $$
  update public.remito r set
    subtotal = coalesce(
      (select sum(i.subtotal) from public.remito_item i
       where i.remito_id = r.id), 0),
    total = round(
      (coalesce((select sum(i.subtotal) from public.remito_item i
                 where i.remito_id = r.id), 0) - r.descuento)
      * (1 + r.iva_pct / 100), 2)
  where r.id = p_remito_id;
$$;

create or replace function public.trg_remito_item_recalcula()
returns trigger
language plpgsql
as $$
begin
  perform public.recalcular_total_remito(coalesce(new.remito_id, old.remito_id));
  return coalesce(new, old);
end;
$$;

create trigger remito_item_recalcula
  after insert or update or delete on public.remito_item
  for each row execute function public.trg_remito_item_recalcula();

-- Se compara explicitamente para no entrar en recursion: el recalculo
-- escribe sobre remito y volveria a disparar este mismo trigger.
create or replace function public.trg_remito_recalcula()
returns trigger
language plpgsql
as $$
begin
  if new.descuento is distinct from old.descuento
     or new.iva_pct is distinct from old.iva_pct then
    perform public.recalcular_total_remito(new.id);
  end if;
  return new;
end;
$$;

create trigger remito_recalcula
  after update on public.remito
  for each row execute function public.trg_remito_recalcula();


-- ---------- Congelado del receptor ----------
-- Mismo criterio que trg_congelar_cliente_presupuesto: se copia al
-- crear y se vuelve a copiar solo si alguien cambia el cliente a
-- proposito.

create or replace function public.trg_congelar_cliente_remito()
returns trigger
language plpgsql
as $$
declare
  c public.cliente;
begin
  if new.punto_venta is null then
    select punto_venta into new.punto_venta from public.configuracion where id = 1;
    new.punto_venta := coalesce(new.punto_venta, 1);
  end if;

  if new.cliente_id is null then
    -- Si antes tenia cliente y se lo sacaron, no puede quedar el nombre
    -- viejo pegado al documento.
    new.cliente_nombre           := null;
    new.cliente_documento        := null;
    new.cliente_documento_tipo   := null;
    new.cliente_condicion_fiscal := null;
    new.cliente_domicilio        := null;

  elsif old is null or old.cliente_id is distinct from new.cliente_id then
    select * into c from public.cliente where id = new.cliente_id;
    if found then
      new.cliente_nombre           := c.nombre;
      new.cliente_documento        := c.documento;
      new.cliente_documento_tipo   := c.documento_tipo;
      new.cliente_condicion_fiscal := c.condicion_fiscal;
      new.cliente_domicilio        := c.direccion;
    end if;
  end if;

  return new;
end;
$$;

create trigger remito_congela_cliente
  before insert or update on public.remito
  for each row execute function public.trg_congelar_cliente_remito();


-- ---------- Alta desde la reparacion ----------
--
-- Cabecera y renglones tienen que entrar juntos. Si se hicieran en dos
-- llamadas desde el navegador, una que falle a la mitad deja un remito
-- numerado y vacio, y ese numero correlativo ya se consumio.

create or replace function public.crear_remito_desde_reparacion(
  p_reparacion_id  uuid,
  p_presupuesto_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rep  public.reparacion;
  v_pres uuid;
  v_id   uuid;
begin
  select * into v_rep from public.reparacion where id = p_reparacion_id;
  if not found then
    raise exception 'No existe esa orden de reparacion';
  end if;

  if exists (select 1 from public.remito where reparacion_id = p_reparacion_id) then
    raise exception 'La orden #% ya tiene un remito emitido', v_rep.numero;
  end if;

  -- Si no se pasa uno, se toma el presupuesto mas reciente de la orden.
  v_pres := coalesce(p_presupuesto_id, (
    select id from public.presupuesto
    where reparacion_id = p_reparacion_id
    order by creado_en desc
    limit 1
  ));

  insert into public.remito (reparacion_id, presupuesto_id, cliente_id, iva_pct, descuento, creado_por)
  select p_reparacion_id, v_pres, v_rep.cliente_id,
         coalesce(p.iva_pct, 0), coalesce(p.descuento, 0), auth.uid()
  from (select 1) _
  left join public.presupuesto p on p.id = v_pres
  returning id into v_id;

  -- Los renglones se COPIAN. Ver el encabezado del archivo.
  insert into public.remito_item
    (remito_id, orden, catalogo_item_id, descripcion, cantidad, precio_unit)
  select v_id, i.orden, i.catalogo_item_id, i.descripcion, i.cantidad, i.precio_unit
  from public.presupuesto_item i
  where i.presupuesto_id = v_pres
  order by i.orden;

  return v_id;
end;
$$;


-- ---------- RLS ----------
-- Mismo criterio que presupuesto: el remito lleva precios, asi que un
-- lector no lo ve.

alter table public.remito      enable row level security;
alter table public.remito_item enable row level security;

create policy remito_select on public.remito
  for select using (public.es_editor());
create policy remito_escribe on public.remito
  for all using (public.es_editor()) with check (public.es_editor());

create policy remito_item_select on public.remito_item
  for select using (public.es_editor());
create policy remito_item_escribe on public.remito_item
  for all using (public.es_editor()) with check (public.es_editor());


-- ---------- Vista publica del remito ----------
-- Mismo contrato que presupuesto_publico: se busca por token aleatorio,
-- devuelve el documento armado y nada mas.

create or replace function public.remito_publico(p_token uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'numero',      r.numero,
    'comprobante', public.numero_comprobante(r.punto_venta, r.numero),
    'fecha',       r.fecha,
    'medio_pago',  r.medio_pago,
    'subtotal',    r.subtotal,
    'descuento',   r.descuento,
    'iva_pct',     r.iva_pct,
    'total',       r.total,
    'notas',       r.notas,
    -- Lo que se le hizo al motor. El `problema` y el `diagnostico` de la
    -- orden si salen aca: el remito es el papel que se entrega con el
    -- motor y es donde el cliente espera leerlos. Las `notas` internas
    -- de la reparacion no.
    'trabajo', (
      select jsonb_build_object('problema', x.problema, 'diagnostico', x.diagnostico)
      from public.reparacion x where x.id = r.reparacion_id
    ),
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
      'nombre',           r.cliente_nombre,
      'documento',        r.cliente_documento,
      'documento_tipo',   r.cliente_documento_tipo,
      'condicion_fiscal', r.cliente_condicion_fiscal,
      'domicilio',        r.cliente_domicilio
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descripcion', i.descripcion,
        'cantidad',    i.cantidad,
        'precio_unit', i.precio_unit,
        'subtotal',    i.subtotal
      ) order by i.orden)
      from public.remito_item i where i.remito_id = r.id
    ), '[]'::jsonb)
  )
  from public.remito r
  cross join public.configuracion cfg
  where r.token_publico = p_token
    and cfg.id = 1
$$;

grant execute on function public.remito_publico(uuid) to anon, authenticated;


-- ---------- Storage ----------
-- Bucket propio: las policies del bucket `presupuestos` estan atadas a
-- ese nombre y no sirven para otros comprobantes.
--
-- Va con policy de UPDATE ademas de INSERT, que a `presupuestos` le
-- falta: sin ella, un upload con `upsert: true` sobre un PDF que ya
-- existe solo funciona porque corre con la service role.

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

create policy comprobantes_lectura on storage.objects
  for select using (bucket_id = 'comprobantes' and public.es_editor());

create policy comprobantes_escritura on storage.objects
  for insert with check (bucket_id = 'comprobantes' and public.es_editor());

create policy comprobantes_reemplazo on storage.objects
  for update using (bucket_id = 'comprobantes' and public.es_editor());
