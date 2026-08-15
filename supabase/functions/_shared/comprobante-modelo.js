/**
 * Lo comun a los tres comprobantes que emite el taller: presupuesto,
 * remito y factura.
 *
 * Puro adrede: sin `npm:` ni nada que solo exista en Deno. Este archivo
 * lo importan tres runtimes distintos --el navegador via el alias
 * `@shared`, las Edge Functions, y `node:test` para los tests-- y basta
 * que una sola linea traiga `npm:pdf-lib` para que el build de Vite
 * reviente en cuanto alguien lo importe desde una pagina de React. Lo
 * que si necesita pdf-lib va en `deno/pdf-comprobante.ts`, que nunca se
 * debe importar desde `apps/web`.
 *
 * `pesos()` y `formatearDoc()` estaban escritas dos veces --una en
 * presupuesto-pdf/index.ts, otra en PresupuestoPublico.jsx-- y ya
 * habian empezado a divergir (una tenia el formato de CUIT, la otra
 * no). De ahi el comentario del generador de PDF: "dos generadores del
 * mismo documento terminan divergiendo". Esta es la version unica.
 */

export const CONDICIONES = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributo: 'Monotributista',
  exento: 'Exento',
  consumidor_final: 'Consumidor Final',
  no_alcanzado: 'No Alcanzado',
};

export const ETIQUETA_MEDIO_PAGO = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  debito: 'Tarjeta de debito',
  credito: 'Tarjeta de credito',
  cheque: 'Cheque',
  cuenta_corriente: 'Cuenta corriente',
  otro: 'Otro',
};

/** "$ 1.234,56", manual y no Intl: es el formato que ya usan el PDF y la
 *  pagina publica, y tiene que dar caracter por caracter igual en los dos. */
