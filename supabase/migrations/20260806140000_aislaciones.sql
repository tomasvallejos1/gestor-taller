-- =============================================================
--  Aislaciones: de tres columnas sueltas a una tabla hija
--
--  El motor tenia aislacion_largo_mm / aislacion_ancho_mm /
--  aislacion_cantidad: una sola aislacion por ficha. En la practica un
--  motor lleva varias, de medidas distintas (una para el fondo de
--  ranura, otra para la cuña, otra entre fases), cada una con su
--  cantidad.
--
--  Es el mismo problema que ya se resolvio con bobinado_seccion: un
--  dato que en el papel es una lista no entra en columnas fijas. Y la
--  misma solucion, por la misma razon: con tres columnas no hay forma
--  de agregar la cuarta aislacion sin perder las anteriores.
-- =============================================================

create table public.motor_aislacion (
  id        uuid primary key default gen_random_uuid(),
  motor_id  uuid not null references public.motor(id) on delete cascade,
  orden     smallint not null,

  -- Nada es obligatorio salvo el orden: las fichas reales tienen
  -- aislaciones con el largo anotado y el ancho no, y rechazar esa fila
  -- obligaria al taller a inventar un numero.
  largo_mm  numeric(7,2),
  ancho_mm  numeric(7,2),
  cantidad  smallint,

  -- Que dimension es: "fondo de ranura", "cuña", "entre fases". Texto
  -- libre porque cada taller las nombra distinto y no vale la pena un
  -- enum que despues no cubra el caso raro.
  descripcion text,

  unique (motor_id, orden)
);

create index motor_aislacion_motor_idx on public.motor_aislacion (motor_id);

alter table public.motor_aislacion enable row level security;

create policy aislacion_select on public.motor_aislacion
  for select using (public.esta_autenticado());
create policy aislacion_escribe on public.motor_aislacion
  for all using (public.es_editor()) with check (public.es_editor());


-- ---------- Traslado de lo que ya estaba cargado ----------
-- Cada motor que tenga alguna de las tres columnas con dato pasa a
-- tener su primera aislacion. Los que no tienen nada no generan fila
-- vacia.

insert into public.motor_aislacion (motor_id, orden, largo_mm, ancho_mm, cantidad)
select id, 0, aislacion_largo_mm, aislacion_ancho_mm, aislacion_cantidad
from public.motor
where aislacion_largo_mm is not null
   or aislacion_ancho_mm is not null
   or aislacion_cantidad is not null;

-- Recien despues de copiar se sacan las viejas. Dejarlas seria tener
-- dos fuentes de verdad para el mismo dato, que es como empiezan los
-- bugs de "en la lista dice una cosa y en la ficha otra".
alter table public.motor
  drop column aislacion_largo_mm,
  drop column aislacion_ancho_mm,
  drop column aislacion_cantidad;


-- =============================================================
--  Guardado transaccional: ahora tambien las aislaciones
-- =============================================================

create or replace function public.guardar_motor_completo(p_datos jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_motor_id    uuid;
  v_circuito    jsonb;
  v_circuito_id uuid;
  v_seccion     jsonb;
  v_aislacion   jsonb;
  v_orden       smallint;
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

  -- Mismo criterio que los circuitos: se reemplazan todas.
  delete from public.motor_aislacion where motor_id = v_motor_id;

  v_orden := 0;
  for v_aislacion in
    select value from jsonb_array_elements(coalesce(p_datos -> 'aislaciones', '[]'::jsonb))
  loop
    -- Fila del formulario sin ningun dato: no se guarda.
    if nullif(v_aislacion ->> 'largo_mm', '') is not null
       or nullif(v_aislacion ->> 'ancho_mm', '') is not null
       or nullif(v_aislacion ->> 'cantidad', '') is not null
       or nullif(v_aislacion ->> 'descripcion', '') is not null then
      insert into public.motor_aislacion (
        motor_id, orden, largo_mm, ancho_mm, cantidad, descripcion
      ) values (
        v_motor_id,
        v_orden,
        nullif(v_aislacion ->> 'largo_mm', '')::numeric,
        nullif(v_aislacion ->> 'ancho_mm', '')::numeric,
        nullif(v_aislacion ->> 'cantidad', '')::smallint,
        nullif(v_aislacion ->> 'descripcion', '')
      );
      v_orden := v_orden + 1;
    end if;
  end loop;

  return v_motor_id;
end;
$$;

comment on function public.guardar_motor_completo(jsonb) is
  'Alta o edicion de un motor con sus circuitos, secciones y aislaciones '
  'en una sola transaccion. Devuelve el uuid del motor.';


-- ---------- Lectura completa ----------

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
    'aislaciones', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.orden)
      from public.motor_aislacion a where a.motor_id = m.id
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
