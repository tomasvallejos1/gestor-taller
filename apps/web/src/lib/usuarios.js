import { supabase } from './supabase';

/** Lista completa con email y ultimo acceso. Solo responde a un super. */
export async function listarUsuarios() {
  const { data, error } = await supabase.rpc('listar_usuarios');
  if (error) throw error;
  return data ?? [];
}

/**
 * Cambia rol, nombre o estado. Los campos en null no se tocan.
 * La base rechaza quitarse el propio rol de super o dejar el sistema sin
 * ningun administrador activo.
 */
export async function actualizarUsuario(id, cambios) {
  const { error } = await supabase.rpc('actualizar_usuario', {
    p_id: id,
    p_rol: cambios.rol ?? null,
    p_activo: cambios.activo ?? null,
    p_nombre: cambios.nombre ?? null,
  });
  if (error) throw error;
}

/**
 * Alta de usuario. Pasa por una Edge Function porque necesita la clave
 * service_role, que no puede vivir en el navegador.
 * Devuelve la clave temporal para pasarsela a la persona.
 */
export async function crearUsuario({ email, nombre, rol }) {
  const { data, error } = await supabase.functions.invoke('crear-usuario', {
    body: { email, nombre, rol },
  });
  if (error) {
    // El detalle util viene en el cuerpo, no en el mensaje del error.
    let detalle = null;
    try { detalle = (await error.context?.json?.())?.error; } catch { /* sin cuerpo */ }
    throw new Error(detalle ?? error.message ?? 'No se pudo crear el usuario.');
  }
  return data;
}

/** Datos propios. El nombre vive en `perfil`; email y clave en Auth. */
export async function actualizarPerfilPropio({ nombre }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesion vencida.');
  const { error } = await supabase.from('perfil').update({ nombre }).eq('id', user.id);
  if (error) throw error;
}

export async function cambiarEmail(email) {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
}

export async function cambiarClave(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
