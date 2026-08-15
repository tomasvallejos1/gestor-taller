import { supabase } from './supabase';

export const ETIQUETA_ESTADO_FACTURA = {
  pendiente: 'Pendiente',
  autorizada: 'Autorizada',
  rechazada: 'Rechazada',
  anulada: 'Anulada',
};

export const COLOR_ESTADO_FACTURA = {
  pendiente: 'var(--text-light)',
  autorizada: 'var(--success, #10b981)',
  rechazada: 'var(--danger)',
  anulada: 'var(--text-light)',
};

const LETRA_POR_TIPO = { 1: 'A', 6: 'B', 11: 'C', 51: 'M' };
export const letraFactura = (cbteTipo) => LETRA_POR_TIPO[cbteTipo] ?? 'C';

const SELECT = `
  id, reparacion_id, remito_id, cliente_id, estado,
  cbte_tipo, punto_venta, numero, cbte_fecha,
  subtotal, descuento, iva_pct, imp_neto, imp_iva, total,
  cae, cae_vencimiento, arca_resultado, arca_observaciones, arca_errores,
  token_publico, pdf_path, notas, creado_en,
  cliente:cliente_id (id, nombre, documento, documento_tipo)
`;

export async function listarFacturas({ estado = '' } = {}) {
  let q = supabase.from('factura').select(SELECT, { count: 'exact' });
  if (estado) q = q.eq('estado', estado);
  q = q.order('creado_en', { ascending: false }).limit(100);

  const { data, error, count } = await q;
  if (error) throw error;
  return { facturas: data ?? [], total: count ?? 0 };
}

export async function obtenerFactura(id) {
  const { data, error } = await supabase
    .from('factura').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: items, error: e2 } = await supabase
    .from('factura_item')
    .select('id, orden, descripcion, cantidad, precio_unit, subtotal')
    .eq('factura_id', id)
    .order('orden');
  if (e2) throw e2;

  return { ...data, items: items ?? [] };
}

/** Crea la factura en 'pendiente', copiando cliente y renglones del
 *  remito. No pide el CAE todavia: eso lo hace `emitir()`. */
export async function crearDesdeRemito(remitoId) {
  const { data, error } = await supabase.rpc('crear_factura_desde_remito', {
    p_remito_id: remitoId,
  });
  if (error) throw error;
  return obtenerFactura(data);
}

async function invocar(nombre, cuerpo) {
  const { data, error } = await supabase.functions.invoke(nombre, { body: cuerpo });
  if (error) {
    let detalle = null;
    try { detalle = (await error.context?.json?.())?.error; } catch { /* sin cuerpo */ }
    throw new Error(detalle ?? error.message ?? 'Ocurrio un error.');
  }
  return data;
}

/** Le pide el CAE a ARCA. Ver el protocolo completo en
 *  supabase/functions/factura-emitir/index.ts. */
export const emitir = (facturaId) => invocar('factura-emitir', { factura_id: facturaId });

/** Boton "Verificar en ARCA": para una factura pendiente con numero ya
 *  anotado, pregunta si ARCA la autorizo sin volver a pedir un CAE. */
export const reconciliar = (facturaId) => invocar('factura-reconciliar', { factura_id: facturaId });

export const generarPdf = (facturaId) => invocar('factura-pdf', { factura_id: facturaId });
