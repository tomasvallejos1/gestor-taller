/**
 * Bot de Telegram del taller.
 *
 * Webhook y no polling: polling necesita un proceso vivo, que es
 * justamente lo que no hay. El webhook es un endpoint HTTPS que Supabase
 * ya expone.
 *
 * SOBRE LA AUTORIZACION
 *
 * Del lado de Telegram no hay sesion de Supabase, asi que las policies de
 * RLS no pueden aplicarse solas: se lee con service_role. Eso obliga a
 * hacer a mano lo que la base haria por nosotros, y el orden importa:
 * primero se resuelve que perfil es este telegram_id, y si no hay
 * ninguno lo unico que se acepta es /vincular. Un telegram_id suelto no
 * autoriza nada --cualquiera puede escribirle al bot si sabe el nombre--.
 *
 * SOBRE grammy
 *
 * El plan mencionaba grammy. Para cuatro comandos sin conversaciones no
 * aporta lo suficiente como para sumar una dependencia al bundle: son
 * dos llamadas fetch a la API de Telegram. Cuando entren los flujos
 * conversacionales (/cliente, /presupuesto) conviene revisarlo.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { listarMotores, obtenerMotor } from '../_shared/datos-motores.js';
import { formatearFicha, formatearLista, escapar } from '../_shared/formato-telegram.js';
import * as presupuesto from './presupuesto.ts';
import * as cliente from './cliente.ts';
import { procesarFoto } from './ficha.ts';
import { olvidar, conversacionDe } from './conversacion.ts';

const API = 'https://api.telegram.org/bot';

const AYUDA = `Comandos:

/presupuesto — armar uno nuevo y recibir el PDF
/cliente — cargar un cliente, avisando si ya hay uno parecido
/ficha &lt;número&gt; — la ficha técnica completa
/buscar &lt;texto&gt; — busca por descripción, marca o uso
/foto &lt;número&gt; — la foto de la ficha de papel

Mandame directamente una <b>foto</b> de una ficha de papel y disparo la lectura automática.

Para usarlo primero hay que vincular la cuenta: entrá al sistema, Ajustes → Telegram, y mandame el código con /vincular 123456`;

/** Cargar fichas, clientes o presupuestos es escribir: editor o super. */
const puedeEscribir = (perfil: any) => perfil?.rol === 'super' || perfil?.rol === 'editor';

function token(): string {
  const t = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!t) throw new Error('Falta TELEGRAM_BOT_TOKEN');
  return t;
}

async function responder(chatId: number, texto: string, extra: Record<string, unknown> = {}) {
  const r = await fetch(`${API}${token()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...extra,
    }),
  });
  if (!r.ok) console.error('sendMessage fallo:', r.status, await r.text());
}

async function mandarFoto(chatId: number, url: string, pie: string) {
  const r = await fetch(`${API}${token()}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: url, caption: pie, parse_mode: 'HTML' }),
  });
  if (!r.ok) console.error('sendPhoto fallo:', r.status, await r.text());
}

/**
 * Manda un archivo subiendolo, no por URL.
 *
 * Pasarle a Telegram la URL firmada seria una linea menos, pero el nombre
 * del archivo lo sacaria de la URL: al cliente le llegaria un
 * "a3f9c1...pdf". Subiendolo multipart el nombre lo elegimos nosotros, y
 * es lo que la persona ve en la lista de descargas y reenvia por
 * WhatsApp.
 */
async function mandarDocumento(chatId: number, bytes: Uint8Array, nombre: string, pie: string) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', pie);
  form.append('parse_mode', 'HTML');
  // El .slice() copia a un ArrayBuffer propio. Sin eso, TypeScript no
  // puede descartar que el buffer sea un SharedArrayBuffer, que Blob no
  // acepta.
  form.append('document', new Blob([bytes.slice()], { type: 'application/pdf' }), nombre);

  const r = await fetch(`${API}${token()}/sendDocument`, { method: 'POST', body: form });
  if (!r.ok) {
    const detalle = await r.text();
    console.error('sendDocument fallo:', r.status, detalle);
    throw new Error(`sendDocument ${r.status}`);
  }
}

