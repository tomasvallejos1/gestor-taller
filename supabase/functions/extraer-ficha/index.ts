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
 *
 * REGLA DE ORO: esta funcion no puede terminar sin dejar la fila en un
 * estado final. Una fila que queda en 'procesando' es una pantalla
 * girando para siempre del otro lado, que es exactamente lo que pasaba
 * cuando la mataban por pasarse de los 150s de reloj de pared. Por eso
 * todo el trabajo corre contra un presupuesto que termina bastante antes
 * de ese limite, y todas las salidas tempranas marcan la fila.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { extraerConRespaldo, type Intento, type Resultado } from './proveedores.ts';

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

/**
 * Presupuesto de reloj para todo el trabajo, desde que entra la request.
 *
 * Supabase mata la Edge Function a los 150s de reloj de pared, y cuando
 * la mata no corre ningun `catch` ni ningun `finally`: la fila se queda
 * como estaba. Terminar en 120 deja 30s de margen para escribir el
 * resultado y responder, con cold start incluido.
 */
const PRESUPUESTO_MS = Number(Deno.env.get('EXTRACCION_PRESUPUESTO_MS') ?? '120000');

/**
 * Pasado esto, una fila en 'procesando' no esta procesando nada: es una
 * corrida anterior que murio sin dejar rastro. Se puede retomar.
 */
