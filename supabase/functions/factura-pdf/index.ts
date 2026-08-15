/**
 * PDF de la factura.
 *
 * Mismo esqueleto que presupuesto-pdf y remito-pdf. La diferencia esta
 * toda en `normalizarComprobante('factura', ...)`: sin la leyenda de
 * "documento no valido como factura", con la letra que corresponda al
 * tipo de comprobante, y con el bloque de QR + CAE cuando la factura ya
 * esta autorizada.
 *
 * Solo se genera PDF de una factura con estado 'autorizada'. Una
 * 'pendiente' todavia no tiene CAE ni numero definitivo -- imprimirla
 * asi produciria un papel que no coincide con lo que despues autorice
 * ARCA, que es exactamente el tipo de error que este modulo existe para
 * evitar.
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
      return responder({ error: 'Tu perfil no puede ver facturas.' }, 403);
    }
    lector = comoUsuario;
  }

  let cuerpo: { factura_id?: string };
  try { cuerpo = await req.json(); } catch { return responder({ error: 'Cuerpo invalido.' }, 400); }
  if (!cuerpo.factura_id) return responder({ error: 'Falta factura_id.' }, 400);

  const { data: f, error: eF } = await lector
    .from('factura')
    .select(`
      id, estado, cbte_tipo, punto_venta, numero, cbte_fecha,
      subtotal, descuento, iva_pct, total, notas,
      doc_tipo, doc_nro, cae, cae_vencimiento,
      cliente_nombre, cliente_documento, cliente_documento_tipo, cliente_condicion_fiscal,
      cliente_domicilio
    `)
    .eq('id', cuerpo.factura_id)
    .maybeSingle();

  if (eF || !f) return responder({ error: 'No encontramos esa factura.' }, 404);
  if (f.estado !== 'autorizada') {
    return responder({ error: 'Esta factura todavia no tiene CAE. Emitila primero.' }, 409);
  }

  const { data: items } = await lector
    .from('factura_item')
    .select('descripcion, cantidad, precio_unit, subtotal, orden')
    .eq('factura_id', f.id)
    .order('orden');

  const { data: cfg } = await lector
    .from('configuracion').select('*').eq('id', 1).single();

  const doc = normalizarComprobante('factura', f, items ?? [], cfg);

  const bytes = await dibujarComprobante(doc);
  const ruta = `facturas/${f.id}.pdf`;

  const { error: eSubida } = await admin.storage
    .from('comprobantes')
    .upload(ruta, bytes, { contentType: 'application/pdf', upsert: true });
  if (eSubida) return responder({ error: `No se pudo guardar el PDF: ${eSubida.message}` }, 500);

  await admin.from('factura').update({ pdf_path: ruta }).eq('id', f.id);

  const { data: firmada, error: eUrl } = await admin.storage
    .from('comprobantes').createSignedUrl(ruta, 3600);
  if (eUrl) return responder({ error: eUrl.message }, 500);

  return responder({ url: firmada.signedUrl, path: ruta });
});
