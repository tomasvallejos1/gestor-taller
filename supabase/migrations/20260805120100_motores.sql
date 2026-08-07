-- =============================================================
--  Dominio principal: clientes, motores, bobinados, reparaciones
--
--  El modelo sale de analizar 3 fichas de papel reales del taller.
--  Cada decision que se aparta del schema viejo esta comentada con la
--  evidencia concreta que la motivo.
-- =============================================================


-- ---------- Clientes ----------

create table public.cliente (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  telefono       text,
  email          text,
  direccion      text,
  notas          text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Indice trigram: habilita "buscar clientes parecidos a X" con similarity().
-- Lo usa el alta desde Telegram para no crear "Juan Perez" tres veces con
-- tipeos distintos.
create index cliente_nombre_trgm on public.cliente using gin (nombre gin_trgm_ops);

create trigger cliente_actualizado
  before update on public.cliente
  for each row execute function public.tocar_actualizado_en();


-- ---------- Motor ----------

create type public.tipo_electrico as enum
  ('monofasico', 'trifasico', 'continua', 'otro');

-- Identificador humano del motor ("ficha N° 42"). Reemplaza la coleccion
-- `counters` de Mongo y su hook pre('save'), que producia duplicados por
-- doble submit y perdia el numero en los updates (el hook no corria en
-- findOneAndUpdate). Una SEQUENCE es atomica y transaccional por diseño.
create sequence public.motor_nro_seq;

create table public.motor (
  id          uuid primary key default gen_random_uuid(),
  nro_motor   bigint not null unique default nextval('public.motor_nro_seq'),

  -- Identificacion.
  -- `descripcion` es el campo obligatorio, no `marca`: las fichas A y B
  -- dicen "MOTOR BATIDOR" / "MOTOR BOMBEADOR", que es el USO del motor,
  -- no su marca. Ninguna de las dos trae marca. Con `marca` NOT NULL
  -- (como estaba en Mongoose) 2 de las 3 fichas reales no se pueden cargar.
  descripcion    text not null,
  marca          text,
  modelo         text,
  aplicacion     text,
  tipo_electrico public.tipo_electrico,

  -- Electricos.
  -- Cada numerico va con su `_texto` al lado. Los campos de Mongo eran
  -- todos String ("1/2", "8µF", "45mm"); al tipar, lo que no parsea NO se
  -- descarta: queda el original y el campo numerico en NULL. Un "1/2" que
  -- se convierte en NULL silencioso es perdida de datos real.
  hp_num           numeric(6,2),
  hp_texto         text,
  amperaje_num     numeric(6,2),
  amperaje_texto   text,
  capacitor_uf     numeric(7,2),
  capacitor_texto  text,
  ranuras          smallint,   -- ficha A "24 RANURAS", ficha B "RANURAS 32"
  rpm              integer,    -- ficha A "1450 RPM"

  -- Medidas de la carcasa (mm).
  largo_mm     numeric(7,2),
  diam_int_mm  numeric(7,2),
  diam_ext_mm  numeric(7,2),

  -- Aislacion. El croquis de las fichas es un rectangulo con dos numeros:
  -- ficha A "30 x 60", ficha C "26mm x 76mm".
  -- Renombrado desde `aislaciones.alta`, que era un bug de naming: el
  -- formulario mostraba "Largo" pero la clave decia "alta".
  aislacion_largo_mm numeric(7,2),
  aislacion_ancho_mm numeric(7,2),
  aislacion_cantidad smallint,

  observaciones text,

  -- Columnas cacheadas: reconstruyen "6-8-10-12" desde bobinado_seccion.
  -- Existen para que el listado y el buscador sigan siendo una consulta
  -- plana sin joins. Las mantiene un trigger; nunca se escriben a mano.
  arranque_paso_txt    text,
  arranque_vueltas_txt text,
  trabajo_paso_txt     text,
  trabajo_vueltas_txt  text,

  busqueda tsvector generated always as (
    to_tsvector('spanish',
      coalesce(descripcion, '') || ' ' ||
      coalesce(marca, '')       || ' ' ||
      coalesce(modelo, '')      || ' ' ||
      coalesce(aplicacion, ''))
  ) stored,

  creado_por     uuid references auth.users(id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index motor_busqueda_idx on public.motor using gin (busqueda);
create index motor_nro_idx      on public.motor (nro_motor desc);
create index motor_marca_idx    on public.motor (marca) where marca is not null;

create trigger motor_actualizado
  before update on public.motor
  for each row execute function public.tocar_actualizado_en();


-- ---------- Circuitos de bobinado ----------

create type public.tipo_circuito as enum ('arranque', 'trabajo');

create table public.motor_circuito (
  id       uuid primary key default gen_random_uuid(),
  motor_id uuid not null references public.motor(id) on delete cascade,
  tipo     public.tipo_circuito not null,

  -- "⌀ 0,50mm — 0,550 KG"  ->  alambre_mm 0.50 / alambre_kg 0.550
  -- "⌀ 2x0,45mm"           ->  alambre_mm 0.45 / alambre_hilos 2
  alambre_mm    numeric(5,2),
  alambre_hilos smallint not null default 1,
  alambre_kg    numeric(6,3),

  -- "ABERT. 42mm (2/3)" -> abertura_mm 42 / abertura_fraccion '2/3'
  -- La fraccion es la relacion de molde; se guarda como texto porque
  -- aparece en varias formas ("(3)", "2/3", "3/4").
  abertura_mm       numeric(7,2),
  abertura_fraccion text,

  unique (motor_id, tipo)
);

create index motor_circuito_motor_idx on public.motor_circuito (motor_id);


-- ---------- Secciones de bobinado ----------
--
-- El corazon del rediseño. En las fichas, paso y vueltas son pares
-- correlacionados de largo variable:
--
--   ficha A arranque:  paso 6              <-> vueltas 300           (1 seccion)
--   ficha B trabajo:   paso 4-6-8          <-> vueltas 80-80-90      (3 secciones)
--   ficha C trabajo:   paso 4-6-8-10-12    <-> vueltas 33-62-66-88-88 (5 secciones)
--
-- Guardarlos como dos strings (schema viejo) pierde la correspondencia y
-- no permite buscar. Como dos arrays paralelos, nada garantiza que tengan
-- el mismo largo y el primer bug los desalinea en silencio. Una fila por
-- seccion hace que el par no se pueda romper.

create table public.bobinado_seccion (
  id          uuid primary key default gen_random_uuid(),
  circuito_id uuid not null references public.motor_circuito(id) on delete cascade,
  orden       smallint not null,
  paso        integer,
  vueltas     integer,

  -- La ficha C tiene "32-38-64-72" tachado y "30-34-60-82" circulado
  -- abajo. El valor corregido va en `vueltas`; el tachado se conserva
  -- aca. Es informacion real del taller (alguien recalculo y corrigio),
  -- no ruido a descartar.
  vueltas_tachadas integer,

  unique (circuito_id, orden)
);

create index bobinado_seccion_circuito_idx on public.bobinado_seccion (circuito_id);


-- ---------- Mantenimiento de las columnas cacheadas ----------

create or replace function public.refrescar_bobinado_txt(p_motor_id uuid)
returns void
language sql
as $$
  update public.motor m set
    arranque_paso_txt = (
      select string_agg(s.paso::text, '-' order by s.orden)
      from public.bobinado_seccion s
      join public.motor_circuito c on c.id = s.circuito_id
      where c.motor_id = m.id and c.tipo = 'arranque'
    ),
    arranque_vueltas_txt = (
      select string_agg(s.vueltas::text, '-' order by s.orden)
      from public.bobinado_seccion s
      join public.motor_circuito c on c.id = s.circuito_id
      where c.motor_id = m.id and c.tipo = 'arranque'
    ),
    trabajo_paso_txt = (
      select string_agg(s.paso::text, '-' order by s.orden)
      from public.bobinado_seccion s
      join public.motor_circuito c on c.id = s.circuito_id
      where c.motor_id = m.id and c.tipo = 'trabajo'
    ),
    trabajo_vueltas_txt = (
      select string_agg(s.vueltas::text, '-' order by s.orden)
      from public.bobinado_seccion s
      join public.motor_circuito c on c.id = s.circuito_id
      where c.motor_id = m.id and c.tipo = 'trabajo'
    )
  where m.id = p_motor_id;
$$;

-- Cambio en una seccion: hay que resolver el motor via el circuito.
-- Si el circuito ya no existe (se esta borrando en cascada) no hay nada
-- que refrescar: el trigger de motor_circuito se encarga.
create or replace function public.trg_seccion_refresca_txt()
returns trigger
language plpgsql
as $$
declare
  v_motor_id uuid;
begin
  select motor_id into v_motor_id
  from public.motor_circuito
  where id = coalesce(new.circuito_id, old.circuito_id);

  if v_motor_id is not null then
    perform public.refrescar_bobinado_txt(v_motor_id);
  end if;

  return coalesce(new, old);
end;
$$;

create trigger bobinado_seccion_refresca
  after insert or update or delete on public.bobinado_seccion
  for each row execute function public.trg_seccion_refresca_txt();

-- Borrado de un circuito entero: sus secciones se van en cascada, pero
-- para entonces el circuito ya no esta y el trigger de arriba no puede
-- resolver el motor. Este cierra ese hueco.
create or replace function public.trg_circuito_refresca_txt()
returns trigger
language plpgsql
as $$
begin
  perform public.refrescar_bobinado_txt(coalesce(new.motor_id, old.motor_id));
  return coalesce(new, old);
end;
$$;

create trigger motor_circuito_refresca
  after insert or update or delete on public.motor_circuito
  for each row execute function public.trg_circuito_refresca_txt();


-- ---------- Fotos ----------

create table public.motor_foto (
  id         uuid primary key default gen_random_uuid(),
  motor_id   uuid not null references public.motor(id) on delete cascade,

  -- Path dentro del bucket de Supabase Storage, o URL absoluta si
  -- es_externa = true (fotos heredadas de Cloudinary, que siguen sirviendo
  -- desde alli hasta que se migren).
  storage_path text not null,
  es_externa   boolean not null default false,

  -- Marca la foto de la ficha de papel original. Es la que devuelve
  -- /foto en el bot y la que se muestra al lado del formulario en la
  -- pantalla de revision de una extraccion.
  es_ficha boolean not null default false,

  orden     smallint not null default 0,
  creado_en timestamptz not null default now()
);

create index motor_foto_motor_idx on public.motor_foto (motor_id, orden);


-- ---------- Reparaciones ----------
--
-- La union entre la ficha tecnica y el cliente. La ficha describe el
-- motor (catalogo reutilizable); la reparacion es un paso del motor por
-- el taller, con su cliente y su fecha. Un mismo motor puede volver
-- varias veces, incluso con distinto dueño, sin duplicar la ficha.
--
-- Tambien es lo que le da contenido real a la pagina publica /estado,
-- hoy simulada con datos fijos.

create type public.estado_reparacion as enum (
  'ingresado', 'en_proceso', 'esperando_repuesto',
  'terminado', 'entregado', 'cancelado'
);

create sequence public.reparacion_nro_seq;

create table public.reparacion (
  id      uuid primary key default gen_random_uuid(),
  numero  bigint not null unique default nextval('public.reparacion_nro_seq'),

  motor_id   uuid references public.motor(id) on delete set null,
  cliente_id uuid references public.cliente(id) on delete set null,

  estado  public.estado_reparacion not null default 'ingresado',
  ingreso date not null default current_date,
  egreso  date,
  notas   text,

  creado_por     uuid references auth.users(id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint egreso_posterior_a_ingreso
    check (egreso is null or egreso >= ingreso)
);

create index reparacion_estado_idx  on public.reparacion (estado, ingreso desc);
create index reparacion_cliente_idx on public.reparacion (cliente_id);
create index reparacion_motor_idx   on public.reparacion (motor_id);

create trigger reparacion_actualizada
  before update on public.reparacion
  for each row execute function public.tocar_actualizado_en();
