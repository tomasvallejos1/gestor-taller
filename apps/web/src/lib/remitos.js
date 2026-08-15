import { supabase } from './supabase';
import { ETIQUETA_MEDIO_PAGO } from '@shared/comprobante-modelo.js';

export { ETIQUETA_MEDIO_PAGO };

export const MEDIOS_PAGO = Object.entries(ETIQUETA_MEDIO_PAGO)
  .map(([valor, etiqueta]) => ({ valor, etiqueta }));

const SELECT = `
  id, numero, punto_venta, reparacion_id, presupuesto_id, cliente_id,
  fecha, medio_pago, subtotal, descuento, iva_pct, total, notas,
  token_publico, pdf_path, creado_en,
  cliente:cliente_id (id, nombre, telefono, email, documento, documento_tipo, condicion_fiscal, direccion)
`;

export async function obtenerRemito(id) {
  const { data, error } = await supabase
    .from('remito').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: items, error: e2 } = await supabase
    .from('remito_item')
    .select('id, orden, descripcion, cantidad, precio_unit, subtotal, catalogo_item_id')
    .eq('remito_id', id)
    .order('orden');
  if (e2) throw e2;

  return { ...data, items: items ?? [] };
}

/**
 * Crea el remito de una orden, precargando los renglones del ultimo
 * presupuesto que tenga (o de uno puntual si se pasa `presupuestoId`).
 * La cabecera y los renglones se crean juntos del lado de la base, para
 * que un fallo a mitad de camino no deje un numero correlativo
 * consumido y vacio.
 */
export async function crearDesdeReparacion(reparacionId, presupuestoId = null) {
  const { data, error } = await supabase.rpc('crear_remito_desde_reparacion', {
    p_reparacion_id: reparacionId,
    p_presupuesto_id: presupuestoId,
  });
  if (error) throw error;
  return obtenerRemito(data);
}

export async function actualizarRemito(id, cambios) {
  const fila = {};
  for (const k of ['medio_pago', 'notas']) {
    if (k in cambios) fila[k] = cambios[k] || null;
  }
  for (const k of ['descuento', 'iva_pct']) {
    if (k in cambios) fila[k] = Number(cambios[k] ?? 0);
  }

  const { data, error } = await supabase
    .from('remito').update(fila).eq('id', id).select(SELECT).single();
  if (error) throw error;
  return data;
}

/** Reemplaza los renglones completos, igual que guardarItems de presupuestos. */
export async function guardarItems(remitoId, items) {
  const { error: eBorrar } = await supabase
    .from('remito_item').delete().eq('remito_id', remitoId);
  if (eBorrar) throw eBorrar;

  const filas = items
    .filter((i) => i.descripcion?.trim())
    .map((i, orden) => ({
      remito_id: remitoId,
      orden,
      catalogo_item_id: i.catalogo_item_id || null,
      descripcion: i.descripcion.trim(),
      cantidad: Number(i.cantidad) || 1,
      precio_unit: Number(i.precio_unit) || 0,
    }));

  if (filas.length === 0) return [];

  const { data, error } = await supabase
    .from('remito_item').insert(filas).select();
  if (error) throw error;
  return data;
}

export async function generarPdf(remitoId) {
  const { data, error } = await supabase.functions.invoke('remito-pdf', {
    body: { remito_id: remitoId },
  });
  if (error) {
    let detalle = null;
    try { detalle = (await error.context?.json?.())?.error; } catch { /* sin cuerpo */ }
    throw new Error(detalle ?? error.message ?? 'No se pudo generar el PDF.');
  }
  return data; // { url, path }
}
