/**
 * Dibuja el A4 de cualquiera de los tres comprobantes --presupuesto,
 * remito, factura-- a partir del objeto normalizado que arma
 * `normalizarComprobante()` en `../comprobante-modelo.js`.
 *
 * Vive en `deno/` y no junto a sus vecinos porque importa `npm:pdf-lib`.
 * Ese import no puede aparecer en ningun archivo bajo `_shared/` a
 * secas: el navegador aliasea `@shared` -> `_shared` (ver
 * `apps/web/vite.config.js`), y Vite intenta resolver el especificador
 * `npm:pdf-lib` en cuanto algo lo importa desde una pagina de React.
 * Nunca importar este archivo desde `apps/web`.
 *
 * Es la extraccion de lo que antes vivia entero adentro de
 * `presupuesto-pdf/index.ts` (lineas 178 a 469 de la version previa al
 * refactor). El dibujo es identico; lo unico que cambia por tipo de
 * documento son cinco cosas, marcadas abajo con "# variable":
 *   - el titulo ('PRESUPUESTO' | 'REMITO' | 'FACTURA C')
 *   - la letra del recuadro ('X' | 'X' | 'A'/'B'/'C')
 *   - los campos de la caja de datos (antes hardcodeados, ahora un loop)
 *   - la leyenda del recuadro (ausente en la factura)
 *   - el bloque de QR + CAE, que solo existe cuando `doc.fiscal` no es null
 */

import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import qrcode from 'npm:qrcode-generator@1.4.4';
import { disponerRenglones, envolver as envolverTexto, columnas, TAM_TEXTO } from '../layout-detalle.js';
import { modulosQr, CAJA_QR } from '../layout-qr.js';
import { pesos, formatearDoc, CONDICIONES } from '../comprobante-modelo.js';

// A4 en puntos
const ANCHO = 595.28;
const ALTO = 841.89;
const MARGEN = 42;

const NEGRO = rgb(0.09, 0.09, 0.11);
const GRIS = rgb(0.42, 0.45, 0.5);
const GRIS_SUAVE = rgb(0.91, 0.92, 0.94);
const LINEA = rgb(0.80, 0.82, 0.85);

const fecha = (d) =>
  new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * @param {import('../comprobante-modelo.js').Comprobante} doc
 * @returns {Promise<Uint8Array>}
 */