/** Separa "/ficha 12" en comando y resto, ignorando el @bot del final. */
function partir(texto: string): { comando: string; resto: string } {
  const t = (texto ?? '').trim();
  const corte = t.search(/\s/);
  const cabeza = corte === -1 ? t : t.slice(0, corte);
  const resto = corte === -1 ? '' : t.slice(corte + 1).trim();
  return { comando: cabeza.split('@')[0].toLowerCase(), resto };
}

async function manejar(
  admin: any, chatId: number, telegramId: number, texto: string, fotos: any[] | null,
) {
  const { comando, resto } = partir(texto);

  // Quien es este telegram_id. Se resuelve antes que nada.
  const { data: perfil } = await admin
    .from('perfil').select('id, nombre, rol').eq('telegram_id', telegramId).maybeSingle();

  if (fotos?.length) {
    if (!perfil) {
      await responder(chatId, `No te tengo vinculado todavía.\n\n${AYUDA}`);
      return;
    }
    if (!puedeEscribir(perfil)) {
      await responder(chatId, 'Tu perfil no puede cargar fichas.');
      return;
    }
    // Una foto en medio de otro flujo es ambigua: mejor pedir que
    // termine o corte antes que mezclar dos charlas con estado propio.
    const enCharla = await conversacionDe(admin, telegramId);
    if (enCharla) {
      await responder(chatId,
        `Estás en medio de ${enCharla.flujo === 'cliente' ? 'una carga de cliente' : 'un presupuesto'}. `
        + 'Terminalo o cortalo con /cancelar antes de mandar una foto.');
      return;
    }
    await responder(chatId, 'Recibí la foto, dame un momento que la leo...');
    try {
      const { texto: resumen } = await procesarFoto({ admin, perfil, chatId }, fotos, token());
      await responder(chatId, resumen);
    } catch (e) {
      console.error('No se pudo procesar la foto:', e);
      await responder(chatId, 'Algo falló leyendo esa foto. Probá de nuevo, o cargala a mano desde el sistema.');
    }
    return;
  }

  if (comando === '/vincular') {
    if (perfil) {
      await responder(chatId, `Ya estás vinculado como <b>${escapar(perfil.nombre)}</b>.`);
      return;
    }
    const codigo = resto.replace(/\D/g, '');
    if (codigo.length !== 6) {
      await responder(chatId, 'Mandame el código de 6 dígitos así: <code>/vincular 123456</code>');
      return;
    }
    const { data: nombre, error } = await admin.rpc('vincular_telegram', {
      p_codigo: codigo, p_telegram_id: telegramId,
    });
    if (error) { console.error(error); await responder(chatId, 'No pude vincularte, probá de nuevo.'); return; }
    await responder(chatId, nombre
      ? `Listo, quedaste vinculado como <b>${escapar(nombre)}</b>.`
      : 'Ese código no sirve o ya venció. Generá uno nuevo desde Ajustes.');
    return;
  }

  if (!perfil) {
    await responder(chatId, `No te tengo vinculado todavía.\n\n${AYUDA}`);
    return;
  }

  // ---------- Flujos conversacionales ----------
  // Van antes que el resto: mientras hay una charla abierta, un texto
  // suelto ("Juan Perez", "1500,50") es una respuesta, no un comando
  // desconocido.
  const ctx = { admin, chatId, telegramId, perfil, responder, mandarDocumento };

  if (comando === '/cancelar') {
    await olvidar(admin, telegramId);
    await responder(chatId, 'Listo, corté lo que estabas haciendo.',
      { reply_markup: { remove_keyboard: true } });
    return;
  }

  if (comando === '/presupuesto') {
    // Mismo criterio que la web: los precios son de editor para arriba.
    if (!puedeEscribir(perfil)) {
      await responder(chatId, 'Tu perfil no puede emitir presupuestos.');
      return;
    }
    await presupuesto.arrancar(ctx);
    return;
  }

  if (comando === '/cliente') {
    if (!puedeEscribir(perfil)) {
      await responder(chatId, 'Tu perfil no puede cargar clientes.');
      return;
    }
    await cliente.arrancar(ctx);
    return;
  }

  // Un flujo abierto (presupuesto o cliente) intercepta el proximo
  // mensaje. Se distingue por `flujo` porque los dos comparten la misma
  // tabla de estado -- una persona atiende una charla por vez--.
  const charla = await conversacionDe(admin, telegramId);
  if (charla && !comando.startsWith('/')) {
    if (charla.flujo === 'cliente') await cliente.continuar(ctx, charla, texto);
    else await presupuesto.continuar(ctx, charla, texto);
    return;
  }
  if (charla && comando.startsWith('/')) {
    // Un comando corta la charla en vez de intentar mezclarlas: dos
    // flujos a medias es como se pierde lo que uno venia cargando.
    await olvidar(admin, telegramId);
    await responder(chatId,
      `<i>(dejé ${charla.flujo === 'cliente' ? 'la carga de cliente' : 'el presupuesto'} a medio hacer)</i>`,
      { reply_markup: { remove_keyboard: true } });
  }

  if (comando === '/ficha') {
    const nro = resto.replace(/\D/g, '');
    if (!nro) { await responder(chatId, 'Decime el número: <code>/ficha 12</code>'); return; }

    const ficha = await obtenerMotor(admin, nro);
    if (!ficha?.motor) { await responder(chatId, `No encontré la ficha N° ${escapar(nro)}.`); return; }
    await responder(chatId, formatearFicha(ficha));
    return;
  }

  if (comando === '/buscar') {
    if (!resto) { await responder(chatId, 'Decime qué buscar: <code>/buscar czerweny</code>'); return; }
    const { motores, total } = await listarMotores(admin, { texto: resto, porPagina: 10 });
    await responder(chatId, formatearLista(motores, { total }));
    return;
  }

  if (comando === '/foto') {
    const nro = resto.replace(/\D/g, '');
    if (!nro) { await responder(chatId, 'Decime el número: <code>/foto 12</code>'); return; }

    const ficha = await obtenerMotor(admin, nro);
    const foto = (ficha?.fotos ?? []).find((f: any) => f.es_ficha) ?? ficha?.fotos?.[0];
    if (!foto) { await responder(chatId, `La ficha N° ${escapar(nro)} no tiene foto guardada.`); return; }

    // Firmada y de vida corta: la URL viaja por Telegram, que no es
    // nuestro, y no queremos dejar una puerta abierta al bucket.
    const { data, error } = await admin.storage
      .from('fichas').createSignedUrl(foto.storage_path, 600);
    if (error || !data) { await responder(chatId, 'No pude traer la foto.'); return; }

    await mandarFoto(chatId, data.signedUrl, `Ficha N° ${escapar(nro)}`);
    return;
  }

  if (comando === '/start' || comando === '/ayuda' || comando === '/help') {
    await responder(chatId, `Hola ${escapar(perfil.nombre)}.\n\n${AYUDA}`);
    return;
  }

  await responder(chatId, `No conozco ese comando.\n\n${AYUDA}`);
}

