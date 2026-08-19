import { Banknote, CreditCard, Landmark } from 'lucide-react';
import { supabase } from './supabase';
import { ETIQUETA_MEDIO_PAGO } from './remitos';

/**
 * Cobranza de una orden: lo que vale, lo que entro y lo que falta.
 *
 * Un pago guarda DOS numeros y confundirlos rompe la cuenta del taller:
 *
 *   monto   - lo que se le descuenta a la deuda del cliente
 *   cobrado - lo que el cliente entrega de verdad
 *
 * Con efectivo son el mismo numero. Con tarjeta no: sobre una deuda de
 * $100.000 al 15%, el cliente paga $115.000 y la deuda queda saldada.
 * El recargo es del servicio de cobro, no del trabajo, y por eso no
 * infla el total de la orden.
 */

/** Recargo de servicio que propone la interfaz al cobrar con tarjeta.
 *  Es una propuesta, no una regla: se puede cambiar en el momento. */
export const RECARGO_TARJETA = 15;

/**
 * Los tres medios que se usan en el mostrador.
 *
 * El enum de la base tiene mas (debito, credito, cheque, cuenta
 * corriente) y los remitos viejos los usan, pero ofrecer seis opciones
 * para una eleccion que se hace con el cliente esperando es pedirle a
 * alguien que lea una lista en vez de tocar un boton.
 */
export const MEDIOS = [
  { valor: 'efectivo', etiqueta: 'Efectivo', icono: Banknote },
  { valor: 'transferencia', etiqueta: 'Transferencia', icono: Landmark },
  { valor: 'tarjeta', etiqueta: 'Tarjeta', icono: CreditCard },
];

/** Etiqueta de cualquier medio, incluidos los que ya no se ofrecen. */
export const etiquetaMedio = (v) => (
  MEDIOS.find((m) => m.valor === v)?.etiqueta ?? ETIQUETA_MEDIO_PAGO[v] ?? 'Otro'
);

export const ETIQUETA_ESTADO_PAGO = {
  sin_importe: 'Sin importe',
  impago: 'Impago',
  parcial: 'Pago parcial',
  pagado: 'Pagado',
};

/**
 * Color de cada estado de pago.
 *
 * `impago` es gris y no rojo: una orden que entro esta manaña no debe
 * nada todavia. Lo que se pinta en rojo es otra cosa --el motor ya se
 * fue del taller sin pagar-- y eso lo decide `hayDeuda`, no el estado
 * solo.
 */
export const COLOR_ESTADO_PAGO = {
  sin_importe: 'var(--text-light)',
  impago: 'var(--text-light)',
  parcial: 'var(--warning)',
  pagado: 'var(--success)',
};

const COBRANZA_VACIA = {
  importe: null, importe_doc: null, total: null,
  pagado: 0, cobrado: 0, saldo: 0, estado: 'sin_importe',
};

/**
 * La cobranza de una orden, en la forma que sea que haya venido.
 *
 * `cobranza` es 1 a 1 con `reparacion`, y segun la version PostgREST
 * la devuelve como objeto o como array de uno. A un `lector` le vuelve
 * vacia --la tabla es de editores-- y ahi tambien tiene que servir:
 * devuelve ceros en vez de romper la pantalla.
 */
export function cobranzaDe(reparacion) {
  const c = reparacion?.cobranza;
  const fila = Array.isArray(c) ? c[0] : c;
  if (!fila) return { ...COBRANZA_VACIA };
  return {
    importe: fila.importe === null ? null : Number(fila.importe),
    importe_doc: fila.importe_doc === null ? null : Number(fila.importe_doc),
    total: fila.total === null || fila.total === undefined ? null : Number(fila.total),
    pagado: Number(fila.pagado ?? 0),
    cobrado: Number(fila.cobrado ?? 0),
    saldo: Number(fila.saldo ?? 0),
    estado: fila.estado ?? 'sin_importe',
  };
}

/** Hay plata pendiente y se sabe cuanta. */
export const hayDeuda = (cob) => Boolean(cob.total) && cob.saldo > 0;

/**
 * El motor ya se fue del taller y no esta cobrado.
 *
 * Es el unico caso que la pantalla marca en rojo. Mientras la orden
 * este abierta, deber es lo normal; una vez entregada, la unica palanca
 * que quedaba para cobrar --el motor-- ya no esta.
 */
