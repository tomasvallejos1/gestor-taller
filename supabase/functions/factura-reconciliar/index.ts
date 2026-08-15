/**
 * Boton "Verificar en ARCA".
 *
 * Pregunta por una factura que quedo en 'pendiente' con un numero ya
 * anotado --el caso en que se pidio el CAE y la respuesta nunca se
 * termino de guardar-- sin volver a llamar FECAESolicitar. Reintentar el
 * pedido para un numero ya anotado es exactamente lo que produce un
 * comprobante duplicado; consultar no.
 *
 * `factura-emitir` ya hace esta misma consulta al principio de cada
 * intento nuevo, asi que en el uso normal esto nunca hace falta. Existe
 * para el caso en que alguien vio la factura pendiente, no volvio a
 * tocar "Facturar", y quiere saber si ARCA la autorizo igual.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { leerContextoArca, fecompConsultar } from '../_shared/deno/arca.ts';

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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const autorizacion = req.headers.get('Authorization');
  if (!autorizacion) return responder({ error: 'Falta autorizacion.' }, 401);

  const admin = createClient(url, servicio);

  const comoUsuario = createClient(url, anonKey, {
    global: { headers: { Authorization: autorizacion } },
  });
  const { data: { user } } = await comoUsuario.auth.getUser();
  if (!user) return responder({ error: 'Sesion invalida.' }, 401);

  const { data: rol } = await comoUsuario.rpc('rol_actual');
  if (rol !== 'super' && rol !== 'editor') {
    return responder({ error: 'Tu perfil no puede verificar facturas.' }, 403);
  }

  let cuerpo: { factura_id?: string };
  try { cuerpo = await req.json(); } catch { return responder({ error: 'Cuerpo invalido.' }, 400); }
  if (!cuerpo.factura_id) return responder({ error: 'Falta factura_id.' }, 400);

  const { data: f, error: eF } = await admin
    .from('factura')
    .select('id, estado, cbte_tipo, punto_venta, numero')
    .eq('id', cuerpo.factura_id)
    .maybeSingle();

  if (eF || !f) return responder({ error: 'No encontramos esa factura.' }, 404);

  if (f.estado === 'autorizada') {
    return responder({ estado: 'autorizada', numero: f.numero });
  }
  if (!f.numero) {
    return responder({ estado: f.estado, mensaje: 'Todavia no se le pidio un numero a ARCA.' });
  }

  let ctx;
  try {
    ctx = leerContextoArca();
  } catch (e) {
    return responder({ error: (e as Error).message }, 500);
  }

  const consulta = await fecompConsultar(admin, ctx, f.punto_venta, f.cbte_tipo, f.numero);

  if (!consulta) {
    return responder({ estado: f.estado, mensaje: 'ARCA no tiene ningun comprobante con ese numero todavia.' });
  }

  await admin.rpc('confirmar_factura', {
    p_factura_id: f.id, p_cae: consulta.cae, p_cae_vto: consulta.caeVencimiento, p_obs: null,
  });

  return responder({ estado: 'autorizada', cae: consulta.cae, cae_vencimiento: consulta.caeVencimiento });
});
