import { supabase } from './supabase';

/**
 * Dos estados, no cinco.
 *
 * Antes habia borrador, enviado, aceptado, rechazado y vencido. Cuatro
 * de esos dependen de que alguien vuelva a marcarlos despues de hablar
 * con el cliente, y eso no ocurre: el presupuesto se arma, se manda y
 * ahi termina. Quedaban todos en "borrador" para siempre, que ademas se
 * leia como "sin terminar".
 *
 * "Vencido" no se guarda a mano: sale de la fecha de emision mas los
 * dias de validez. Ver estadoDe().
 */
export const ESTADOS = ['creado', 'vencido'];

export const ETIQUETA_ESTADO = {
  creado: 'Creado',
  vencido: 'Vencido',
};

export const COLOR_ESTADO = {
  creado: 'var(--accent)',
  vencido: 'var(--warning)',
};

const SELECT = `
  id, numero, estado, subtotal, descuento, iva_pct, total,
  vigencia_dias, notas, token_publico, pdf_path, creado_en,
  cliente_id, cliente_nombre, cliente_documento, cliente_documento_tipo,
  cliente_condicion_fiscal,
  cliente:cliente_id (id, nombre, telefono, email, documento, documento_tipo, condicion_fiscal, tipo_persona, direccion),
  reparacion:reparacion_id (id, numero)
`;

export async function listarPresupuestos({ estado = '', texto = '' } = {}) {
  let q = supabase.from('presupuesto').select(SELECT, { count: 'exact' });
  if (texto.trim()) {
    const n = Number(texto.replace(/\D/g, ''));
    if (Number.isFinite(n) && n > 0) q = q.eq('numero', n);
  }
  q = q.order('creado_en', { ascending: false }).limit(100);

  const { data, error, count } = await q;
  if (error) throw error;

  // El filtro de estado se aplica aca y no en la consulta porque
  // "vencido" se calcula con la fecha: la columna diria "creado" en un
  // presupuesto de hace tres meses y quedaria afuera del filtro.
  const todos = data ?? [];
  const filtrados = estado ? todos.filter((p) => estadoDe(p) === estado) : todos;

  return { presupuestos: filtrados, total: count ?? 0 };
}

export async function obtenerPresupuesto(id) {
  const { data, error } = await supabase
    .from('presupuesto').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: items, error: e2 } = await supabase
    .from('presupuesto_item')
    .select('id, orden, descripcion, cantidad, precio_unit, subtotal, catalogo_item_id')
    .eq('presupuesto_id', id)
    .order('orden');
  if (e2) throw e2;

  return { ...data, items: items ?? [] };
}

