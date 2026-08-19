/**
 * Foto de una ficha de papel mandada por Telegram.
 *
 * El flujo entero corre en una sola llamada, sin conversacion ni estado
 * intermedio: bajar la foto, subirla al bucket, crear la fila y llamar a
 * extraer-ficha. Es posible porque extraer-ficha procesa de punto a punto
 * ANTES de responder --no dispara y se olvida, como hace la web-- asi que
 * aca alcanza con esperar esa respuesta.
 *
 * Pero esta funcion tiene su propio limite de 150s de reloj, y arranca a
 * gastarlo antes que la otra: para cuando llama a extraer-ficha ya bajo
 * la foto de Telegram y la subio al bucket. Si esperara sin techo, la
 * lectura podria terminar bien del otro lado y este proceso morir sin
 * contestarle nunca a quien mando la foto. Por eso la espera se corta
 * antes y el mensaje explica donde quedo: la fila ya existe y la lectura
 * sigue igual, se recupera desde el sistema.
 *
 * NUNCA crea el motor. Igual que en la web, el resultado queda en estado
 * 'revision' y una persona lo confirma desde el sistema. Un bobinado mal
 * cargado por apuro es un motor rebobinado mal.
 */

import { escapar } from '../_shared/formato-telegram.js';

const API = 'https://api.telegram.org/bot';

/** El array `photo` de Telegram trae varios tamaños; el ultimo es el mas grande. */
function mayorTamano(fotos: any[]): any {
  return fotos.reduce((a, b) => (b.file_size > (a?.file_size ?? 0) ? b : a), null);
}

async function bajarFoto(fileId: string, token: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const rInfo = await fetch(`${API}${token}/getFile?file_id=${fileId}`);
  const info = await rInfo.json();
  if (!info.ok) throw new Error(`getFile fallo: ${info.description ?? 'sin detalle'}`);

  const rArchivo = await fetch(`https://api.telegram.org/file/bot${token}/${info.result.file_path}`);
  if (!rArchivo.ok) throw new Error(`No se pudo bajar la foto (${rArchivo.status})`);

  // Telegram comprime las fotos de camara a JPEG siempre, aunque el
  // original fuera otra cosa.
  return { bytes: new Uint8Array(await rArchivo.arrayBuffer()), mime: 'image/jpeg' };
}

/**
 * Recibe la foto, dispara la extraccion y devuelve un resumen para
 * mandar por chat.
 *
 * @param ctx {admin, perfil, chatId}
 * @param fotos el array `message.photo` de Telegram
 */
export async function procesarFoto(
  ctx: { admin: any; perfil: any; chatId: number },
  fotos: any[],
  token: string,
): Promise<{ texto: string; extraccionId: string | null }> {
  const { admin, perfil } = ctx;

  const elegida = mayorTamano(fotos);
  if (!elegida) return { texto: 'No pude leer esa foto.', extraccionId: null };

  const { bytes, mime } = await bajarFoto(elegida.file_id, token);

  const ruta = `extracciones/${crypto.randomUUID()}.jpg`;
  const { error: errorSubida } = await admin.storage
    .from('fichas').upload(ruta, bytes, { contentType: mime });
  if (errorSubida) throw new Error(`No se pudo guardar la foto: ${errorSubida.message}`);

  const { data: fila, error: errorFila } = await admin
    .from('ficha_extraccion')
    .insert({ storage_path: ruta, origen: 'telegram', creado_por: perfil.id })
    .select('id')
    .single();

  if (errorFila) {
    await admin.storage.from('fichas').remove([ruta]);
    throw new Error(`No se pudo registrar la lectura: ${errorFila.message}`);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const appUrl = Deno.env.get('APP_URL');
  const linkRevisar = appUrl
    ? `\n\n<a href="${appUrl}/sistema/motores/nuevo?ficha=${fila.id}">Abrir en el sistema</a>`
    : '\n\nEntrá a Motores → Nueva ficha, esa lectura te va a estar esperando.';

  let r: Response;
  try {
    r = await fetch(`${url}/functions/v1/extraer-ficha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${servicio}`,
        apikey: servicio,
      },
      body: JSON.stringify({ extraccion_id: fila.id, usuario_id: perfil.id }),
      // extraer-ficha se corta sola a los 120s y siempre deja la fila en
      // un estado final, asi que 135 alcanzan para su respuesta y dejan
      // margen para contestarle a Telegram antes de que maten a esta.
      signal: AbortSignal.timeout(135_000),
    });
  } catch (e) {
    console.error(`extraer-ficha no contesto para ${fila.id}:`, e);
    return {
      extraccionId: fila.id,
      texto: 'Guardé la foto pero la lectura está tardando de más. '
        + `Sigue corriendo del lado del servidor.${linkRevisar}`,
    };
  }

  const resultado = await r.json().catch(() => ({}));

  if (resultado?.estado === 'error') {
    return {
      extraccionId: fila.id,
      texto: `No pude leer nada útil de esa foto.\n\n`
        + `${escapar(resultado.nota ?? 'Probá de nuevo con mejor luz, de frente, sin sombras y que entre la ficha entera.')}`,
    };
  }

  if (!r.ok || !resultado?.estado) {
    // La foto quedo subida igual: desde el sistema se reintenta la
    // lectura sin volver a sacarla, que es lo que importa si el motor ya
    // esta desarmado en el banco.
    return {
      extraccionId: fila.id,
      texto: 'Se subió la foto pero la lectura falló. Se puede reintentar '
        + `sin volver a sacarla.${linkRevisar}`,
    };
  }

  return {
    extraccionId: fila.id,
    texto: `Listo, leí <b>${resultado.lineas ?? 0}</b> dato(s) de la ficha.\n\n`
      + `Como siempre, nada se guarda solo: entrá al sistema y confirmá antes de que quede cargada.`
      + `${linkRevisar}`,
  };
}
