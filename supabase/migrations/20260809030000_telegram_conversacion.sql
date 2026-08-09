-- ============================================================
--  Donde vive una conversacion a medio terminar
-- ============================================================
--
-- Un webhook no tiene memoria: cada mensaje llega como un request
-- suelto. Para poder preguntar "¿cuantas unidades?" y entender que la
-- respuesta "3" pertenece al renglon que se estaba cargando, el paso en
-- que va la charla tiene que estar guardado en algun lado.
--
-- Una fila por telegram_id y no por conversacion: una persona atiende un
-- presupuesto por vez. Si arranca uno nuevo a mitad de otro, el nuevo
-- pisa al anterior, que es lo que espera cualquiera que escriba
-- /presupuesto de nuevo despues de perderse.

create table if not exists public.telegram_conversacion (
  telegram_id   bigint primary key,
  flujo         text        not null,
  paso          text        not null,
  datos         jsonb       not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

comment on table public.telegram_conversacion is
  'Estado intermedio de los flujos conversacionales del bot. Efimero: lo limpia limpiar_conversaciones_viejas().';

-- Solo el bot (service_role) la toca. Nadie deberia poder leer por donde
-- va otro ni menos escribirle pasos.
alter table public.telegram_conversacion enable row level security;

revoke all on public.telegram_conversacion from public, anon, authenticated;


-- Una charla abandonada a la mitad no puede quedar viva para siempre: si
-- alguien empieza un presupuesto, se distrae y vuelve tres dias despues,
-- retomar en "¿cuantas unidades?" sin contexto es peor que arrancar de
-- nuevo. Se descartan a las 6 horas.
create or replace function public.limpiar_conversaciones_viejas()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.telegram_conversacion
  where actualizado_en < now() - interval '6 hours';
$$;