export async function crearPresupuesto(datos) {
  const { data, error } = await supabase
    .from('presupuesto')
    .insert({
      cliente_id: datos.cliente_id || null,
      reparacion_id: datos.reparacion_id || null,
      iva_pct: Number(datos.iva_pct ?? 0),
      descuento: Number(datos.descuento ?? 0),
      vigencia_dias: Number(datos.vigencia_dias ?? 15),
      notas: datos.notas?.trim() || null,
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarPresupuesto(id, cambios) {
  const fila = {};
  for (const k of ['cliente_id', 'reparacion_id', 'estado', 'notas']) {
    if (k in cambios) fila[k] = cambios[k] || null;
  }
  for (const k of ['iva_pct', 'descuento', 'vigencia_dias']) {
    if (k in cambios) fila[k] = Number(cambios[k] ?? 0);
  }

  const { data, error } = await supabase
    .from('presupuesto').update(fila).eq('id', id).select(SELECT).single();
  if (error) throw error;
  return data;
}

export async function eliminarPresupuesto(id) {
  const { error } = await supabase.from('presupuesto').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Reemplaza los items completos.
 *
 * Se borra y se reinserta en vez de diferenciar item por item: son unos
 * pocos por presupuesto, y el reemplazo elimina toda una clase de bugs
 * de sincronizacion parcial. Los totales los recalcula un trigger, asi
 * que no hay que tocarlos aca.
 */
export async function guardarItems(presupuestoId, items) {
  const { error: eBorrar } = await supabase
    .from('presupuesto_item').delete().eq('presupuesto_id', presupuestoId);
  if (eBorrar) throw eBorrar;

  const filas = items
    .filter((i) => i.descripcion?.trim())
    .map((i, orden) => ({
      presupuesto_id: presupuestoId,
      orden,
      catalogo_item_id: i.catalogo_item_id || null,
      descripcion: i.descripcion.trim(),
      cantidad: Number(i.cantidad) || 1,
      precio_unit: Number(i.precio_unit) || 0,
    }));

  if (filas.length === 0) return [];

  const { data, error } = await supabase
    .from('presupuesto_item').insert(filas).select();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------
//  Catalogo de precios
// ---------------------------------------------------------------

export async function listarCatalogo({ texto = '', soloActivos = true } = {}) {
  let q = supabase.from('catalogo_item')
    .select('id, codigo, descripcion, precio, unidad, activo');
  if (soloActivos) q = q.eq('activo', true);
  if (texto.trim()) q = q.ilike('descripcion', `%${texto.trim()}%`);
  q = q.order('descripcion').limit(200);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function guardarItemCatalogo(item) {
  const fila = {
    codigo: item.codigo?.trim() || null,
    descripcion: item.descripcion.trim(),
    precio: Number(item.precio) || 0,
    unidad: item.unidad?.trim() || 'u',
    activo: item.activo !== false,
  };
  const consulta = item.id
    ? supabase.from('catalogo_item').update(fila).eq('id', item.id)
    : supabase.from('catalogo_item').insert(fila);

  const { data, error } = await consulta.select().single();
  if (error) throw error;
  return data;
}

export async function eliminarItemCatalogo(id) {
  const { error } = await supabase.from('catalogo_item').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------
//  Configuracion del taller
// ---------------------------------------------------------------

export async function obtenerConfiguracion() {
  const { data, error } = await supabase
    .from('configuracion').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function guardarConfiguracion(cambios) {
  const { data, error } = await supabase
    .from('configuracion').update(cambios).eq('id', 1).select().single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------
//  Calculos
// ---------------------------------------------------------------

/**
 * Total en vivo mientras se edita, para no tener que guardar para ver
 * cuanto da. La cuenta que vale es la del trigger de la base: esta es
 * solo para mostrar, y usa la misma formula.
 */
export function calcularTotales({ items = [], descuento = 0, ivaPct = 0 }) {
  const subtotal = items.reduce(
    (a, i) => a + (Number(i.cantidad) || 0) * (Number(i.precio_unit) || 0), 0,
  );
  const neto = subtotal - (Number(descuento) || 0);
  const iva = neto * ((Number(ivaPct) || 0) / 100);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    neto: Math.round(neto * 100) / 100,
    iva: Math.round(iva * 100) / 100,
    total: Math.round((neto + iva) * 100) / 100,
  };
}

export const pesos = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
}).format(Number(n) || 0);

/** Fecha hasta la que vale el presupuesto. */
export function venceEl(presupuesto) {
  if (!presupuesto?.creado_en) return null;
  const d = new Date(presupuesto.creado_en);
  d.setDate(d.getDate() + (presupuesto.vigencia_dias ?? 15));
  return d;
}

export const estaVencido = (p) => {
  const v = venceEl(p);
  if (!v) return false;
  // Comparar dia contra dia, no instante contra instante: el presupuesto
  // vale todo el dia de vencimiento, no hasta la hora en que se emitio.
  return v.toLocaleDateString('sv-SE') < new Date().toLocaleDateString('sv-SE');
};

/**
 * El estado que se muestra.
 *
 * Sale de la fecha, no de la columna: si dependiera de la columna,
 * "vencido" solo aparecerria cuando alguien abriera el presupuesto y
 * algo lo actualizara, y hasta entonces un presupuesto de hace tres
 * meses se seguiria mostrando como vigente.
 */
export const estadoDe = (p) => (estaVencido(p) ? 'vencido' : 'creado');

export async function generarPdf(presupuestoId) {
  const { data, error } = await supabase.functions.invoke('presupuesto-pdf', {
    body: { presupuesto_id: presupuestoId },
  });
  if (error) {
    let detalle = null;
    try { detalle = (await error.context?.json?.())?.error; } catch { /* sin cuerpo */ }
    throw new Error(detalle ?? error.message ?? 'No se pudo generar el PDF.');
  }
  return data; // { url, path }
}
