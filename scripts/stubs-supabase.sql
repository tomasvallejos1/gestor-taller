-- Stubs minimos de los schemas que provee Supabase, para poder validar
-- las migraciones contra un Postgres pelado sin levantar el stack entero.
-- NO se aplica en produccion: alli auth.* y storage.* ya existen.

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id                   uuid primary key default gen_random_uuid(),
  email                text,
  raw_user_meta_data   jsonb default '{}'::jsonb
);

create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text,
  owner     uuid
);

alter table storage.objects enable row level security;

do $$ begin
  create role anon;
exception when duplicate_object then null; end $$;

do $$ begin
  create role authenticated;
exception when duplicate_object then null; end $$;
