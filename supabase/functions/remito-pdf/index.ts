/**
 * PDF del remito.
 *
 * Mismo esqueleto que presupuesto-pdf: el dibujo vive en
 * _shared/deno/pdf-comprobante.ts y esta funcion solo resuelve permisos,
 * lee los datos y arma el objeto normalizado.
 *
 * El remito NO es un comprobante fiscal --misma leyenda "documento no
 * valido como factura" que el presupuesto-- pero a diferencia de ese, es
 * el papel que se entrega junto con el motor: lleva el diagnostico, el
 * medio de pago y el total final, que puede diferir del presupuestado.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { dibujarComprobante } from '../_shared/deno/pdf-comprobante.ts';
import { normalizarComprobante, ETIQUETA_MEDIO_PAGO } from '../_shared/comprobante-modelo.js';

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
      return responder({ error: 'Tu perfil no puede emitir remitos.' }, 403);
    }
    lector = comoUsuario;
  }

  let cuerpo: { remito_id?: string };
  try { cuerpo = await req.json(); } catch { return responder({ error: 'Cuerpo invalido.' }, 400); }
  if (!cuerpo.remito_id) return responder({ error: 'Falta remito_id.' }, 400);

  const { data: r, error: eR } = await lector
    .from('remito')
    .select(`
      id, numero, punto_venta, fecha, medio_pago, subtotal, descuento, iva_pct, total,
      notas, reparacion_id,
      cliente_nombre, cliente_documento, cliente_documento_tipo, cliente_condicion_fiscal,
      cliente_domicilio
    `)
    .eq('id', cuerpo.remito_id)
    .maybeSingle();

  if (eR || !r) return responder({ error: 'No encontramos ese remito.' }, 404);

  const { data: items } = await lector
    .from('remito_item')
    .select('descripcion, cantidad, precio_unit, subtotal, orden')
    .eq('remito_id', r.id)
    .order('orden');

  const { data: cfg } = await lector
    .from('configuracion').select('*').eq('id', 1).single();

  const doc = normalizarComprobante('remito', r, items ?? [], cfg, {
    etiquetaMedioPago: ETIQUETA_MEDIO_PAGO[r.medio_pago as string] ?? 'A convenir',
  });

  const bytes = await dibujarComprobante(doc);
  const ruta = `remitos/${r.id}.pdf`;

  const { error: eSubida } = await admin.storage
    .from('comprobantes')
    .upload(ruta, bytes, { contentType: 'application/pdf', upsert: true });
  if (eSubida) return responder({ error: `No se pudo guardar el PDF: ${eSubida.message}` }, 500);

  await admin.from('remito').update({ pdf_path: ruta }).eq('id', r.id);

  const { data: firmada, error: eUrl } = await admin.storage
    .from('comprobantes').createSignedUrl(ruta, 3600);
  if (eUrl) return responder({ error: eUrl.message }, 500);

  return responder({ url: firmada.signedUrl, path: ruta });
});