const VENTANA_TRABADA_MS = PRESUPUESTO_MS + 30_000;

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

  const arranque = Date.now();
  const restante = () => PRESUPUESTO_MS - (Date.now() - arranque);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const autorizacion = req.headers.get('Authorization');
  if (!autorizacion) return responder({ error: 'Falta autorizacion.' }, 401);

  const admin = createClient(url, servicio);

  let cuerpo: { extraccion_id?: string; usuario_id?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: 'Cuerpo invalido.' }, 400);
  }

  const id = cuerpo.extraccion_id;
  if (!id) return responder({ error: 'Falta extraccion_id.' }, 400);

  /**
   * Deja la fila en 'error' antes de salir.
   *
   * Toda salida temprana que no marque la fila la deja en 'pendiente' y
   * el que espera del otro lado no se entera nunca: para el, el sistema
   * se colgo. El limite diario era justamente eso --devolvia 429 y
   * dejaba la pantalla girando-- y era imposible de adivinar desde la
   * app.
   */
  const marcarError = async (mensaje: string) => {
    await admin.from('ficha_extraccion')
      .update({ estado: 'error', error: mensaje.slice(0, 900) })
      .eq('id', id)
      .in('estado', ['pendiente', 'procesando']);
  };

  /**
   * Misma puerta interna que presupuesto-pdf: la service_role no sale
   * nunca del backend, asi que presentarla ya prueba que es codigo
   * nuestro. El bot de Telegram no tiene sesion de usuario, y ya resolvio
   * el permiso (telegram_id -> perfil -> rol) antes de llegar aca, asi
   * que manda el id de quien carga en el cuerpo en vez de en un JWT.
   */
  const interno = autorizacion === `Bearer ${servicio}`;
  let usuarioId: string;
  let esSuper = false;

  if (interno) {
    if (!cuerpo.usuario_id) return responder({ error: 'Falta usuario_id.' }, 400);
    usuarioId = cuerpo.usuario_id;
    // El permiso (editor/super) ya lo resolvio el bot antes de crear la
    // fila y de llamar aca. No hay sesion de la que volver a sacarlo.
  } else {
    const comoUsuario = createClient(url, anon, {
      global: { headers: { Authorization: autorizacion } },
    });
    const { data: { user } } = await comoUsuario.auth.getUser();
    if (!user) return responder({ error: 'Sesion invalida o vencida.' }, 401);

    // Cargar una ficha es escribir: lo permite editor o super. No se
    // marca la fila aca: todavia no se sabe si es de quien llama, y
    // quien no es editor tampoco pudo haberla creado --la policy de
    // insert exige es_editor--, asi que no hay ninguna fila propia que
    // desbloquear. Marcarla igual solo dejaria tocar las ajenas.
    const { data: rol } = await comoUsuario.rpc('rol_actual');
    if (rol !== 'super' && rol !== 'editor') {
      return responder({ error: 'Tu perfil no puede cargar fichas.' }, 403);
    }
    usuarioId = user.id;
    esSuper = rol === 'super';
  }

  const { data: extraccion, error: errorFila } = await admin
    .from('ficha_extraccion')
    .select('id, storage_path, estado, creado_por, actualizado_en')
    .eq('id', id)
    .single();

  if (errorFila || !extraccion) return responder({ error: 'No existe esa extraccion.' }, 404);

  // Llamada interna: la fila la acaba de crear este mismo bot, con
  // creado_por = usuarioId. No hay otro usuario del que protegerla.
  if (!interno && extraccion.creado_por !== usuarioId && !esSuper) {
    return responder({ error: 'Esa extraccion es de otro usuario.' }, 403);
  }

  // El limite se chequea recien aca, con la fila ya en mano y verificada
  // como propia. Si se chequeara antes, marcarla al rechazarla seria
  // marcar una fila de la que todavia no se sabe de quien es.
  const { data: usadas } = await admin.rpc('extracciones_hoy', { p_usuario: usuarioId });
  if ((usadas ?? 0) > LIMITE_DIARIO) {
    const mensaje = `Llegaste al limite de ${LIMITE_DIARIO} fichas por dia. `
      + 'Podes seguir cargandolas a mano.';
    await marcarError(mensaje);
    return responder({ error: mensaje }, 429);
  }

  if (extraccion.estado === 'confirmada') {
    return responder({ error: 'Esa ficha ya fue confirmada.' }, 409);
  }

  if (extraccion.estado === 'procesando') {
    // Una corrida de verdad en curso no se pisa: serian dos llamadas
    // pagas por la misma foto. Pero pasada la ventana no hay ninguna
    // corrida --la anterior murio sin poder marcar nada-- y negarse aca
    // dejaba la fila trabada sin forma de reintentarla.
    const desde = Date.parse(extraccion.actualizado_en);
    if (Number.isFinite(desde) && Date.now() - desde < VENTANA_TRABADA_MS) {
      return responder({ error: 'Esa ficha ya se esta procesando.' }, 409);
    }
    console.log(`Se retoma ${id}: quedo en 'procesando' desde ${extraccion.actualizado_en}.`);
  }

  await admin.from('ficha_extraccion')
    .update({ estado: 'procesando', error: null })
    .eq('id', id);

  // Se llena sola dentro de extraerConRespaldo y se guarda con la ficha
  // pase lo que pase, incluso si al final no contesto nadie.
  const bitacora: Intento[] = [];

  try {
    /**
     * Todo el trabajo corre contra el presupuesto. Si algo se cuelga
     * --Storage, el modelo, la red-- pierde la carrera y el `catch` de
     * abajo marca la fila. Lo que importa no es que el trabajo se
     * cancele (el isolate se muere igual despues de responder) sino
     * llegar vivos a escribir el estado final.
     */
    const trabajo = (async () => {
      const { data: archivo, error: errorArchivo } = await admin.storage
        .from('fichas')
        .download(extraccion.storage_path);

      if (errorArchivo || !archivo) {
        throw new Error(`No se pudo leer la imagen: ${errorArchivo?.message ?? 'sin datos'}`);
      }

      const bytes = new Uint8Array(await archivo.arrayBuffer());
      const mimeType = archivo.type || 'image/jpeg';

      return await extraerConRespaldo(aBase64(bytes), mimeType, restante(), bitacora);
    })();

    // Si gana el vencimiento, `trabajo` sigue vivo y puede fallar despues
    // de que ya nadie lo este esperando. Un rechazo sin manejar tumba el
    // isolate, y tumbarlo justo aca significa morir sin escribir la fila:
    // exactamente el estado colgado que todo esto viene a evitar.
    trabajo.catch(() => { /* ya se decidio por vencimiento */ });

    let reloj: number | undefined;
    const vencimiento = new Promise<never>((_, rechazar) => {
      reloj = setTimeout(
        () => rechazar(new Error(
          'La lectura tardo mas de lo que el sistema puede esperar. '
          + 'La foto quedo guardada: probá "Reintentar" en un momento.',
        )),
        Math.max(1000, restante()),
      );
    });

    let resultado: Resultado;
    try {
      resultado = await Promise.race([trabajo, vencimiento]);
    } finally {
      clearTimeout(reloj);
    }

    const lineas = resultado.extraccion.lineas ?? [];

    // La transcripcion SIEMPRE se guarda, aunque el modelo haya dicho que
    // la foto es dudosa o no haya sacado nada. Descartarla obligaria a
    // repetir la llamada para poder mirar que leyo, y deja a la persona
    // sin ninguna pista de por que fallo.
    const datos = {
      ...resultado.extraccion,
      _proveedor: resultado.proveedor,
      _modelo: resultado.modelo,
      // Cuanto tardo de punta a punta y por que manos paso. Sin esto,
      // entender una demora obliga a cruzar a mano los logs de la
      // plataforma contra las filas por timestamp.
      _ms: Date.now() - arranque,
      _intentos: bitacora,
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

    console.log(`${id} lista en ${Date.now() - arranque}ms con ${resultado.proveedor}.`);

    return responder({
      estado: 'revision',
      proveedor: resultado.proveedor,
      modelo: resultado.modelo,
      lineas: resultado.extraccion.lineas.length,
      ms: Date.now() - arranque,
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    const ms = Date.now() - arranque;
    console.error(`${id} fallo en ${ms}ms: ${mensaje}`);

    // Una lectura fallida es la que MAS falta hace poder diagnosticar, y
    // era justo la que no dejaba nada. Se guardan los intentos salvo que
    // alguno haya salido bien --ahi el que fallo fue algo posterior y
    // datos_json ya tiene la transcripcion, que vale mas--.
    const huboExito = bitacora.some((i) => i.ok);

    await admin.from('ficha_extraccion')
      .update({
        estado: 'error',
        error: mensaje.slice(0, 900),
        ...(huboExito ? {} : { datos_json: { _ms: ms, _intentos: bitacora } }),
      })
      .eq('id', id);

    return responder({ estado: 'error', error: mensaje, ms }, 200);
  }
});
