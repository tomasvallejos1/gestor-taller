-- =============================================================
--  Rescate de lecturas de ficha que quedaron trabadas
-- =============================================================
--
-- El flujo de extraccion es asincronico: la app crea la fila, dispara la
-- Edge Function y despues sigue el estado por Realtime. Eso deja un
-- agujero: si la corrida muere sin poder escribir nada, la fila se queda
-- en 'pendiente' o 'procesando' y del otro lado la pantalla gira para
-- siempre. No hay reintento posible porque el estado nunca llega a ser
-- final.
--
-- Y morir sin escribir nada pasa de verdad. El 18/08 una corrida se paso
-- de los 150s de reloj de pared de las Edge Functions --el proveedor
-- principal se colgo 90s y recien despues arranco el respaldo-- y
-- Supabase mato el worker: no corre ningun `catch`, no corre ningun
-- `finally`, la fila queda como estaba. Tambien pasa si el celular
-- pierde la conexion justo despues de crear la fila y el `invoke` nunca
-- llega a salir.
--
-- El presupuesto de tiempo dentro de la funcion cubre el caso comun.
-- Esto cubre el resto: nadie puede garantizar desde adentro que un
-- proceso muerto marque su propia fila. Tiene que venir de afuera.

create or replace function public.reclamar_extracciones_trabadas(
  p_extraccion_id uuid default null,
  p_minutos integer default 4
)
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  with rescatadas as (
    update public.ficha_extraccion
       set estado = 'error',
           error  = coalesce(
             error,
             'La lectura se corto antes de terminar y no dejo resultado. '
             || 'La foto quedo guardada: se puede reintentar sin volver a sacarla.'
           )
     where estado in ('pendiente', 'procesando')
       -- Solo las propias. La funcion es security definer para poder
       -- escribir sin pelearse con las policies, asi que el alcance hay
       -- que ponerlo a mano: sin esto, cualquiera limpiaria las de todos.
       and (creado_por = auth.uid() or public.es_super())
       and (p_extraccion_id is null or id = p_extraccion_id)
       -- El margen tiene que ser mayor al presupuesto de la funcion
       -- (120s) mas el arranque en frio. Cuatro minutos es holgado: una
       -- lectura que de verdad esta corriendo nunca llega ahi.
       and actualizado_en < now() - make_interval(mins => greatest(p_minutos, 2))
    returning 1
  )
  select count(*)::integer from rescatadas;
$$;

comment on function public.reclamar_extracciones_trabadas(uuid, integer) is
  'Marca como error las lecturas propias que quedaron colgadas sin estado final. '
  'La llama el cliente cuando lleva demasiado tiempo esperando una.';

grant execute on function public.reclamar_extracciones_trabadas(uuid, integer) to authenticated;
