-- ============================================================
--  Bot de Telegram: vinculacion e idempotencia
-- ============================================================


-- ---------- Vinculacion por codigo ----------
--
-- Un telegram_id suelto no alcanza para autorizar a nadie: cualquiera que
-- sepa el nombre del bot puede escribirle. El vinculo lo inicia el usuario
-- desde adentro del sistema, donde ya probo quien es, y el codigo es lo
-- unico que viaja por un canal que no controlamos.
--
-- Vence a los 10 minutos. Es un numero de 6 digitos: sirve para tipearlo
-- una vez, no para quedar dando vueltas en un chat.

alter table public.perfil
  add column if not exists telegram_codigo text,
  add column if not exists telegram_codigo_vence timestamptz;

create unique index if not exists perfil_telegram_id_unico
  on public.perfil (telegram_id)
  where telegram_id is not null;


/**
 * Genera el codigo para el usuario de la sesion.
 * Se llama desde Ajustes, con la sesion del navegador.
 */
create or replace function public.generar_codigo_telegram()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesion.';
  end if;

  c := lpad((floor(random() * 1000000))::int::text, 6, '0');

  update public.perfil
     set telegram_codigo = c,
         telegram_codigo_vence = now() + interval '10 minutes'
   where id = auth.uid();

  return c;
end;
$$;

grant execute on function public.generar_codigo_telegram() to authenticated;


/**
 * Cierra el vinculo. La llama el bot con service_role: del lado de
 * Telegram no hay sesion de Supabase con la cual chequear nada.
 *
 * Devuelve el nombre del perfil vinculado, o null si el codigo no sirve.
 * El codigo se consume en el mismo UPDATE que lo valida: si se leyera
 * primero y se borrara despues, dos mensajes simultaneos con el mismo
 * codigo podrian vincular dos cuentas de Telegram.
 */
create or replace function public.vincular_telegram(
  p_codigo text,
  p_telegram_id bigint
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  nombre_perfil text;
begin
  update public.perfil
     set telegram_id = p_telegram_id,
         telegram_codigo = null,
         telegram_codigo_vence = null
   where telegram_codigo = p_codigo
     and telegram_codigo_vence > now()
  returning nombre into nombre_perfil;

  return nombre_perfil;
end;
$$;

revoke execute on function public.vincular_telegram(text, bigint) from public, anon, authenticated;


-- ---------- Idempotencia de los updates ----------
--
-- Telegram reintenta el envio si el webhook no responde 200 rapido. Sin
-- deduplicar, una foto reenviada dispara dos extracciones: dos llamadas
-- al modelo pagas y dos fichas a medio cargar para la misma foto.

create table if not exists public.telegram_update (
  update_id bigint primary key,
  visto_en  timestamptz not null default now()
);

alter table public.telegram_update enable row level security;
-- Sin policies: solo service_role entra, y service_role no pasa por RLS.

comment on table public.telegram_update is
  'Updates ya procesados. Evita que un reintento de Telegram duplique el trabajo.';
