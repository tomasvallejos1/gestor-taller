-- ============================================================
--  Limpieza automatica de las tablas del bot
-- ============================================================
--
-- Dos tablas del bot crecen sin techo si nadie las poda:
--
-- telegram_update es la que garantiza idempotencia (Telegram reintenta
-- un update si tardamos en responder, y esta tabla es lo que hace que
-- el reintento no vuelva a procesar todo). Un dia despues de recibido,
-- un update no se va a reintentar nunca mas: Telegram no reintenta
-- updates de mas de 24hs. 48hs de margen y se descarta.
--
-- telegram_conversacion ya tenia limpiar_conversaciones_viejas() escrita
-- desde que se creo la tabla, pero nunca quedo programada para correr
-- sola. Una funcion que nadie llama es indistinguible de no tenerla.
--
-- pg_cron corre DENTRO de la base, sin depender de que una Edge Function
-- se acuerde de invocar nada.

create extension if not exists pg_cron with schema extensions;

create or replace function public.limpiar_telegram_updates_viejos()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.telegram_update
  where visto_en < now() - interval '48 hours';
$$;

-- cron.schedule actualiza el job si ya existe uno con el mismo nombre:
-- correr esta migracion de nuevo no duplica nada.
select cron.schedule(
  'limpiar-conversaciones-telegram', '15 * * * *',
  $$select public.limpiar_conversaciones_viejas()$$
);

select cron.schedule(
  'limpiar-updates-telegram', '30 3 * * *',
  $$select public.limpiar_telegram_updates_viejos()$$
);


-- ============================================================
--  Deteccion de clientes parecidos
-- ============================================================
--
-- Antes /presupuesto cargaba un cliente nuevo sin fijarse si ya existia
-- uno parecido. "Juan Perez" y "Juan Perez" (o "Juan Peres", tipeado
-- distinto) terminan siendo dos filas separadas, y despues nadie sabe
-- cual de las dos tiene el historial real.
--
-- pg_trgm ya esta instalado (lo uso el buscador de motores). similarity()
-- compara por trigramas: agarra tambien errores de tipeo, que un
-- `ilike '%texto%'` no.

create or replace function public.clientes_similares(p_nombre text, p_umbral real default 0.3)
returns table(id uuid, nombre text, telefono text, similitud real)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.nombre, c.telefono, similarity(c.nombre, p_nombre) as similitud
  from public.cliente c
  where similarity(c.nombre, p_nombre) > p_umbral
  order by similitud desc
  limit 5
$$;

grant execute on function public.clientes_similares(text, real) to authenticated, service_role;

-- El indice trigram es lo que evita que esto sea un table scan a medida
-- que crece la tabla de clientes.
create index if not exists cliente_nombre_trgm on public.cliente using gin (nombre gin_trgm_ops);
