/**
 * PDF del presupuesto.
 *
 * Corre del lado del servidor y no en el navegador por dos razones: el
 * bot de Telegram va a necesitar el mismo PDF sin que haya una pestaña
 * abierta, y generarlo aca evita sumarle ~300 KB de libreria al bundle
 * que se baja desde el celular del taller.
 *
 * SOBRE EL FORMATO
 *
 * Un presupuesto NO es un comprobante fiscal: no lleva CAE ni se informa
 * a AFIP. Se emite igual con el formato de comprobante --letra en
 * recuadro centrado, punto de venta y numero correlativo-- porque es lo
 * que el cliente reconoce. La letra correcta es la X, que en el regimen
 * argentino significa "documento no valido como factura", y la leyenda
 * va escrita ademas en texto para que no quede lugar a dudas.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import {
  disponerRenglones, envolver as envolverTexto, columnas, TAM_TEXTO,
} from '../_shared/layout-detalle.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

// A4 en puntos
const ANCHO = 595.28;
const ALTO = 841.89;
const MARGEN = 42;

const NEGRO = rgb(0.09, 0.09, 0.11);
const GRIS = rgb(0.42, 0.45, 0.5);
const GRIS_SUAVE = rgb(0.91, 0.92, 0.94);
const LINEA = rgb(0.80, 0.82, 0.85);

const CONDICIONES: Record<string, string> = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributo: 'Monotributista',
  exento: 'Exento',
  consumidor_final: 'Consumidor Final',
  no_alcanzado: 'No Alcanzado',
};

function pesos(n: number): string {
  const v = Number(n) || 0;
  const [ent, dec] = v.toFixed(2).split('.');
  return `$ ${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

function formatearDoc(tipo: string | null, valor: string | null): string {
  if (!valor) return '';
  const d = valor.replace(/\D/g, '');
  if (tipo === 'dni') return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (d.length === 11) return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
  return d;
}

const fecha = (d: string | Date) =>
  new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Corta un texto en renglones que entren en el ancho dado.
 *
 * La logica vive en _shared/layout-detalle.js para poder probarla sin
 * generar un PDF; aca solo se le pasa la forma de medir de pdf-lib.
 */
