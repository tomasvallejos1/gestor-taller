/**
 * Extraccion de una ficha de motor a partir de su foto.
 *
 * Recibe el id de una fila de ficha_extraccion ya creada (con la imagen
 * en Storage), llama al proveedor de vision y deja el resultado en
 * datos_json con estado 'revision'.
 *
 * NUNCA crea el motor. El estado 'revision' es el final del camino
 * automatico: una persona confirma despues. Una ficha de bobinado mal
 * cargada significa un motor rebobinado mal, que es perdida material.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { extraerConRespaldo } from './proveedores.ts';

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

/** Tope diario por usuario. Sin esto, un bucle genera una factura sorpresa. */
const LIMITE_DIARIO = Number(Deno.env.get('LIMITE_EXTRACCIONES_DIA') ?? '80');

function aBase64(bytes: Uint8Array): string {
  // btoa sobre un string armado de a pedazos: pasar el Uint8Array entero
  // a String.fromCharCode revienta la pila con imagenes grandes.
  let binario = '';
  const trozo = 8192;
  for (let i = 0; i < bytes.length; i += trozo) {
    binario += String.fromCharCode(...bytes.subarray(i, i + trozo));
  }
  return btoa(binario);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return responder({ error: 'Metodo no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const autorizacion = req.headers.get('Authorization');
  if (!autorizacion) return responder({ error: 'Falta autorizacion.' }, 401);

  const comoUsuario = createClient(url, anon, {
    global: { headers: { Authorization: autorizacion } },
  });

  const { data: { user } } = await comoUsuario.auth.getUser();
  if (!user) return responder({ error: 'Sesion invalida o vencida.' }, 401);

  // Cargar una ficha es escribir: lo permite editor o super.
  const { data: rol } = await comoUsuario.rpc('rol_actual');
  if (rol !== 'super' && rol !== 'editor') {
    return responder({ error: 'Tu perfil no puede cargar fichas.' }, 403);
  }

  let cuerpo: { extraccion_id?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: 'Cuerpo invalido.' }, 400);
  }

  const id = cuerpo.extraccion_id;
  if (!id) return responder({ error: 'Falta extraccion_id.' }, 400);

  const admin = createClient(url, servicio);

  const { data: usadas } = await comoUsuario.rpc('extracciones_hoy', { p_usuario: user.id });
  if ((usadas ?? 0) > LIMITE_DIARIO) {
    return responder({
      error: `Llegaste al limite de ${LIMITE_DIARIO} fichas por dia. `
        + 'Podes seguir cargandolas a mano.',
    }, 429);
  }

  const { data: extraccion, error: errorFila } = await admin
    .from('ficha_extraccion')
    .select('id, storage_path, estado, creado_por')
    .eq('id', id)
    .single();

  if (errorFila || !extraccion) return responder({ error: 'No existe esa extraccion.' }, 404);

  if (extraccion.creado_por !== user.id && rol !== 'super') {
    return responder({ error: 'Esa extraccion es de otro usuario.' }, 403);
  }

  if (extraccion.estado === 'procesando') {
    return responder({ error: 'Esa ficha ya se esta procesando.' }, 409);
  }
  if (extraccion.estado === 'confirmada') {
    return responder({ error: 'Esa ficha ya fue confirmada.' }, 409);
  }

  await admin.from('ficha_extraccion')
    .update({ estado: 'procesando', error: null })
    .eq('id', id);

  try {
    const { data: archivo, error: errorArchivo } = await admin.storage
      .from('fichas')
      .download(extraccion.storage_path);

    if (errorArchivo || !archivo) {
      throw new Error(`No se pudo leer la imagen: ${errorArchivo?.message ?? 'sin datos'}`);
    }

    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const mimeType = archivo.type || 'image/jpeg';

    const resultado = await extraerConRespaldo(aBase64(bytes), mimeType);

    const lineas = resultado.extraccion.lineas ?? [];

    // La transcripcion SIEMPRE se guarda, aunque el modelo haya dicho que
    // la foto es dudosa o no haya sacado nada. Descartarla obligaria a
    // repetir la llamada para poder mirar que leyo, y deja a la persona
    // sin ninguna pista de por que fallo.
    const datos = {
      ...resultado.extraccion,
      _proveedor: resultado.proveedor,
      _modelo: resultado.modelo,
    };

    // Solo se marca como error cuando de verdad no hay nada con que
    // trabajar. Si leyo aunque sea unas lineas, va a revision: la persona
    // decide si sirve, que es justamente el rol de la revision.
    const sinContenido = lineas.length === 0;
    const dudosa = resultado.extraccion.legible === false;

    if (sinContenido) {
      await admin.from('ficha_extraccion').update({
        estado: 'error',
        datos_json: datos,
        error: resultado.extraccion.nota
          || 'No se pudo leer nada de la foto. Probá de nuevo con mejor luz, '
            + 'de frente, sin sombras y que entre la ficha entera.',
        tokens_in: resultado.tokensEntrada,
        tokens_out: resultado.tokensSalida,
      }).eq('id', id);

      return responder({ estado: 'error', nota: resultado.extraccion.nota }, 200);
    }

    await admin.from('ficha_extraccion').update({
      estado: 'revision',
      datos_json: datos,
      tokens_in: resultado.tokensEntrada,
      tokens_out: resultado.tokensSalida,
      error: dudosa
        ? (resultado.extraccion.nota
          || 'El sistema marco la foto como poco clara. Compara cada dato con cuidado.')
        : null,
    }).eq('id', id);

    return responder({
      estado: 'revision',
      proveedor: resultado.proveedor,
      modelo: resultado.modelo,
      lineas: resultado.extraccion.lineas.length,
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    await admin.from('ficha_extraccion')
      .update({ estado: 'error', error: mensaje.slice(0, 900) })
      .eq('id', id);
    return responder({ estado: 'error', error: mensaje }, 200);
  }
});
