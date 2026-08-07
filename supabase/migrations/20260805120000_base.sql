-- =============================================================
--  Base: extensiones, perfiles de usuario y helpers de rol
-- =============================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- similitud de texto (duplicados de clientes)


-- ---------- Roles ----------

create type public.rol_usuario as enum ('super', 'editor', 'lector');


-- ---------- Perfil ----------
-- Extiende auth.users. Supabase Auth guarda credenciales y sesion;
-- todo lo del dominio (nombre, rol, vinculo con Telegram) vive aca.

create table public.perfil (
  id             uuid primary key references auth.users(id) on delete cascade,
  nombre         text not null,
  rol            public.rol_usuario not null default 'lector',
  telegram_id    bigint unique,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on column public.perfil.telegram_id is
  'Se completa cuando el usuario vincula su cuenta con /vincular <codigo>. '
  'NULL = no puede operar el bot.';


-- ---------- Timestamp automatico ----------

create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger perfil_actualizado
  before update on public.perfil
  for each row execute function public.tocar_actualizado_en();


-- ---------- Alta automatica de perfil ----------
-- Sin esto, un usuario creado desde el panel de Supabase queda sin perfil
-- y por lo tanto sin rol: rol_actual() devuelve NULL y las policies lo
-- rechazan en todos lados. El trigger garantiza que auth.users y perfil
-- no puedan desincronizarse.

create or replace function public.crear_perfil_para_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfil (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'rol')::public.rol_usuario, 'lector')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_para_usuario_nuevo();


-- ---------- Helpers de rol ----------
--
-- SECURITY DEFINER es OBLIGATORIO aca, no una optimizacion.
--
-- Las policies de `perfil` necesitan saber el rol del usuario, y el rol
-- esta guardado en `perfil`. Si la policy consultara la tabla directamente,
-- Postgres tendria que evaluar la policy de `perfil` para poder evaluar la
-- policy de `perfil`: recursion infinita y error 500 en toda la app.
--
-- SECURITY DEFINER hace que la funcion corra con los permisos de su dueño
-- (postgres), que no esta sujeto a RLS. La consulta se resuelve sin
-- reentrar en el sistema de policies.
--
-- `set search_path = public` tampoco es opcional: sin eso, un usuario que
-- pueda crear objetos en otro schema podria anteponer una tabla `perfil`
-- falsa y hacer que la funcion --que corre como superusuario-- la lea.

create or replace function public.rol_actual()
returns public.rol_usuario
language sql
security definer
stable
set search_path = public
as $$
  select rol from public.perfil where id = auth.uid() and activo
$$;

create or replace function public.es_super()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.rol_actual() = 'super', false)
$$;

create or replace function public.es_editor()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.rol_actual() in ('super', 'editor'), false)
$$;

create or replace function public.esta_autenticado()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.rol_actual() is not null
$$;


-- ---------- Resolucion de identidad para el bot ----------
-- El webhook de Telegram corre con service_role y necesita traducir
-- telegram_id -> usuario. Se expone como funcion para que la logica de
-- "que cuenta esta activa" viva en un solo lugar.

create or replace function public.perfil_por_telegram(p_telegram_id bigint)
returns public.perfil
language sql
security definer
stable
set search_path = public
as $$
  select * from public.perfil where telegram_id = p_telegram_id and activo
$$;
