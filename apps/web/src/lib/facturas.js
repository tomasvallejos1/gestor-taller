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

/**
 * Carga un unico renglon "Servicio" por el importe de la cobranza de la
 * orden, para poder facturar un trabajo que se hizo sin presupuesto.
 *
 * La pantalla lo pide confirmar antes: es plata que baja sola desde otra
 * tabla a un comprobante fiscal, y eso tiene que decidirlo alguien
 * mirando el numero.
 */
export async function completarConServicio(facturaId) {
  const { data, error } = await supabase.rpc('completar_factura_con_servicio', {
    p_factura_id: facturaId,
  });
  if (error) throw error;
  return Number(data);
}

/**
 * Pistas para los codigos de ARCA que se ven seguido y que no se
 * entienden solos.
 *
 * "Error interno de base de datos" leido tal cual manda a revisar el
 * comprobante, que es justo lo unico que no hay que tocar: el problema
 * esta del otro lado y la unica accion es esperar.
 */
const PISTA_ARCA = {
  501: 'Es un problema interno de ARCA, no del comprobante: reintentá en un rato.',
  10015: 'El documento del cliente no figura en el padron de ARCA. '
    + 'En homologacion es normal: el padron de pruebas tiene muy poco cargado.',
  10016: 'El numero de comprobante no es el que sigue. Probá "Verificar en ARCA" antes de reintentar.',
};

/**
 * El rechazo de ARCA en una linea legible.
 *
 * Viene como { Err: [{ Code, Msg }] } --u Obs, que son avisos que no
 * frenan la autorizacion--. Volcar el JSON crudo en pantalla obliga a
 * leer llaves y comillas para encontrar una frase en castellano que ya
 * venia escrita adentro.
 */
export function mensajeArca(errores) {
  if (!errores) return '';
  const lista = errores.Err ?? errores.Obs ?? (Array.isArray(errores) ? errores : null);
  if (!lista?.length) {
    return typeof errores === 'string' ? errores : JSON.stringify(errores);
  }
  return lista
    .map((e) => {
      const pista = PISTA_ARCA[e.Code];
      return `${e.Code}: ${e.Msg}${pista ? ` — ${pista}` : ''}`;
    })
    .join(' · ');
}

async function invocar(nombre, cuerpo) {
  const { data, error } = await supabase.functions.invoke(nombre, { body: cuerpo });
  if (error) {
    let respuesta = null;
    try { respuesta = await error.context?.json?.(); } catch { /* sin cuerpo */ }
    // El "detalle" es lo que dijo ARCA. Sin el, el aviso de arriba de la
    // pantalla dice "rechazo el comprobante" y el motivo queda a tres
    // pantallazos de scroll, en la tarjeta de la factura.
    const detalle = mensajeArca(respuesta?.detalle);
    const base = respuesta?.error ?? error.message ?? 'Ocurrio un error.';
    throw new Error(detalle ? `${base} ${detalle}` : base);
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
