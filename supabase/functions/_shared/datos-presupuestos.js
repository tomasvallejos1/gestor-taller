/**
 * Presupuestos y clientes, compartido entre la web y el bot.
 *
 * Mismo patron que datos-motores.js: el cliente de Supabase entra por
 * parametro, asi el codigo corre igual en el navegador con la sesion del
 * usuario que en Deno con service_role.
 *
 * Los totales NO se calculan aca. Los mantiene un trigger en la base, y
 * duplicar la formula en JavaScript es como terminas con un PDF que dice
 * una cosa y la pantalla otra.
 */

import { revisarDocumento, soloDigitos } from './fiscal.js';

const SELECT = `
  id, numero, punto_venta, estado, subtotal, descuento, iva_pct, total,
  vigencia_dias, notas, token_publico, pdf_path, creado_en,
  cliente_id, cliente_nombre
`;

// ---------------------------------------------------------------
//  Clientes
// ---------------------------------------------------------------

/**
 * Clientes con un nombre parecido, por trigramas (pg_trgm).
 *
 * A diferencia de buscarClientes (ilike, substring exacto), esto agarra
 * errores de tipeo: "Pablo Magneri" contra "Pablo Magoneri" da ~0.7 de
 * similitud aunque ninguno sea substring del otro. Pensado para avisar
 * "ya existe alguien parecido" antes de crear un cliente duplicado.
 */
export async function clientesSimilares(cliente, nombre, umbral = 0.3) {
  const n = String(nombre ?? '').trim();
  if (!n) return [];
  const { data, error } = await cliente.rpc('clientes_similares', { p_nombre: n, p_umbral: umbral });
  if (error) throw error;
  return data ?? [];
}

/** Busca por nombre. Pensado para elegir uno, no para listar todo. */
export async function buscarClientes(cliente, texto, limite = 8) {
  const t = String(texto ?? '').trim();
  if (!t) return [];

  const { data, error } = await cliente
    .from('cliente')
    .select('id, nombre, telefono, documento, documento_tipo, condicion_fiscal')
    .ilike('nombre', `%${t}%`)
    .order('nombre')
    .limit(limite);
  if (error) throw error;
  return data ?? [];
}

/**
 * Alta de cliente con sus datos fiscales.
 *
 * El documento y la condicion frente al IVA salen impresos en el
 * presupuesto que recibe el cliente, asi que se validan antes de
 * guardar: revisarDocumento aplica el modulo 11 del CUIT, el mismo que
 * usa el trigger de la base. Un CUIT con un digito cambiado se guarda
 * sin chistar y despues aparece en un papel que ya se entrego.
 *
 * @param {object} cliente
 * @param {{nombre: string, telefono?: string | null,
 *          tipo_persona?: string, documento?: string | null,
 *          documento_tipo?: string | null, condicion_fiscal?: string}} datos
 */
export async function crearCliente(cliente, datos) {
  const n = String(datos?.nombre ?? '').trim();
  if (!n) throw new Error('El cliente necesita un nombre.');

  const documento = soloDigitos(datos.documento);
  const problema = revisarDocumento({
    tipoPersona: datos.tipo_persona,
    tipoDocumento: datos.documento_tipo,
    documento,
  });
  if (problema) throw new Error(problema);

  const { data, error } = await cliente
    .from('cliente')
    .insert({
      nombre: n,
      telefono: datos.telefono?.trim() || null,
      tipo_persona: datos.tipo_persona || 'fisica',
      documento: documento || null,
      documento_tipo: documento ? datos.documento_tipo : null,
      condicion_fiscal: datos.condicion_fiscal || 'consumidor_final',
    })
    .select('id, nombre, telefono, tipo_persona, documento, documento_tipo, condicion_fiscal')
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------
//  Presupuestos
// ---------------------------------------------------------------

export async function crearPresupuesto(cliente, datos = {}) {
  const { data, error } = await cliente
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

/**
 * Reemplaza los renglones completos.
 *
 * Se borra y se reinserta en vez de diferenciar item por item: son unos
 * pocos por presupuesto, y el reemplazo elimina toda una clase de bugs de
 * sincronizacion parcial.
 */
export async function guardarItems(cliente, presupuestoId, items) {
  const { error: eBorrar } = await cliente
    .from('presupuesto_item').delete().eq('presupuesto_id', presupuestoId);
  if (eBorrar) throw eBorrar;

  const filas = (items ?? [])
    .filter((i) => String(i.descripcion ?? '').trim())
    .map((i, orden) => ({
      presupuesto_id: presupuestoId,
      orden,
      catalogo_item_id: i.catalogo_item_id || null,
      descripcion: String(i.descripcion).trim(),
      cantidad: Number(i.cantidad) || 1,
      precio_unit: Number(i.precio_unit) || 0,
    }));

  if (filas.length === 0) return [];

  const { data, error } = await cliente
    .from('presupuesto_item').insert(filas).select();
  if (error) throw error;
  return data;
}

/** Relee el presupuesto ya con los totales que dejo el trigger. */
export async function obtenerPresupuesto(cliente, id) {
  const { data, error } = await cliente
    .from('presupuesto').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export const pesos = (n) => {
  const v = Number(n) || 0;
  const [ent, dec] = v.toFixed(2).split('.');
  return `$ ${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
};

/** "0001-00000012", el numero que el cliente ve en el papel. */
export const numeroComprobante = (p) =>
  `${String(p?.punto_venta ?? 1).padStart(4, '0')}-${String(p?.numero ?? 0).padStart(8, '0')}`;

/**
 * Nombre del archivo que recibe la persona.
 *
 * "presupuesto-0001-00000012.pdf": se ordena solo en la galeria del
 * celular y se busca por numero. Sin espacios ni acentos, que WhatsApp y
 * los clientes de mail tratan distinto.
 */
export const nombreArchivo = (p) => `presupuesto-${numeroComprobante(p)}.pdf`;