Deno.serve(async (req) => {
  // El secreto lo pone Telegram en cada request, y se fija al registrar
  // el webhook. Sin esto, la URL de la funcion es todo lo que hace falta
  // para hacerse pasar por Telegram.
  const esperado = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
  if (!esperado || req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== esperado) {
    return new Response('no', { status: 401 });
  }

  let update: any;
  try { update = await req.json(); } catch { return new Response('ok'); }

  const mensaje = update?.message ?? update?.edited_message;
  const chatId = mensaje?.chat?.id;
  const telegramId = mensaje?.from?.id;
  const updateId = update?.update_id;

  if (!chatId || !telegramId || typeof updateId !== 'number') return new Response('ok');

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Idempotencia ANTES de trabajar. Telegram reintenta si tardamos, y el
  // insert con clave primaria es lo que hace que el segundo intento no
  // vuelva a hacer todo: si choca, este update ya se atendio.
  const { error: eDupe } = await admin
    .from('telegram_update').insert({ update_id: updateId });
  if (eDupe) return new Response('ok');

  const texto = mensaje?.text ?? mensaje?.caption ?? '';
  const fotos = Array.isArray(mensaje?.photo) ? mensaje.photo : null;

  // Se responde 200 ya y se sigue trabajando aparte: Telegram corta a los
  // pocos segundos y reintenta, y una ficha tarda mas que eso.
  const trabajo = manejar(admin, chatId, telegramId, texto, fotos)
    .catch(async (e) => {
      console.error('Error atendiendo el update:', e);
      await responder(chatId, 'Se me complicó procesando eso. Probá de nuevo.').catch(() => {});
    });

  // @ts-ignore EdgeRuntime existe en el runtime de Supabase
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(trabajo);
  else await trabajo;

  return new Response('ok');
});