export const alertaCobro = (reparacion) => (
  reparacion?.estado === 'entregado' && hayDeuda(cobranzaDe(reparacion))
);

/** Texto corto para la pastilla de la lista. */
export function resumenPago(reparacion, formato) {
  const cob = cobranzaDe(reparacion);
  if (cob.estado === 'sin_importe') return null;
  if (cob.estado === 'pagado') return { texto: 'Pagado', cob };
  if (alertaCobro(reparacion)) return { texto: `Debe ${formato(cob.saldo)}`, cob, alerta: true };
  if (cob.estado === 'parcial') return { texto: `Resta ${formato(cob.saldo)}`, cob };
  return { texto: `Impago ${formato(cob.saldo)}`, cob };
}

/**
 * Numero tipeado a la argentina.
 *
 * En el mostrador nadie escribe "150000": escribe "150.000". Un
 * Number() de eso da 150, y ese es el tipo de error que se descubre
 * cuando la caja no cierra a fin de mes.
 */
export function aNumero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const t = String(v ?? '').replace(/[^\d.,]/g, '');
  if (!t) return 0;

  // Con coma presente, la coma es el decimal y el punto separa miles.
  // Sin coma, un punto solo es de miles si viene en grupos exactos de
  // tres ("1.234.567"); si no, es un decimal tipeado a la inglesa.
  let s = t;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Lo que termina pagando el cliente, con el recargo del medio. */
export const conRecargo = (monto, pct) => Math.round(monto * (1 + (pct || 0) / 100) * 100) / 100;

const SELECT_PAGO = 'id, reparacion_id, fecha, medio, monto, recargo_pct, recargo, cobrado, nota, creado_en';

export async function listarPagos(reparacionId) {
  const { data, error } = await supabase
    .from('pago')
    .select(SELECT_PAGO)
    .eq('reparacion_id', reparacionId)
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function registrarPago({
  reparacion_id, monto, medio, recargo_pct = 0, fecha, nota,
}) {
  const importe = aNumero(monto);
  if (!(importe > 0)) throw new Error('Poné un monto mayor a cero.');
  if (!medio) throw new Error('Elegí con qué se pagó.');

  const { data: sesion } = await supabase.auth.getUser();

  const { data, error } = await supabase.from('pago').insert({
    reparacion_id,
    monto: importe,
    medio,
    // El recargo es del medio: guardarlo en un pago en efectivo seria
    // dejar en el libro una plata que nadie cobro.
    recargo_pct: medio === 'tarjeta' ? Math.max(0, aNumero(recargo_pct)) : 0,
    fecha: fecha || new Date().toISOString().slice(0, 10),
    nota: nota?.trim() || null,
    creado_por: sesion?.user?.id ?? null,
  }).select(SELECT_PAGO).single();

  if (error) throw error;
  return data;
}

export async function eliminarPago(id) {
  const { error } = await supabase.from('pago').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Fija el importe a cobrar a mano, o lo saca (null) para volver al que
 * dice el documento.
 *
 * Es la unica columna de `cobranza` que se escribe desde la aplicacion:
 * el resto lo mantienen los triggers de la base.
 */
export async function fijarImporte(reparacionId, importe) {
  const valor = importe === null || importe === '' ? null : aNumero(importe);
  if (valor !== null && !(valor >= 0)) throw new Error('El importe no puede ser negativo.');

  const { error } = await supabase
    .from('cobranza')
    .upsert({ reparacion_id: reparacionId, importe: valor }, { onConflict: 'reparacion_id' });
  if (error) throw error;
}

/**
 * Cuantos motores se fueron del taller sin pagar.
 *
 * Se pide aparte del listado --y con `head`, sin traer filas-- porque
 * el numero tiene que verse en el chip aunque la lista abierta sea
 * otra. Es la pregunta que el taller se hace todos los viernes.
 */
export async function contarDeudores() {
  const { count, error } = await supabase
    .from('reparacion')
    .select('id, cobranza!inner(estado)', { count: 'exact', head: true })
    .eq('estado', 'entregado')
    .in('cobranza.estado', ['impago', 'parcial']);
  if (error) throw error;
  return count ?? 0;
}
