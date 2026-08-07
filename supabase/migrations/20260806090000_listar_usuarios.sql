-- =============================================================
--  Listado de usuarios para el panel de administracion
--
--  El email vive en auth.users, que no es consultable desde el cliente:
--  esa tabla tiene hashes de contraseña y tokens de recuperacion, y
--  Supabase no la expone por PostgREST justamente por eso.
--
--  Esta funcion junta lo poco que hace falta (perfil + email) y nada mas.
--  Es SECURITY DEFINER para poder leer auth.users, asi que el chequeo de
--  permiso va DENTRO: sin el, cualquier usuario autenticado obtendria el
--  padron completo de correos del taller.
-- =============================================================

create or replace function public.listar_usuarios()
returns table (
  id             uuid,
  nombre         text,
  email          text,
  rol            public.rol_usuario,
  telegram_id    bigint,
  activo         boolean,
  ultimo_acceso  timestamptz,
  creado_en      timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.es_super() then
    raise exception 'Solo un administrador puede listar usuarios'
      using errcode = '42501';
  end if;

  return query
    select p.id, p.nombre, u.email::text, p.rol, p.telegram_id, p.activo,
           u.last_sign_in_at, p.creado_en
    from public.perfil p
    join auth.users u on u.id = p.id
    order by p.creado_en;
end;
$$;

revoke execute on function public.listar_usuarios() from anon;
grant execute on function public.listar_usuarios() to authenticated;


-- ---------- Cambio de rol y activacion ----------
-- La policy `perfil_super_todo` ya permite el UPDATE directo, pero se
-- expone como funcion para poder frenar dos casos que dejarian el
-- sistema sin administrador.

create or replace function public.actualizar_usuario(
  p_id uuid,
  p_rol public.rol_usuario default null,
  p_activo boolean default null,
  p_nombre text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supers_restantes integer;
begin
  if not public.es_super() then
    raise exception 'Solo un administrador puede modificar usuarios'
      using errcode = '42501';
  end if;

  -- Quitarse a uno mismo el rol de super deja el sistema sin quien
  -- administre usuarios, y no hay forma de recuperarlo desde la app.
  if p_id = auth.uid() and p_rol is not null and p_rol <> 'super' then
    raise exception 'No podes quitarte a vos mismo el rol de administrador';
  end if;

  if p_id = auth.uid() and p_activo = false then
    raise exception 'No podes desactivar tu propia cuenta';
  end if;

  -- Tampoco se puede degradar al ultimo super que queda.
  if (p_rol is not null and p_rol <> 'super') or p_activo = false then
    select count(*) into v_supers_restantes
    from public.perfil
    where rol = 'super' and activo and id <> p_id;

    if v_supers_restantes = 0 then
      raise exception 'Tiene que quedar al menos un administrador activo';
    end if;
  end if;

  update public.perfil set
    rol    = coalesce(p_rol, rol),
    activo = coalesce(p_activo, activo),
    nombre = coalesce(nullif(p_nombre, ''), nombre)
  where id = p_id;

  if not found then
    raise exception 'No existe ese usuario';
  end if;
end;
$$;

revoke execute on function public.actualizar_usuario(uuid, public.rol_usuario, boolean, text) from anon;
grant execute on function public.actualizar_usuario(uuid, public.rol_usuario, boolean, text) to authenticated;
