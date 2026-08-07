-- =============================================================
--  Extraccion de fichas por foto + modulo de presupuestos
-- =============================================================


-- ---------- Extraccion de fichas ----------
--
-- Una fila por foto subida. Sobrevive al ciclo de vida de la request
-- porque el flujo es asincronico y con revision humana en el medio:
--
--   pendiente -> procesando -> revision -> [persona confirma] -> confirmada
--                                       \-> error
--
-- El estado `revision` es el punto clave: el sistema NUNCA escribe un
-- motor directo desde la extraccion. Una ficha de bobinado mal cargada
-- significa un motor rebobinado mal, que es perdida material concreta.

create type public.estado_extraccion as enum (
  'pendiente', 'procesando', 'revision', 'confirmada', 'error'
);

create type public.origen_extraccion as enum ('web', 'telegram');

create table public.ficha_extraccion (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null,
  estado       public.estado_extraccion not null default 'pendiente',
  origen       public.origen_extraccion not null default 'web',

  -- Resultado crudo del modelo. Cada campo es un objeto de tres partes:
  --   { "valor": 1450, "confianza": "alta", "texto_fuente": "1450 RPM" }
  --
  -- `texto_fuente` es lo que hace auditable la extraccion: quien revisa
  -- ve QUE LEYO el modelo, no solo que dedujo. Sin eso, verificar un campo
  -- dudoso obliga a volver a la foto y buscarlo a ojo.
  datos_json jsonb,

  -- Se completa al confirmar. Deja la trazabilidad foto -> ficha.
  motor_id uuid references public.motor(id) on delete set null,

  -- Consumo real, para medir el costo en vez de estimarlo.
  tokens_in  integer,
  tokens_out integer,

  error text,

  creado_por     uuid references auth.users(id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index ficha_extraccion_estado_idx
  on public.ficha_extraccion (estado, creado_en desc);
create index ficha_extraccion_usuario_idx
  on public.ficha_extraccion (creado_por, creado_en desc);

create trigger ficha_extraccion_actualizada
  before update on public.ficha_extraccion
  for each row execute function public.tocar_actualizado_en();

-- Freno de costo. Sin techo, un bucle o un usuario entusiasta generan una
-- factura sorpresa de la API. El limite se chequea antes de encolar.
create or replace function public.extracciones_hoy(p_usuario uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.ficha_extraccion
  where creado_por = p_usuario
    and creado_en >= date_trunc('day', now())
$$;


-- ---------- Catalogo de precios ----------

create table public.catalogo_item (
  id             uuid primary key default gen_random_uuid(),
  codigo         text unique,
  descripcion    text not null,
  precio         numeric(12,2) not null default 0,
  unidad         text not null default 'u',
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index catalogo_item_desc_trgm
  on public.catalogo_item using gin (descripcion gin_trgm_ops);

create trigger catalogo_item_actualizado
  before update on public.catalogo_item
  for each row execute function public.tocar_actualizado_en();


-- ---------- Presupuestos ----------

create type public.estado_presupuesto as enum (
  'borrador', 'enviado', 'aceptado', 'rechazado', 'vencido'
);

create sequence public.presupuesto_nro_seq;

create table public.presupuesto (
  id     uuid primary key default gen_random_uuid(),
  numero bigint not null unique default nextval('public.presupuesto_nro_seq'),

  cliente_id    uuid references public.cliente(id) on delete set null,
  reparacion_id uuid references public.reparacion(id) on delete set null,

  estado public.estado_presupuesto not null default 'borrador',

  -- Totales mantenidos por trigger. Calcularlos en la aplicacion
  -- garantiza que la web y el bot se desincronicen en cuanto uno de los
  -- dos cambie de formula.
  subtotal  numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,

  -- Default 0 = no se discrimina IVA (monotributo). Si el taller pasa a
  -- responsable inscripto, se setea la alicuota y el PDF la muestra: el
  -- modelo ya lo soporta sin migracion.
  iva_pct numeric(5,2) not null default 0,
  total   numeric(12,2) not null default 0,

  vigencia_dias smallint not null default 15,
  notas         text,

  -- Link compartible por WhatsApp sin login. Es un uuid aleatorio, no el
  -- id del presupuesto: enumerar /p/<uuid> no revela cuantos hay ni
  -- permite adivinar el siguiente.
  token_publico uuid not null default gen_random_uuid() unique,

  pdf_path text,

  creado_por     uuid references auth.users(id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index presupuesto_cliente_idx on public.presupuesto (cliente_id);
create index presupuesto_estado_idx  on public.presupuesto (estado, creado_en desc);

create trigger presupuesto_actualizado
  before update on public.presupuesto
  for each row execute function public.tocar_actualizado_en();


create table public.presupuesto_item (
  id             uuid primary key default gen_random_uuid(),
  presupuesto_id uuid not null references public.presupuesto(id) on delete cascade,
  orden          smallint not null default 0,

  -- Se copia la descripcion y el precio del catalogo en vez de referenciarlo:
  -- un presupuesto ya enviado no puede cambiar de monto porque alguien
  -- actualizo la lista de precios. catalogo_item_id queda solo como rastro.
  catalogo_item_id uuid references public.catalogo_item(id) on delete set null,
  descripcion      text not null,
  cantidad         numeric(10,2) not null default 1,
  precio_unit      numeric(12,2) not null default 0,

  subtotal numeric(12,2)
    generated always as (round(cantidad * precio_unit, 2)) stored,

  constraint cantidad_positiva check (cantidad > 0)
);

create index presupuesto_item_presupuesto_idx
  on public.presupuesto_item (presupuesto_id, orden);


-- ---------- Totales ----------

create or replace function public.recalcular_total_presupuesto(p_presupuesto_id uuid)
returns void
language sql
as $$
  update public.presupuesto p set
    subtotal = coalesce(
      (select sum(i.subtotal) from public.presupuesto_item i
       where i.presupuesto_id = p.id), 0),
    total = round(
      (coalesce((select sum(i.subtotal) from public.presupuesto_item i
                 where i.presupuesto_id = p.id), 0) - p.descuento)
      * (1 + p.iva_pct / 100), 2)
  where p.id = p_presupuesto_id;
$$;

create or replace function public.trg_item_recalcula_total()
returns trigger
language plpgsql
as $$
begin
  perform public.recalcular_total_presupuesto(
    coalesce(new.presupuesto_id, old.presupuesto_id));
  return coalesce(new, old);
end;
$$;

create trigger presupuesto_item_recalcula
  after insert or update or delete on public.presupuesto_item
  for each row execute function public.trg_item_recalcula_total();

-- Cambiar el descuento o la alicuota tambien tiene que recalcular.
-- Se compara explicitamente para no entrar en recursion: el propio
-- recalculo escribe sobre presupuesto y volveria a disparar el trigger.
create or replace function public.trg_presupuesto_recalcula()
returns trigger
language plpgsql
as $$
begin
  if new.descuento is distinct from old.descuento
     or new.iva_pct is distinct from old.iva_pct then
    perform public.recalcular_total_presupuesto(new.id);
  end if;
  return new;
end;
$$;

create trigger presupuesto_recalcula
  after update on public.presupuesto
  for each row execute function public.trg_presupuesto_recalcula();
