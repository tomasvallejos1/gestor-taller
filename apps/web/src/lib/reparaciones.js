import { supabase } from './supabase';

export const ESTADOS = [
  'ingresado', 'en_proceso', 'esperando_repuesto', 'terminado', 'entregado', 'cancelado',
];

export const ETIQUETA_ESTADO = {
  ingresado: 'Ingresado',
  en_proceso: 'En proceso',
  esperando_repuesto: 'Esperando repuesto',
  terminado: 'Terminado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

/** Color por estado, en variables del tema para que respete el modo oscuro. */
export const COLOR_ESTADO = {
  ingresado: 'var(--text-light)',
  en_proceso: 'var(--accent)',
  esperando_repuesto: 'var(--warning, #d97706)',
  terminado: 'var(--success, #10b981)',
  entregado: 'var(--success, #10b981)',
  cancelado: 'var(--danger)',
};

/** Estados en los que el motor todavia esta en el taller. */
export const ABIERTOS = ['ingresado', 'en_proceso', 'esperando_repuesto', 'terminado'];

const SELECT = `
  id, numero, estado, ingreso, egreso, notas, creado_en,
  cliente:cliente_id (id, nombre, telefono),
  motor:motor_id (id, nro_motor, descripcion, marca)
`;

export async function listarReparaciones({ estado = '', texto = '', soloAbiertas = false } = {}) {
  let q = supabase.from('reparacion').select(SELECT, { count: 'exact' });

  if (estado) q = q.eq('estado', estado);
  else if (soloAbiertas) q = q.in('estado', ABIERTOS);

  if (texto.trim()) {
    const n = Number(texto.replace(/\D/g, ''));
    if (Number.isFinite(n) && n > 0) q = q.eq('numero', n);
  }

  q = q.order('ingreso', { ascending: false }).limit(100);

  const { data, error, count } = await q;
  if (error) throw error;
  return { reparaciones: data ?? [], total: count ?? 0 };
}

export async function guardarReparacion(reparacion) {
  const fila = {
    motor_id: reparacion.motor_id || null,
    cliente_id: reparacion.cliente_id || null,
    estado: reparacion.estado,
    ingreso: reparacion.ingreso || null,
    // Al marcar entregado sin fecha, se asume hoy: nadie la carga a mano.
    egreso: reparacion.egreso
      || (['entregado'].includes(reparacion.estado) ? new Date().toISOString().slice(0, 10) : null),
    notas: reparacion.notas?.trim() || null,
  };

  const consulta = reparacion.id
    ? supabase.from('reparacion').update(fila).eq('id', reparacion.id)
    : supabase.from('reparacion').insert(fila);

  const { data, error } = await consulta.select(SELECT).single();
  if (error) throw error;
  return data;
}

export async function cambiarEstado(id, estado) {
  const fila = { estado };
  if (estado === 'entregado') fila.egreso = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from('reparacion').update(fila).eq('id', id);
  if (error) throw error;
}

export async function eliminarReparacion(id) {
  const { error } = await supabase.from('reparacion').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Consulta publica por numero de orden (pagina /estado).
 *
 * Va contra una funcion SECURITY DEFINER que devuelve solo estado y
 * fechas. No se consulta la tabla directamente: abrirla a anonimo para
 * que un cliente vea su motor expondria el padron completo de clientes y
 * las notas internas del taller.
 */
export async function consultarEstadoPublico(numero) {
  const n = Number(String(numero).replace(/\D/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;

  const { data, error } = await supabase.rpc('consultar_estado', { p_numero: n });
  if (error) throw error;
  return data?.[0] ?? null;
}