const envolver = (texto: string, fuente: any, tam: number, ancho: number): string[] =>
  envolverTexto(texto, (t: string, s: number) => fuente.widthOfTextAtSize(t, s), tam, ancho);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return responder({ error: 'Metodo no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const autorizacion = req.headers.get('Authorization');
  if (!autorizacion) return responder({ error: 'Falta autorizacion.' }, 401);

  const admin = createClient(url, servicio);

  /**
   * Dos formas de llegar acá.
   *
   * Desde el navegador viene el JWT del usuario y todo se lee con su
   * sesion, para que RLS siga decidiendo qué puede ver.
   *
   * Desde el bot de Telegram no hay sesion: la Edge Function llama con
   * la service_role. Esa clave no sale nunca de Supabase --no está en el
   * bundle del navegador ni viaja al cliente--, asi que tenerla ya
   * implica ser codigo nuestro. El chequeo de permisos del que emite lo
   * hizo el bot antes, resolviendo telegram_id -> perfil -> rol.
   *
   * La alternativa era duplicar el generador de PDF del lado del bot, y
   * dos generadores del mismo documento terminan divergiendo.
   */
  const interno = autorizacion === `Bearer ${servicio}`;
  let lector = admin;

  if (!interno) {
    const comoUsuario = createClient(url, anon, {
      global: { headers: { Authorization: autorizacion } },
    });
    const { data: { user } } = await comoUsuario.auth.getUser();
    if (!user) return responder({ error: 'Sesion invalida.' }, 401);

    const { data: rol } = await comoUsuario.rpc('rol_actual');
    if (rol !== 'super' && rol !== 'editor') {
      return responder({ error: 'Tu perfil no puede emitir presupuestos.' }, 403);
    }
    lector = comoUsuario;
  }

  let cuerpo: { presupuesto_id?: string };
  try { cuerpo = await req.json(); } catch { return responder({ error: 'Cuerpo invalido.' }, 400); }
  if (!cuerpo.presupuesto_id) return responder({ error: 'Falta presupuesto_id.' }, 400);

  const { data: p, error: eP } = await lector
    .from('presupuesto')
    .select(`
      id, numero, punto_venta, estado, subtotal, descuento, iva_pct, total,
      vigencia_dias, notas, creado_en, token_publico, reparacion_id,
      cliente_nombre, cliente_documento, cliente_documento_tipo, cliente_condicion_fiscal,
      cliente:cliente_id (nombre, documento, documento_tipo, condicion_fiscal, direccion, telefono)
    `)
    .eq('id', cuerpo.presupuesto_id)
    .maybeSingle();

  if (eP || !p) return responder({ error: 'No encontramos ese presupuesto.' }, 404);

  const { data: items } = await lector
    .from('presupuesto_item')
    .select('descripcion, cantidad, precio_unit, subtotal, orden')
    .eq('presupuesto_id', p.id)
    .order('orden');

  const { data: cfg } = await lector
    .from('configuracion').select('*').eq('id', 1).single();

  /**
   * Los totales se suman de los renglones que se acaban de leer, no de
   * las columnas `subtotal` y `total` de la tabla.
   *
   * Esas columnas las mantiene un trigger y van un paso atras: se llego
   * a emitir un PDF con cuatro renglones listados y "Subtotal $ 0,00",
   * porque la fila todavia no se habia recalculado. Un presupuesto que
   * se contradice a si mismo se lo lleva el cliente y no hay como
   * explicarlo despues.
   */
  const importeDe = (it: any) => (Number(it.cantidad) || 0) * (Number(it.precio_unit) || 0);
  const subtotal = (items ?? []).reduce((a, it) => a + importeDe(it), 0);
  const descuento = Number(p.descuento) || 0;
  const neto = subtotal - descuento;
  const iva = neto * ((Number(p.iva_pct) || 0) / 100);
  const total = neto + iva;

  const cli = {
    nombre: p.cliente_nombre ?? p.cliente?.nombre ?? 'Consumidor final',
    documento: p.cliente_documento ?? p.cliente?.documento ?? null,
    documento_tipo: p.cliente_documento_tipo ?? p.cliente?.documento_tipo ?? null,
    condicion: p.cliente_condicion_fiscal ?? p.cliente?.condicion_fiscal ?? null,
    domicilio: p.cliente?.direccion ?? null,
  };

  // ------------------------------------------------------------
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Presupuesto ${p.numero} - ${cfg?.razon_social ?? ''}`);
  pdf.setProducer('Gestor Taller');

  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italica = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let pagina = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;

  const texto = (t: string, x: number, yy: number, opts: any = {}) =>
    pagina.drawText(String(t ?? ''), {
      x, y: yy, size: opts.size ?? 9,
      font: opts.font ?? normal, color: opts.color ?? NEGRO,
    });

  const derecha = (t: string, xFin: number, yy: number, opts: any = {}) => {
    const f = opts.font ?? normal;
    const s = opts.size ?? 9;
    texto(t, xFin - f.widthOfTextAtSize(String(t ?? ''), s), yy, opts);
  };

  const centrado = (t: string, cx: number, yy: number, opts: any = {}) => {
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
  texto(cfg?.razon_social ?? 'Bobinados David', MARGEN + 14, yy, { size: 15, font: negrita });
  yy -= 15;
  if (cfg?.nombre_fantasia) { texto(cfg.nombre_fantasia, MARGEN + 14, yy, { size: 8.5, color: GRIS }); yy -= 11; }
  if (cfg?.domicilio) { texto(cfg.domicilio, MARGEN + 14, yy, { size: 8.5, color: GRIS }); yy -= 11; }
  if (cfg?.localidad) { texto(cfg.localidad, MARGEN + 14, yy, { size: 8.5, color: GRIS }); yy -= 11; }
  if (cfg?.telefono) { texto(`Tel. ${cfg.telefono}`, MARGEN + 14, yy, { size: 8.5, color: GRIS }); yy -= 11; }
  if (cfg?.email) { texto(cfg.email, MARGEN + 14, yy, { size: 8.5, color: GRIS }); }

  // Datos del comprobante. Arranca despues del recuadro de la letra,
  // que va centrado sobre la division: si empieza en medio+16 el titulo
  // le pasa por encima.
  const xDer = medio + 34;
  yy = y - 22;
  texto('PRESUPUESTO', xDer, yy, { size: 15, font: negrita });
  yy -= 18;
  texto('N°', xDer, yy, { size: 8.5, color: GRIS });
  texto(
    `${String(cfg?.punto_venta ?? p.punto_venta ?? 1).padStart(4, '0')}-${String(p.numero).padStart(8, '0')}`,
    xDer + 18, yy, { size: 11, font: negrita },
  );
  yy -= 15;
  texto('Fecha de emision:', xDer, yy, { size: 8.5, color: GRIS });
  derecha(fecha(p.creado_en), ANCHO - MARGEN - 14, yy, { size: 8.5 });
  yy -= 12;

  const vence = new Date(p.creado_en);
  vence.setDate(vence.getDate() + (p.vigencia_dias ?? 15));
  texto('Valido hasta:', xDer, yy, { size: 8.5, color: GRIS });
  derecha(fecha(vence), ANCHO - MARGEN - 14, yy, { size: 8.5 });
  yy -= 12;

  if (cfg?.cuit) {
    texto('CUIT:', xDer, yy, { size: 8.5, color: GRIS });
    derecha(formatearDoc('cuit', cfg.cuit), ANCHO - MARGEN - 14, yy, { size: 8.5 });
    yy -= 12;
  }
  texto('Cond. IVA:', xDer, yy, { size: 8.5, color: GRIS });
  derecha(CONDICIONES[cfg?.condicion_fiscal ?? ''] ?? '-', ANCHO - MARGEN - 14, yy, { size: 8.5 });

  // ---------- Recuadro de la letra ----------
  // Centrado sobre la division, como en cualquier comprobante argentino.
  const LADO = 40;
  const xCaja = medio - LADO / 2;
  const yCaja = y - 36;
  pagina.drawRectangle({
    x: xCaja, y: yCaja, width: LADO, height: LADO,
    color: rgb(1, 1, 1), borderColor: NEGRO, borderWidth: 1.2,
  });
  centrado('X', medio, yCaja + 11, { size: 25, font: negrita });

  y = yCab - 12;

  // La leyenda va escrita ademas del recuadro: es lo que deja explicito
  // que esto no reemplaza a una factura.
  centrado('DOCUMENTO NO VALIDO COMO FACTURA', medio, y, { size: 8, font: negrita, color: GRIS });
  y -= 20;

  // ---------- Cliente ----------
  const ALTO_CLI = 60;
  pagina.drawRectangle({
    x: MARGEN, y: y - ALTO_CLI, width: ANCHO - MARGEN * 2, height: ALTO_CLI,
    borderColor: LINEA, borderWidth: 1,
  });
  yy = y - 16;
  texto('EMITIDO PARA', MARGEN + 14, yy, { size: 7.5, font: negrita, color: GRIS });
  yy -= 14;
  texto(cli.nombre, MARGEN + 14, yy, { size: 11, font: negrita });
  if (cli.documento) {
    texto(
      `${(cli.documento_tipo ?? 'DOC').toUpperCase()} ${formatearDoc(cli.documento_tipo, cli.documento)}`,
      MARGEN + 14 + negrita.widthOfTextAtSize(cli.nombre, 11) + 12, yy, { size: 9, color: GRIS },
    );
  }
  yy -= 13;
  if (cli.domicilio) { texto(cli.domicilio, MARGEN + 14, yy, { size: 8.5, color: GRIS }); yy -= 11; }
  texto(CONDICIONES[cli.condicion ?? ''] ?? 'Consumidor Final', MARGEN + 14, yy, { size: 8.5, color: GRIS });

  y -= ALTO_CLI + 24;

  // ---------- Detalle ----------
  // El reparto de columnas sale de _shared/layout-detalle.js, que tiene
  // tests contra los importes mas grandes que el taller puede emitir.
  // Escrito a mano, el importe le quedaba a 2 pt del precio unitario y
  // en el papel se leian como un solo numero pegado.
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

  // Las posiciones se calculan de una sola vez con la geometria de
  // _shared/layout-detalle.js, que esta cubierta por tests. Antes se
  // calculaban al vuelo aca y la raya separadora terminaba 0,45 pt
  // adentro de las mayusculas del renglon siguiente.
  const { filas } = disponerRenglones({
    items: items ?? [],
    medir: (t: string, s: number) => normal.widthOfTextAtSize(t, s),
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
  y -= 14;
  const xEtq = ANCHO - MARGEN - 210;
  const fila = (etq: string, valor: string, opts: any = {}) => {
    texto(etq, xEtq, y, { size: opts.size ?? 9, font: opts.font ?? normal, color: opts.color ?? GRIS });
    derecha(valor, xImporte, y, { size: opts.size ?? 9, font: opts.font ?? negrita });
    y -= opts.salto ?? 15;
  };

  fila('Subtotal', pesos(subtotal));
  if (descuento > 0) fila('Descuento', `- ${pesos(descuento)}`);
  if (Number(p.iva_pct) > 0) fila(`IVA ${p.iva_pct}%`, pesos(iva));

  // El recuadro se dibuja DESPUES de bajar: como se pinta de abajo hacia
  // arriba con alto 26, sin este margen tapaba el renglon del subtotal.
  y -= 12;
  pagina.drawRectangle({
    x: xEtq - 12, y: y - 3, width: ANCHO - MARGEN - xEtq + 12, height: 26, color: GRIS_SUAVE,
  });
  texto('TOTAL', xEtq, y + 5, { size: 12, font: negrita, color: NEGRO });
  derecha(pesos(total), xImporte, y + 5, { size: 13, font: negrita });
  y -= 32;

  // ---------- Notas y pie ----------
  if (p.notas) {
    y -= 8;
    texto('OBSERVACIONES', MARGEN, y, { size: 7.5, font: negrita, color: GRIS });
    y -= 13;
    for (const r of envolver(p.notas, normal, 8.5, ANCHO - MARGEN * 2)) {
      texto(r, MARGEN, y, { size: 8.5 });
      y -= 11;
    }
  }

  const yPie = MARGEN + 26;
  pagina.drawLine({
    start: { x: MARGEN, y: yPie + 22 }, end: { x: ANCHO - MARGEN, y: yPie + 22 },
    color: LINEA, thickness: 0.7,
  });
  for (const [i, r] of envolver(
    cfg?.leyenda_validez ?? '', italica, 7.5, ANCHO - MARGEN * 2,
  ).entries()) {
    texto(r, MARGEN, yPie + 10 - i * 9, { size: 7.5, font: italica, color: GRIS });
  }
  centrado(
    'Este documento no reemplaza a la factura. No es valido como comprobante fiscal.',
    medio, yPie - 10, { size: 6.5, color: GRIS },
  );

  // ---------- Fotos del motor ----------
  // Si el presupuesto esta asociado a una reparacion, se adjuntan las
  // fotos de la ficha: le muestran al cliente que se le esta cobrando.
  if (p.reparacion_id) {
    const { data: rep } = await admin
      .from('reparacion').select('motor_id').eq('id', p.reparacion_id).maybeSingle();

    if (rep?.motor_id) {
      const { data: fotos } = await admin
        .from('motor_foto')
        .select('storage_path, es_externa')
        .eq('motor_id', rep.motor_id)
        .eq('es_externa', false)
        .order('orden')
        .limit(4);

      if (fotos?.length) {
        const hoja = pdf.addPage([ANCHO, ALTO]);
        hoja.drawText('Fotos del equipo', {
          x: MARGEN, y: ALTO - MARGEN - 4, size: 13, font: negrita, color: NEGRO,
        });
        hoja.drawText(`Presupuesto N° ${String(p.numero).padStart(8, '0')}`, {
          x: MARGEN, y: ALTO - MARGEN - 20, size: 8.5, font: normal, color: GRIS,
        });

        const cel = (ANCHO - MARGEN * 2 - 14) / 2;
        // `columna` y no `col`: arriba `col` son las columnas del detalle
        // y aca tapaba esa variable sin que el compilador se queje.
        let columna = 0;
        let filaY = ALTO - MARGEN - 42;

        for (const f of fotos) {
          try {
            const { data: bin } = await admin.storage.from('fichas').download(f.storage_path);
            if (!bin) continue;
            const bytes = new Uint8Array(await bin.arrayBuffer());

            const img = bin.type === 'image/png'
              ? await pdf.embedPng(bytes)
              : await pdf.embedJpg(bytes);

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
            // presupuesto entero.
          }
        }
      }
    }
  }

  // ------------------------------------------------------------
  const bytes = await pdf.save();
  const ruta = `presupuestos/${p.id}.pdf`;

  const { error: eSubida } = await admin.storage
    .from('presupuestos')
    .upload(ruta, bytes, { contentType: 'application/pdf', upsert: true });
  if (eSubida) return responder({ error: `No se pudo guardar el PDF: ${eSubida.message}` }, 500);

  await admin.from('presupuesto').update({ pdf_path: ruta }).eq('id', p.id);

  const { data: firmada, error: eUrl } = await admin.storage
    .from('presupuestos').createSignedUrl(ruta, 3600);
  if (eUrl) return responder({ error: eUrl.message }, 500);

  return responder({ url: firmada.signedUrl, path: ruta, paginas: pdf.getPageCount() });
});
