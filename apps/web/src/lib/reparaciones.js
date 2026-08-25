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

/**
 * El estado que sigue en el recorrido normal de una orden.
 *
 * Una reparacion avanza casi siempre al casillero de al lado. Tener
 * que abrir un desplegable de seis opciones y buscar cual venia
 * despues son tres toques para la accion que mas se repite en el dia.
 * Con esto, avanzar es uno solo.
 *
 * `esperando_repuesto` vuelve a `en_proceso`: cuando el repuesto
 * llega, el trabajo se retoma. `entregado` y `cancelado` no tienen
 * siguiente --son finales-- y ahi el boton no se ofrece.
 */
export const SIGUIENTE_ESTADO = {
  ingresado: 'en_proceso',
  en_proceso: 'terminado',
  esperando_repuesto: 'en_proceso',
  terminado: 'entregado',
};

/**
 * Las vistas del listado.
 *
 * No son los seis estados del enum: son las cuatro preguntas que el
 * taller se hace parado frente al banco. "Para entregar" y "Deudores"
 * no existen como estado en ningun lado --son cruces de estado y
 * cobranza-- y son justamente las dos listas que se miran todos los
 * dias. Los estados sueltos siguen estando, en el panel de filtros.
 */
export const VISTAS = [
  { id: 'taller', etiqueta: 'En el taller' },
  { id: 'entregar', etiqueta: 'Para entregar' },
  { id: 'deudores', etiqueta: 'Deudores' },
  { id: 'entregadas', etiqueta: 'Entregadas' },
  { id: 'todas', etiqueta: 'Todas' },
];

// La cobranza viene embebida y no como columnas de `reparacion` porque
// es una tabla aparte, solo de editores: a un lector le vuelve vacia y
// la pantalla se dibuja igual, sin importes.
const armar = ({ clienteInner = false, cobranzaInner = false } = {}) => `
  id, numero, estado, ingreso, egreso, problema, diagnostico, notas, creado_en,
  cliente:cliente_id${clienteInner ? '!inner' : ''} (id, nombre, telefono),
  motor:motor_id (id, nro_motor, descripcion, marca),
  cobranza${cobranzaInner ? '!inner' : ''} (importe, importe_doc, total, pagado, cobrado, saldo, estado)
`;

const SELECT = armar();

/**
 * @param {object} opciones
 * @param {string} opciones.vista  una de VISTAS
 * @param {string} opciones.estado estado exacto; pisa el de la vista
 * @param {string} opciones.pago   estado de cobranza exacto
 * @param {string} opciones.texto  numero de orden o apellido
 */
export async function listarReparaciones({
  vista = 'todas', estado = '', pago = '', texto = '',
} = {}) {
  const t = texto.trim();
  const esNumero = /^\d+$/.test(t);
  // PostgREST solo deja filtrar sobre una relacion embebida cuando esa
  // relacion se pide como inner join. El resto del tiempo van como left
  // join: una orden sin cliente --o sin fila de cobranza-- tiene que
  // seguir apareciendo en la lista.
  const buscaCliente = Boolean(t) && !esNumero;
  const filtraPago = Boolean(pago) || vista === 'deudores';

  // Sin `count`: nadie muestra el total y pedirlo obliga a Postgres a
  // recorrer entero el conjunto filtrado ademas de traer la pagina. La
  // pantalla cuenta las filas que recibe, que es lo que dibuja.
  let q = supabase
    .from('reparacion')
    .select(armar({ clienteInner: buscaCliente, cobranzaInner: filtraPago }));

  if (estado) q = q.eq('estado', estado);
  else if (vista === 'taller') q = q.in('estado', ABIERTOS);
  else if (vista === 'entregar') q = q.eq('estado', 'terminado');
  else if (vista === 'entregadas' || vista === 'deudores') q = q.eq('estado', 'entregado');

  if (pago) q = q.eq('cobranza.estado', pago);
  else if (vista === 'deudores') q = q.in('cobranza.estado', ['impago', 'parcial']);

  // Si es puramente numerico se busca por orden; si no, por cliente.
  // "12" es un numero de orden real, no el apellido de nadie.
  if (esNumero) {
    const n = Number(t);
    if (n > 0) q = q.eq('numero', n);
  } else if (buscaCliente) {
    q = q.ilike('cliente.nombre', `%${t}%`);
  }

  q = q.order('ingreso', { ascending: false }).limit(100);

  const { data, error } = await q;
  if (error) throw error;
  return { reparaciones: data ?? [], total: data?.length ?? 0 };
}

/** La orden con lo que necesita su pantalla de detalle: presupuesto,
 *  remito y factura vinculados, si existen. */
export async function obtenerReparacion(id) {
  const { data, error } = await supabase.from('reparacion').select(`
    ${SELECT},
    presupuestos:presupuesto (id, numero, punto_venta, total, estado, creado_en),
    remitos:remito (id, numero, punto_venta, total, token_publico, pdf_path),
    facturas:factura (id, numero, punto_venta, cbte_tipo, total, estado, cae, token_publico, pdf_path)
  `).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // `remito` tiene un constraint `unique(reparacion_id)`: segun version,
  // PostgREST puede devolver esa relacion como objeto en vez de array por
  // ser 1 a 1. Se contempla cualquiera de las dos formas.
  const remitoCrudo = data.remitos;
  const remito = Array.isArray(remitoCrudo) ? remitoCrudo[0] ?? null : remitoCrudo ?? null;

  return {
    ...data,
    presupuesto: [...(data.presupuestos ?? [])]
      .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))[0] ?? null,
    remito,
    // Una factura autorizada prevalece sobre las rechazadas de intentos
    // anteriores del mismo remito.
    factura: [...(data.facturas ?? [])]
      .sort((a, b) => Number(b.estado === 'autorizada') - Number(a.estado === 'autorizada'))[0] ?? null,
  };
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
    problema: reparacion.problema?.trim() || null,
    diagnostico: reparacion.diagnostico?.trim() || null,
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
  if (error) {
    // 23503: violacion de foreign key. remito.reparacion_id es
    // `on delete restrict` a proposito: una orden que ya se entrego con
    // remito no se borra. El mensaje crudo de Postgres no le sirve a
    // nadie en pantalla.
    if (error.code === '23503') {
      throw new Error('Esta orden ya tiene un remito emitido y no se puede eliminar.');
    }
    throw error;
  }
}

/**
 * Consulta publica por numero de orden + apellido (pagina /estado).
 *
 * Va contra una funcion SECURITY DEFINER que exige los dos datos y
 * devuelve lo minimo: estado, fechas y los links a los documentos
 * publicos que ya existan. No se consulta la tabla directamente: abrirla
 * a anonimo expondria el padron completo de clientes y las notas
 * internas del taller.
 */
export async function consultarEstadoPublico(numero, apellido) {
  const n = Number(String(numero).replace(/\D/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (!apellido?.trim()) return null;

  const { data, error } = await supabase.rpc('consultar_estado', {
    p_numero: n, p_apellido: apellido.trim(),
  });
  if (error) throw error;
  return data ?? null;
}
