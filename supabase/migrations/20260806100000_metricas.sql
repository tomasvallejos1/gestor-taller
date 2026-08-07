-- =============================================================
--  Metricas del panel principal
--
--  Una sola funcion en vez de cinco consultas separadas desde el
--  cliente. Desde el celular del taller, cinco viajes de ida y vuelta
--  con latencia movil se notan; uno no.
--
--  SECURITY INVOKER: los conteos respetan RLS, asi que un `lector` no ve
--  el total de presupuestos.
-- =============================================================

create or replace function public.metricas_panel()
returns jsonb
language sql
security invoker
stable
as $$
  select jsonb_build_object(
    'fichas', (select count(*) from public.motor),
    'clientes', (select count(*) from public.cliente),

    'reparaciones_abiertas', (
      select count(*) from public.reparacion
      where estado in ('ingresado', 'en_proceso', 'esperando_repuesto', 'terminado')
    ),
    'listas_para_retirar', (
      select count(*) from public.reparacion where estado = 'terminado'
    ),
    'esperando_repuesto', (
      select count(*) from public.reparacion where estado = 'esperando_repuesto'
    ),

    -- Desglose por estado, para el grafico.
    'por_estado', coalesce((
      select jsonb_object_agg(estado, cantidad)
      from (
        select estado::text as estado, count(*) as cantidad
        from public.reparacion
        where estado <> 'cancelado'
        group by estado
      ) t
    ), '{}'::jsonb),

    'ingresos_mes', (
      select count(*) from public.reparacion
      where ingreso >= date_trunc('month', current_date)
    ),
    'entregas_mes', (
      select count(*) from public.reparacion
      where egreso >= date_trunc('month', current_date)
    ),

    -- Cuanto tarda una reparacion, en dias. Es la metrica que el taller
    -- puede usar para prometer plazos con fundamento.
    'dias_promedio', (
      select round(avg(egreso - ingreso), 1)
      from public.reparacion
      where egreso is not null and egreso >= current_date - interval '180 days'
    ),

    'ultimas_fichas', coalesce((
      select jsonb_agg(f order by f->>'creado_en' desc)
      from (
        select jsonb_build_object(
          'id', id, 'nro_motor', nro_motor,
          'descripcion', descripcion, 'creado_en', creado_en
        ) as f
        from public.motor order by creado_en desc limit 5
      ) u
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.metricas_panel() to authenticated;
