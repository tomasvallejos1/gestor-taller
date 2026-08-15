/**
 * PDF del presupuesto.
 *
 * Corre del lado del servidor y no en el navegador por dos razones: el
 * bot de Telegram va a necesitar el mismo PDF sin que haya una pestaña
 * abierta, y generarlo aca evita sumarle ~300 KB de libreria al bundle
 * que se baja desde el celular del taller.
 *
 * El dibujo en si vive en `_shared/deno/pdf-comprobante.ts`, compartido
 * con el remito y la factura. Este archivo solo resuelve permisos, lee
 * los datos y arma el objeto normalizado que ese modulo dibuja.
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
import { dibujarComprobante } from '../_shared/deno/pdf-comprobante.ts';
import { normalizarComprobante } from '../_shared/comprobante-modelo.js';

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

  // ---------- Fotos del motor ----------
  // Si el presupuesto esta asociado a una reparacion, se adjuntan las
  // fotos de la ficha: le muestran al cliente que se le esta cobrando.
  let fotos: Array<{ bytes: Uint8Array; mime: string }> = [];
  if (p.reparacion_id) {
    const { data: rep } = await admin
      .from('reparacion').select('motor_id').eq('id', p.reparacion_id).maybeSingle();

    if (rep?.motor_id) {
      const { data: registros } = await admin
        .from('motor_foto')
        .select('storage_path, es_externa')
        .eq('motor_id', rep.motor_id)
        .eq('es_externa', false)
        .order('orden')
        .limit(4);

      for (const f of registros ?? []) {
        try {
          const { data: bin } = await admin.storage.from('fichas').download(f.storage_path);
          if (!bin) continue;
          fotos.push({ bytes: new Uint8Array(await bin.arrayBuffer()), mime: bin.type });
        } catch {
          // Una foto que no se puede leer no tiene por que voltear el
          // presupuesto entero.
        }
      }
    }
  }

  const doc = normalizarComprobante('presupuesto', p, items ?? [], cfg, { fotos });

  const bytes = await dibujarComprobante(doc);
  const ruta = `presupuestos/${p.id}.pdf`;

  const { error: eSubida } = await admin.storage
    .from('presupuestos')
    .upload(ruta, bytes, { contentType: 'application/pdf', upsert: true });
  if (eSubida) return responder({ error: `No se pudo guardar el PDF: ${eSubida.message}` }, 500);

  await admin.from('presupuesto').update({ pdf_path: ruta }).eq('id', p.id);

  const { data: firmada, error: eUrl } = await admin.storage
    .from('presupuestos').createSignedUrl(ruta, 3600);
  if (eUrl) return responder({ error: eUrl.message }, 500);

  return responder({ url: firmada.signedUrl, path: ruta });
});