export async function dibujarComprobante(doc) {
  const envolver = (texto, fuente, tam, ancho) =>
    envolverTexto(texto, (t, s) => fuente.widthOfTextAtSize(t, s), tam, ancho);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${doc.titulo} ${doc.comprobante} - ${doc.emisor.razon_social ?? ''}`);
  pdf.setProducer('Gestor Taller');

  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italica = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let pagina = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;

  const texto = (t, x, yy, opts = {}) =>
    pagina.drawText(String(t ?? ''), {
      x, y: yy, size: opts.size ?? 9,
      font: opts.font ?? normal, color: opts.color ?? NEGRO,
    });

  const derecha = (t, xFin, yy, opts = {}) => {
    const f = opts.font ?? normal;
    const s = opts.size ?? 9;
    texto(t, xFin - f.widthOfTextAtSize(String(t ?? ''), s), yy, opts);
  };

  const centrado = (t, cx, yy, opts = {}) => {
    const f = opts.font ?? normal;
    const s = opts.size ?? 9;
    texto(t, cx - f.widthOfTextAtSize(String(t ?? ''), s) / 2, yy, opts);
  };

  // ---------- Encabezado ----------
  const ALTO_CAB = 106;
  const yCab = y - ALTO_CAB;
  const medio = ANCHO / 2;

  pagina.drawRectangle({
    x: MARGEN, y: yCab, width: ANCHO - MARGEN * 2, height: ALTO_CAB,
    borderColor: LINEA, borderWidth: 1,
  });
  // La linea divisoria se corta donde va el recuadro de la letra.
  pagina.drawLine({
    start: { x: medio, y: yCab }, end: { x: medio, y: y - 34 },
    color: LINEA, thickness: 1,
  });

  // Emisor
  let yy = y - 22;
  texto(doc.emisor.razon_social ?? '', MARGEN + 14, yy, { size: 15, font: negrita });
  yy -= 15;
  if (doc.emisor.nombre_fantasia) { texto(doc.emisor.nombre_fantasia, MARGEN + 14, yy, { size: 8.5, color: GRIS }); yy -= 11; }
  if (doc.emisor.domicilio) { texto(doc.emisor.domicilio, MARGEN + 14, yy, { size: 8.5, color: GRIS }); yy -= 11; }
  if (doc.emisor.localidad) { texto(doc.emisor.localidad, MARGEN + 14, yy, { size: 8.5, color: GRIS }); yy -= 11; }
  if (doc.emisor.telefono) { texto(`Tel. ${doc.emisor.telefono}`, MARGEN + 14, yy, { size: 8.5, color: GRIS }); yy -= 11; }
  if (doc.emisor.email) { texto(doc.emisor.email, MARGEN + 14, yy, { size: 8.5, color: GRIS }); }

  // Datos del comprobante. Arranca despues del recuadro de la letra, que
  // va centrado sobre la division: si empieza en medio+16 el titulo le
  // pasa por encima.
  const xDer = medio + 34;
  yy = y - 22;
  texto(doc.titulo, xDer, yy, { size: 15, font: negrita });          // # variable
  yy -= 18;
  texto('N°', xDer, yy, { size: 8.5, color: GRIS });
  texto(doc.comprobante, xDer + 18, yy, { size: 11, font: negrita });
  yy -= 15;

  // # variable: antes eran cuatro renglones fijos (fecha / vencimiento /
  // CUIT / cond. IVA); ahora es la lista que arma normalizarComprobante,
  // distinta segun el tipo de documento.
  for (const campo of doc.campos) {
    texto(campo.etiqueta, xDer, yy, { size: 8.5, color: GRIS });
    derecha(campo.valor, ANCHO - MARGEN - 14, yy, { size: 8.5 });
    yy -= 12;
  }

  // ---------- Recuadro de la letra ----------
  // Centrado sobre la division, como en cualquier comprobante argentino.
  const LADO = 40;
  const xCaja = medio - LADO / 2;
  const yCaja = y - 36;
  pagina.drawRectangle({
    x: xCaja, y: yCaja, width: LADO, height: LADO,
    color: rgb(1, 1, 1), borderColor: NEGRO, borderWidth: 1.2,
  });
  centrado(doc.letra, medio, yCaja + 11, { size: 25, font: negrita });   // # variable

  y = yCab - 12;

  // La leyenda va escrita ademas del recuadro, cuando existe: es lo que
  // deja explicito que el presupuesto o el remito no reemplazan a una
  // factura. La factura no lleva esta leyenda.
  if (doc.leyenda_recuadro) {                                            // # variable
    centrado(doc.leyenda_recuadro, medio, y, { size: 8, font: negrita, color: GRIS });
    y -= 20;
  } else {
    y -= 8;
  }

  // ---------- Cliente ----------
  const ALTO_CLI = 60;
  pagina.drawRectangle({
    x: MARGEN, y: y - ALTO_CLI, width: ANCHO - MARGEN * 2, height: ALTO_CLI,
    borderColor: LINEA, borderWidth: 1,
  });
  yy = y - 16;
  texto('EMITIDO PARA', MARGEN + 14, yy, { size: 7.5, font: negrita, color: GRIS });
  yy -= 14;
  texto(doc.cliente.nombre, MARGEN + 14, yy, { size: 11, font: negrita });
  if (doc.cliente.documento) {
    texto(
      `${(doc.cliente.documento_tipo ?? 'DOC').toUpperCase()} ${formatearDoc(doc.cliente.documento_tipo, doc.cliente.documento)}`,
      MARGEN + 14 + negrita.widthOfTextAtSize(doc.cliente.nombre, 11) + 12, yy, { size: 9, color: GRIS },
    );
  }
  yy -= 13;
  if (doc.cliente.domicilio) { texto(doc.cliente.domicilio, MARGEN + 14, yy, { size: 8.5, color: GRIS }); yy -= 11; }
  texto(CONDICIONES[doc.cliente.condicion_fiscal ?? ''] ?? 'Consumidor Final', MARGEN + 14, yy, { size: 8.5, color: GRIS });

  y -= ALTO_CLI + 24;

  // ---------- Detalle ----------
  // El reparto de columnas sale de _shared/layout-detalle.js, que tiene
  // tests contra los importes mas grandes que el taller puede emitir.
  const col = columnas({ ancho: ANCHO, margen: MARGEN });
  const xCant = col.derCant;
  const xPrecio = col.derPrecio;
  const xImporte = col.derImporte;

  pagina.drawRectangle({
    x: MARGEN, y: y - 6, width: ANCHO - MARGEN * 2, height: 20, color: GRIS_SUAVE,
  });
  texto('DESCRIPCION', col.izqDesc, y, { size: 7.5, font: negrita, color: GRIS });
  derecha('CANT.', xCant, y, { size: 7.5, font: negrita, color: GRIS });
  derecha('P. UNITARIO', xPrecio, y, { size: 7.5, font: negrita, color: GRIS });
  derecha('IMPORTE', xImporte, y, { size: 7.5, font: negrita, color: GRIS });
  y -= 24;

  const anchoDesc = col.anchoDesc;

  const importeDe = (it) => (Number(it.cantidad) || 0) * (Number(it.precio_unit) || 0);

  const { filas } = disponerRenglones({
    items: doc.items,
    medir: (t, s) => normal.widthOfTextAtSize(t, s),
    anchoDesc,
    yInicio: y,
    yMinimo: 190,
    yTope: ALTO - MARGEN,
  });

  let paginaActual = 0;
  for (const fila of filas) {
    if (fila.pagina !== paginaActual) {
      pagina = pdf.addPage([ANCHO, ALTO]);
      paginaActual = fila.pagina;
    }

    for (const l of fila.lineas) texto(l.texto, col.izqDesc, l.y, { size: TAM_TEXTO });

    const cant = Number(fila.item.cantidad);
    derecha(String(cant % 1 === 0 ? cant : fila.item.cantidad), xCant, fila.yImportes, { size: TAM_TEXTO });
    derecha(pesos(fila.item.precio_unit), xPrecio, fila.yImportes, { size: TAM_TEXTO });
    derecha(pesos(importeDe(fila.item)), xImporte, fila.yImportes, { size: TAM_TEXTO, font: negrita });

    pagina.drawLine({
      start: { x: MARGEN, y: fila.ySeparador }, end: { x: ANCHO - MARGEN, y: fila.ySeparador },
      color: GRIS_SUAVE, thickness: 0.7,
    });

    y = fila.ySeparador;
  }

  // ---------- Totales ----------
  const subtotal = doc.items.reduce((a, it) => a + importeDe(it), 0);
  const neto = subtotal - doc.descuento;
  const iva = neto * (doc.iva_pct / 100);
  const total = neto + iva;

  y -= 14;
  const xEtq = ANCHO - MARGEN - 210;
  const filaTotal = (etq, valor, opts = {}) => {
    texto(etq, xEtq, y, { size: opts.size ?? 9, font: opts.font ?? normal, color: opts.color ?? GRIS });
    derecha(valor, xImporte, y, { size: opts.size ?? 9, font: opts.font ?? negrita });
    y -= opts.salto ?? 15;
  };

  filaTotal('Subtotal', pesos(subtotal));
  if (doc.descuento > 0) filaTotal('Descuento', `- ${pesos(doc.descuento)}`);
  if (doc.iva_pct > 0) filaTotal(`IVA ${doc.iva_pct}%`, pesos(iva));

  y -= 12;
  pagina.drawRectangle({
    x: xEtq - 12, y: y - 3, width: ANCHO - MARGEN - xEtq + 12, height: 26, color: GRIS_SUAVE,
  });
  texto('TOTAL', xEtq, y + 5, { size: 12, font: negrita, color: NEGRO });
  derecha(pesos(total), xImporte, y + 5, { size: 13, font: negrita });
  y -= 32;

  // ---------- CAE y QR de ARCA ----------
  // Solo en la factura. Es la unica parte del documento que un
  // presupuesto o un remito no pueden tener: sin CAE no hay nada que
  // codificar, y un recuadro vacio confundiria mas de lo que ayuda.
  if (doc.fiscal) {
    const codigoQr = qrcode(0, 'M'); // version automatica
    codigoQr.addData(doc.fiscal.qr_url);
    codigoQr.make();

    const yQr = y - CAJA_QR;
    for (const m of modulosQr(codigoQr, { x: MARGEN, y: yQr, lado: CAJA_QR })) {
      pagina.drawRectangle({ x: m.x, y: m.y, width: m.width, height: m.height, color: NEGRO });
    }

    const xCae = MARGEN + CAJA_QR + 18;
    texto('CAE N°', xCae, yQr + CAJA_QR - 14, { size: 7.5, font: negrita, color: GRIS });
    texto(doc.fiscal.cae, xCae + 46, yQr + CAJA_QR - 14, { size: 10, font: negrita });
    texto('Vto. del CAE', xCae, yQr + CAJA_QR - 30, { size: 7.5, color: GRIS });
    texto(fecha(doc.fiscal.cae_vencimiento), xCae + 62, yQr + CAJA_QR - 30, { size: 9 });

    y = yQr - 10;
  }

  // ---------- Notas y pie ----------
  if (doc.notas) {
    y -= 8;
    texto('OBSERVACIONES', MARGEN, y, { size: 7.5, font: negrita, color: GRIS });
    y -= 13;
    for (const r of envolver(doc.notas, normal, 8.5, ANCHO - MARGEN * 2)) {
      texto(r, MARGEN, y, { size: 8.5 });
      y -= 11;
    }
  }

  const yPie = MARGEN + 26;
  pagina.drawLine({
    start: { x: MARGEN, y: yPie + 22 }, end: { x: ANCHO - MARGEN, y: yPie + 22 },
    color: LINEA, thickness: 0.7,
  });
  if (doc.leyenda_pie) {
    for (const [i, r] of envolver(doc.leyenda_pie, italica, 7.5, ANCHO - MARGEN * 2).entries()) {
      texto(r, MARGEN, yPie + 10 - i * 9, { size: 7.5, font: italica, color: GRIS });
    }
  }
  if (doc.pie_chico) {
    centrado(doc.pie_chico, medio, yPie - 10, { size: 6.5, color: GRIS });
  }

  // ---------- Fotos del motor ----------
  // Si el comprobante trae fotos --hoy solo el presupuesto, cuando esta
  // asociado a una reparacion-- se adjuntan en una hoja aparte: le
  // muestran al cliente que se le esta cobrando.
  if (doc.fotos?.length) {
    const hoja = pdf.addPage([ANCHO, ALTO]);
    hoja.drawText('Fotos del equipo', {
      x: MARGEN, y: ALTO - MARGEN - 4, size: 13, font: negrita, color: NEGRO,
    });
    hoja.drawText(`${doc.titulo} N° ${doc.comprobante}`, {
      x: MARGEN, y: ALTO - MARGEN - 20, size: 8.5, font: normal, color: GRIS,
    });

    const cel = (ANCHO - MARGEN * 2 - 14) / 2;
    let columna = 0;
    let filaY = ALTO - MARGEN - 42;

    for (const f of doc.fotos) {
      try {
        const img = f.mime === 'image/png'
          ? await pdf.embedPng(f.bytes)
          : await pdf.embedJpg(f.bytes);

        const escala = Math.min(cel / img.width, 220 / img.height);
        const w = img.width * escala;
        const h = img.height * escala;

        hoja.drawImage(img, {
          x: MARGEN + columna * (cel + 14) + (cel - w) / 2,
          y: filaY - h,
          width: w,
          height: h,
        });

        columna += 1;
        if (columna === 2) { columna = 0; filaY -= 236; }
      } catch {
        // Una foto que no se puede leer no tiene por que voltear el
        // comprobante entero.
      }
    }
  }

  return pdf.save();
}
