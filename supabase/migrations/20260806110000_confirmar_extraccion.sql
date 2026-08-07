-- =============================================================
--  Confirmacion y descarte de una ficha extraida por foto
--
--  La confirmacion tiene que ser atomica sobre CUATRO cosas: el motor,
--  sus circuitos, la foto de la ficha, y el estado de la extraccion. Si
--  se hicieran por separado desde el cliente, un corte a mitad dejaria
--  una extraccion marcada como confirmada sin motor detras, o un motor
--  sin la foto que lo respalda.
-- =============================================================

create or replace function public.confirmar_extraccion(
  p_extraccion_id uuid,
  p_datos jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_extraccion public.ficha_extraccion;
  v_motor_id   uuid;
begin
  select * into v_extraccion
  from public.ficha_extraccion
  where id = p_extraccion_id;

  if not found then
    raise exception 'No existe esa extraccion';
  end if;

  if v_extraccion.estado = 'confirmada' then
    raise exception 'Esa ficha ya fue confirmada (motor %)', v_extraccion.motor_id;
  end if;

  if v_extraccion.estado <> 'revision' then
    raise exception 'La extraccion esta en estado "%" y todavia no se puede confirmar',
      v_extraccion.estado;
  end if;

  -- Reusa el guardado transaccional del formulario manual: la ficha
  -- confirmada tiene que quedar identica a una cargada a mano.
  v_motor_id := public.guardar_motor_completo(p_datos);

  -- La imagen no se copia ni se mueve: ya esta en el bucket, se
  -- referencia desde el motor. Queda marcada como es_ficha para que sea
  -- la que devuelve el bot y la que se compara al revisar.
  insert into public.motor_foto (motor_id, storage_path, es_ficha, orden)
  values (v_motor_id, v_extraccion.storage_path, true, 0);

  update public.ficha_extraccion
     set estado = 'confirmada',
         motor_id = v_motor_id
   where id = p_extraccion_id;

  return v_motor_id;
end;
$$;

comment on function public.confirmar_extraccion(uuid, jsonb) is
  'Convierte una extraccion revisada en una ficha real. Devuelve el uuid '
  'del motor creado. La foto original queda enganchada como es_ficha.';


create or replace function public.descartar_extraccion(p_extraccion_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_estado public.estado_extraccion;
begin
  select estado into v_estado
  from public.ficha_extraccion where id = p_extraccion_id;

  if not found then
    raise exception 'No existe esa extraccion';
  end if;

  if v_estado = 'confirmada' then
    raise exception 'No se puede descartar una extraccion ya confirmada';
  end if;

  -- Se borra la fila entera en vez de marcarla: una extraccion
  -- descartada no aporta nada y su imagen la limpia el cliente.
  delete from public.ficha_extraccion where id = p_extraccion_id;
end;
$$;


-- ---------- Pendientes de revision ----------
-- Lo que el admin tiene en la bandeja. Se expone como funcion para no
-- traer el datos_json completo (que es grande) en el listado.

create or replace function public.extracciones_pendientes()
returns table (
  id            uuid,
  estado        public.estado_extraccion,
  origen        public.origen_extraccion,
  storage_path  text,
  descripcion   text,
  error         text,
  creado_en     timestamptz
)
language sql
security invoker
stable
as $$
  select e.id, e.estado, e.origen, e.storage_path,
         e.datos_json #>> '{descripcion,valor}',
         e.error, e.creado_en
  from public.ficha_extraccion e
  where e.estado in ('pendiente', 'procesando', 'revision', 'error')
  order by e.creado_en desc
  limit 50;
$$;

grant execute on function public.extracciones_pendientes() to authenticated;