export function pesos(n) {
  const v = Number(n) || 0;
  const [ent, dec] = v.toFixed(2).split('.');
  return `$ ${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

export function formatearDoc(tipo, valor) {
  if (!valor) return '';
  const d = String(valor).replace(/\D/g, '');
  if (tipo === 'dni') return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (d.length === 11) return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
  return d;
}

/**
 * Los totales se suman de los renglones, nunca de las columnas
 * cacheadas: van un paso atras del trigger, y se llego a emitir un PDF
 * con cuatro renglones listados y "Subtotal $ 0,00" porque la fila
 * todavia no se habia recalculado. Un comprobante que se contradice a
 * si mismo se lo lleva el cliente y no hay como explicarlo despues.
 */
export function totalesDe({ items = [], descuento = 0, iva_pct: ivaPct = 0 }) {
  const subtotal = (items ?? []).reduce(
    (a, it) => a + (Number(it.cantidad) || 0) * (Number(it.precio_unit) || 0), 0,
  );
  const desc = Number(descuento) || 0;
  const neto = subtotal - desc;
  const iva = neto * ((Number(ivaPct) || 0) / 100);
  return { subtotal, descuento: desc, neto, iva, total: neto + iva };
}

/**
 * Payload del QR de factura electronica (RG 4892/2020 de AFIP/ARCA).
 * `tipoCodAut` es siempre "E" (CAE): el otro valor, "A", es para
 * comprobantes autorizados por CAEA, que este taller no usa.
 */
export function payloadQrArca({
  fecha, cuit, punto_venta: puntoVenta, cbte_tipo: cbteTipo, numero,
  total, doc_tipo: docTipo, doc_nro: docNro, cae,
}) {
  return {
    ver: 1,
    fecha,
    cuit: Number(cuit),
    ptoVta: Number(puntoVenta),
    tipoCmp: Number(cbteTipo),
    nroCmp: Number(numero),
    importe: Number(Number(total).toFixed(2)),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: Number(docTipo),
    nroDocRec: Number(docNro),
    tipoCodAut: 'E',
    codAut: Number(cae),
  };
}

/** btoa existe tanto en Deno como en el navegador; no hace falta Buffer. */
export const urlQrArca = (payload) =>
  `https://www.arca.gob.ar/fe/qr/?p=${btoa(JSON.stringify(payload))}`;

/**
 * Arma el objeto que dibujan tanto el PDF como la pagina publica, a
 * partir de la fila cruda de `presupuesto`, `remito` o `factura`.
 *
 * Un solo lugar decide que letra lleva cada documento, que dice la
 * leyenda del recuadro y que campos van en la caja de datos del
 * encabezado (que es lo unico que realmente cambia entre los tres:
 * "Valido hasta" en el presupuesto, "Medio de pago" en el remito,
 * "Vto. del CAE" en la factura). Devolver un array `campos` evita tres
 * ramas de `if (tipo === ...)` repartidas por todo el dibujo.
 */
export function normalizarComprobante(tipo, fila, items, cfg, extra = {}) {
  const emisor = {
    razon_social: cfg?.razon_social ?? '',
    nombre_fantasia: cfg?.nombre_fantasia ?? null,
    domicilio: cfg?.domicilio ?? null,
    localidad: cfg?.localidad ?? null,
    telefono: cfg?.telefono ?? null,
    email: cfg?.email ?? null,
    cuit: cfg?.cuit ?? null,
    condicion_fiscal: cfg?.condicion_fiscal ?? null,
  };

  const cliente = {
    nombre: fila.cliente_nombre ?? fila.cliente?.nombre ?? 'Consumidor final',
    documento: fila.cliente_documento ?? fila.cliente?.documento ?? null,
    documento_tipo: fila.cliente_documento_tipo ?? fila.cliente?.documento_tipo ?? null,
    condicion_fiscal: fila.cliente_condicion_fiscal ?? fila.cliente?.condicion_fiscal ?? null,
    domicilio: fila.cliente_domicilio ?? fila.cliente?.direccion ?? null,
  };

  const comprobante = `${String(fila.punto_venta ?? 1).padStart(4, '0')}-${String(fila.numero ?? 0).padStart(8, '0')}`;

  const base = {
    tipo,
    comprobante,
    fecha: fila.creado_en ?? fila.fecha ?? fila.cbte_fecha,
    emisor,
    cliente,
    items: items ?? [],
    descuento: Number(fila.descuento) || 0,
    iva_pct: Number(fila.iva_pct) || 0,
    notas: fila.notas ?? null,
    fiscal: null,
    fotos: extra.fotos ?? [],
  };

  if (tipo === 'presupuesto') {
    const vence = new Date(fila.creado_en);
    vence.setDate(vence.getDate() + (fila.vigencia_dias ?? 15));
    return {
      ...base,
      titulo: 'PRESUPUESTO',
      letra: 'X',
      leyenda_recuadro: 'DOCUMENTO NO VALIDO COMO FACTURA',
      campos: [
        { etiqueta: 'Fecha de emision:', valor: fechaCorta(fila.creado_en) },
        { etiqueta: 'Valido hasta:', valor: fechaCorta(vence) },
        ...(cfg?.cuit ? [{ etiqueta: 'CUIT:', valor: formatearDoc('cuit', cfg.cuit) }] : []),
        { etiqueta: 'Cond. IVA:', valor: CONDICIONES[cfg?.condicion_fiscal ?? ''] ?? '-' },
      ],
      leyenda_pie: cfg?.leyenda_validez ?? '',
      pie_chico: 'Este documento no reemplaza a la factura. No es valido como comprobante fiscal.',
    };
  }

  if (tipo === 'remito') {
    return {
      ...base,
      titulo: 'REMITO',
      letra: 'X',
      leyenda_recuadro: 'DOCUMENTO NO VALIDO COMO FACTURA',
      campos: [
        { etiqueta: 'Fecha:', valor: fechaCorta(fila.fecha) },
        { etiqueta: 'Medio de pago:', valor: extra.etiquetaMedioPago ?? '-' },
        ...(cfg?.cuit ? [{ etiqueta: 'CUIT:', valor: formatearDoc('cuit', cfg.cuit) }] : []),
        { etiqueta: 'Cond. IVA:', valor: CONDICIONES[cfg?.condicion_fiscal ?? ''] ?? '-' },
      ],
      leyenda_pie: null,
      pie_chico: 'Este documento no reemplaza a la factura. No es valido como comprobante fiscal.',
    };
  }

  // factura
  const letraPorTipo = { 1: 'A', 6: 'B', 11: 'C', 51: 'M' };
  return {
    ...base,
    titulo: `FACTURA ${letraPorTipo[fila.cbte_tipo] ?? 'C'}`,
    letra: letraPorTipo[fila.cbte_tipo] ?? 'C',
    leyenda_recuadro: null,
    campos: [
      { etiqueta: 'Fecha de emision:', valor: fechaCorta(fila.cbte_fecha) },
      { etiqueta: 'Vto. del CAE:', valor: fechaCorta(fila.cae_vencimiento) },
      ...(cfg?.cuit ? [{ etiqueta: 'CUIT:', valor: formatearDoc('cuit', cfg.cuit) }] : []),
      { etiqueta: 'Cond. IVA:', valor: CONDICIONES[cfg?.condicion_fiscal ?? ''] ?? '-' },
    ],
    leyenda_pie: null,
    pie_chico: null,
    fiscal: fila.cae
      ? {
        cae: fila.cae,
        cae_vencimiento: fila.cae_vencimiento,
        qr_url: urlQrArca(payloadQrArca({
          fecha: fila.cbte_fecha,
          cuit: cfg?.cuit,
          punto_venta: fila.punto_venta,
          cbte_tipo: fila.cbte_tipo,
          numero: fila.numero,
          total: fila.total,
          doc_tipo: fila.doc_tipo,
          doc_nro: fila.doc_nro,
          cae: fila.cae,
        })),
      }
      : null,
  };
}

function fechaCorta(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
