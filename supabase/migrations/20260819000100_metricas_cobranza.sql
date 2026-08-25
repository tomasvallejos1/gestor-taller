-- =============================================================
--  El panel tambien tiene que saber quien debe
--
--  Las metricas se armaron cuando el sistema no sabia de plata: contaba
--  motores, fichas y clientes. Desde que hay cobranza, la pregunta que
--  el taller se hace al abrir la app a la mañana no es cuantas ordenes
--  hay abiertas --eso se ve entrando-- sino cuales piden hacer algo hoy,
--  y una de esas tres cosas es cobrar.
--
--  `deudores` y `deuda` van por la misma consulta que usa el chip de la
--  pantalla de reparaciones: entregado y con saldo. Como la funcion es
--  SECURITY INVOKER, un lector --que no ve `cobranza` por RLS-- recibe
--  cero, que es exactamente lo que corresponde: no ve precios.
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

    -- Motores que ya se fueron del taller sin estar cobrados. Es la
    -- unica metrica del panel que mira plata, y la unica que se pinta
    -- en rojo: una vez que el motor salio, la palanca para cobrar ya no
    -- esta.
    'deudores', (
      select count(*) from public.reparacion r
      join public.cobranza c on c.reparacion_id = r.id
      where r.estado = 'entregado' and c.estado in ('impago', 'parcial')
    ),
    'deuda', coalesce((
      select sum(c.saldo) from public.reparacion r
      join public.cobranza c on c.reparacion_id = r.id
      where r.estado = 'entregado' and c.estado in ('impago', 'parcial')
    ), 0),

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

    -- Lo cobrado en el mes, para Informes. Cuenta lo que entro a la
    -- caja --con recargos-- y no lo imputado a la deuda: es plata.
    'cobrado_mes', coalesce((
      select sum(cobrado) from public.pago
      where fecha >= date_trunc('month', current_date)
    ), 0),

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
