-- =============================================================
--  Guardado transaccional de un motor con sus circuitos y secciones
--
--  El cliente de supabase-js no tiene transacciones multi-sentencia: cada
--  .insert() es su propia transaccion. Guardar un motor desde el cliente
--  seria entonces una secuencia de 1 + 2 + N escrituras independientes, y
--  cualquier corte a mitad de camino dejaria un motor sin bobinado --que
--  es justamente el dato por el que existe la ficha--.
--
--  Una funcion plpgsql corre entera dentro de una transaccion: o se
--  escribe todo, o no se escribe nada.
--
--  SECURITY INVOKER (el default, explicito aca para que se lea):
--  la funcion corre con los permisos de quien la llama, asi que las
--  policies de RLS siguen aplicando. Con SECURITY DEFINER, un `lector`
--  podria crear motores llamando a la RPC y saltearse la policy.
-- =============================================================

create or replace function public.guardar_motor_completo(p_datos jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_motor_id   uuid;
  v_circuito   jsonb;
  v_circuito_id uuid;
  v_seccion    jsonb;
  v_orden      smallint;
begin
  if coalesce(trim(p_datos ->> 'descripcion'), '') = '' then
    raise exception 'La descripcion del motor es obligatoria';
  end if;

  v_motor_id := nullif(p_datos ->> 'id', '')::uuid;

  if v_motor_id is null then
    insert into public.motor (
      descripcion, marca, modelo, aplicacion, tipo_electrico,
      hp_num, hp_texto, amperaje_num, amperaje_texto,
      capacitor_uf, capacitor_texto, ranuras, rpm,
      largo_mm, diam_int_mm, diam_ext_mm,
      aislacion_largo_mm, aislacion_ancho_mm, aislacion_cantidad,
      observaciones, creado_por
    ) values (
      p_datos ->> 'descripcion',
      nullif(p_datos ->> 'marca', ''),
      nullif(p_datos ->> 'modelo', ''),
      nullif(p_datos ->> 'aplicacion', ''),
      nullif(p_datos ->> 'tipo_electrico', '')::public.tipo_electrico,
      nullif(p_datos ->> 'hp_num', '')::numeric,
      nullif(p_datos ->> 'hp_texto', ''),
      nullif(p_datos ->> 'amperaje_num', '')::numeric,
      nullif(p_datos ->> 'amperaje_texto', ''),
      nullif(p_datos ->> 'capacitor_uf', '')::numeric,
      nullif(p_datos ->> 'capacitor_texto', ''),
      nullif(p_datos ->> 'ranuras', '')::smallint,
      nullif(p_datos ->> 'rpm', '')::integer,
      nullif(p_datos ->> 'largo_mm', '')::numeric,
      nullif(p_datos ->> 'diam_int_mm', '')::numeric,
      nullif(p_datos ->> 'diam_ext_mm', '')::numeric,
      nullif(p_datos ->> 'aislacion_largo_mm', '')::numeric,
      nullif(p_datos ->> 'aislacion_ancho_mm', '')::numeric,
      nullif(p_datos ->> 'aislacion_cantidad', '')::smallint,
      nullif(p_datos ->> 'observaciones', ''),
      auth.uid()
    )
    returning id into v_motor_id;
  else
    update public.motor set
      descripcion        = p_datos ->> 'descripcion',
      marca              = nullif(p_datos ->> 'marca', ''),
      modelo             = nullif(p_datos ->> 'modelo', ''),
      aplicacion         = nullif(p_datos ->> 'aplicacion', ''),
      tipo_electrico     = nullif(p_datos ->> 'tipo_electrico', '')::public.tipo_electrico,
      hp_num             = nullif(p_datos ->> 'hp_num', '')::numeric,
      hp_texto           = nullif(p_datos ->> 'hp_texto', ''),
      amperaje_num       = nullif(p_datos ->> 'amperaje_num', '')::numeric,
      amperaje_texto     = nullif(p_datos ->> 'amperaje_texto', ''),
      capacitor_uf       = nullif(p_datos ->> 'capacitor_uf', '')::numeric,
      capacitor_texto    = nullif(p_datos ->> 'capacitor_texto', ''),
      ranuras            = nullif(p_datos ->> 'ranuras', '')::smallint,
      rpm                = nullif(p_datos ->> 'rpm', '')::integer,
      largo_mm           = nullif(p_datos ->> 'largo_mm', '')::numeric,
      diam_int_mm        = nullif(p_datos ->> 'diam_int_mm', '')::numeric,
      diam_ext_mm        = nullif(p_datos ->> 'diam_ext_mm', '')::numeric,
      aislacion_largo_mm = nullif(p_datos ->> 'aislacion_largo_mm', '')::numeric,
      aislacion_ancho_mm = nullif(p_datos ->> 'aislacion_ancho_mm', '')::numeric,
      aislacion_cantidad = nullif(p_datos ->> 'aislacion_cantidad', '')::smallint,
      observaciones      = nullif(p_datos ->> 'observaciones', '')
    where id = v_motor_id;

    -- 0 filas afectadas = o no existe, o RLS lo bloqueo. En ambos casos
    -- hay que cortar: seguir dejaria circuitos huerfanos.
    if not found then
      raise exception 'Motor % inexistente o sin permiso de edicion', v_motor_id;
    end if;
  end if;

  -- Los circuitos se reemplazan enteros en vez de diferenciarse uno a uno:
  -- son a lo sumo dos por motor con un puñado de secciones, y el reemplazo
  -- elimina toda una clase de bugs de sincronizacion parcial.
  -- El delete cascadea a bobinado_seccion.
  delete from public.motor_circuito where motor_id = v_motor_id;

  for v_circuito in
    select value from jsonb_array_elements(coalesce(p_datos -> 'circuitos', '[]'::jsonb))
  loop
    insert into public.motor_circuito (
      motor_id, tipo, alambre_mm, alambre_hilos, alambre_kg,
      abertura_mm, abertura_fraccion
    ) values (
      v_motor_id,
      (v_circuito ->> 'tipo')::public.tipo_circuito,
      nullif(v_circuito ->> 'alambre_mm', '')::numeric,
      coalesce(nullif(v_circuito ->> 'alambre_hilos', '')::smallint, 1),
      nullif(v_circuito ->> 'alambre_kg', '')::numeric,
      nullif(v_circuito ->> 'abertura_mm', '')::numeric,
      nullif(v_circuito ->> 'abertura_fraccion', '')
    )
    returning id into v_circuito_id;

    v_orden := 0;
    for v_seccion in
      select value from jsonb_array_elements(coalesce(v_circuito -> 'secciones', '[]'::jsonb))
    loop
      -- Una seccion sin paso ni vueltas es una fila vacia del formulario.
      if nullif(v_seccion ->> 'paso', '') is not null
         or nullif(v_seccion ->> 'vueltas', '') is not null then
        insert into public.bobinado_seccion (
          circuito_id, orden, paso, vueltas, vueltas_tachadas
        ) values (
          v_circuito_id,
          v_orden,
          nullif(v_seccion ->> 'paso', '')::integer,
          nullif(v_seccion ->> 'vueltas', '')::integer,
          nullif(v_seccion ->> 'vueltas_tachadas', '')::integer
        );
        v_orden := v_orden + 1;
      end if;
    end loop;
  end loop;

  return v_motor_id;
end;
$$;

comment on function public.guardar_motor_completo(jsonb) is
  'Alta o edicion de un motor con sus circuitos y secciones en una sola '
  'transaccion. Devuelve el uuid del motor.';


-- ---------- Lectura completa ----------
-- Arma la ficha entera en un solo viaje. La alternativa (motor, despues
-- circuitos, despues secciones) son tres round-trips que desde el celular
-- se notan.

create or replace function public.motor_completo(p_nro_o_id text)
returns jsonb
language sql
security invoker
stable
as $$
  select jsonb_build_object(
    'motor', to_jsonb(m) - 'busqueda',
    'circuitos', coalesce((
      select jsonb_agg(
        to_jsonb(c) || jsonb_build_object('secciones', coalesce((
          select jsonb_agg(to_jsonb(s) order by s.orden)
          from public.bobinado_seccion s where s.circuito_id = c.id
        ), '[]'::jsonb))
        order by c.tipo
      )
      from public.motor_circuito c where c.motor_id = m.id
    ), '[]'::jsonb),
    'fotos', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.es_ficha desc, f.orden)
      from public.motor_foto f where f.motor_id = m.id
    ), '[]'::jsonb)
  )
  from public.motor m
  where m.id = (case when p_nro_o_id ~ '^[0-9a-fA-F-]{36}$'
                     then p_nro_o_id::uuid else null end)
     or m.nro_motor = (case when p_nro_o_id ~ '^\d+$'
                            then p_nro_o_id::bigint else null end)
$$;

comment on function public.motor_completo(text) is
  'Ficha completa por uuid o por numero de motor. Acepta ambos porque la '
  'app vieja linkeaba por nroMotor y el bot lo pide por numero.';
