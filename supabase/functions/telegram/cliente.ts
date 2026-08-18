/**
 * Alta de cliente conversacional, con deteccion de duplicados.
 *
 * Separado de la carga de cliente que vive dentro de /presupuesto: ahi
 * cargar uno nuevo es un paso en el medio de otra cosa y no vale la pena
 * pausar para revisar si ya existe. Aca SI es el proposito completo del
 * comando, asi que antes de pedir un solo dato se busca si ya hay
 * alguien parecido -- typeos incluidos, via similarity() de pg_trgm--.
 * Evita el "Juan Perez" y "Juan Peres" que terminan siendo dos filas sin
 * que nadie note la duplicacion hasta mucho despues.
 *
 * La validacion fiscal (crearCliente, revisarDocumento) es la misma que
 * usa /presupuesto: vive en _shared y no se duplica. Lo que si es propio
 * de este archivo es la secuencia de preguntas, porque el punto de
 * partida es distinto (aca se busca antes de preguntar nada mas).
 */

import { crearCliente, clientesSimilares } from '../_shared/datos-presupuestos.js';
import {
  CONDICIONES_FISCALES, revisarDocumento, formatearDocumento, etiquetaCondicion,
} from '../_shared/fiscal.js';
import { escapar } from '../_shared/formato-telegram.js';
import { guardarPaso as guardarPasoDe, olvidar } from './conversacion.ts';

export const FLUJO = 'cliente';

const P = {
  NOMBRE: 'nombre',
  REVISAR_PARECIDOS: 'revisar_parecidos',
  PERSONA: 'persona',
  TIPO_DOC: 'tipo_doc',
  DOC: 'doc',
  CONDICION: 'condicion',
  TEL: 'tel',
};

const PERSONA_FISICA = 'Persona física';
const EMPRESA = 'Empresa';
const SIN_DOCUMENTO = 'No lo tengo a mano';
const SIN_TELEFONO = 'No tengo el teléfono';
const ES_NUEVO = 'No, es alguien nuevo';

const teclado = (opciones: string[]) => ({
  reply_markup: { keyboard: opciones.map((o) => [{ text: o }]), resize_keyboard: true, one_time_keyboard: true },
});
const sinTeclado = { reply_markup: { remove_keyboard: true } };

const guardarPaso = (admin: any, telegramId: number, paso: string, datos: any) =>
  guardarPasoDe(admin, telegramId, FLUJO, paso, datos);

const resumenFiscal = (c: any) => {
  const doc = c.documento
    ? `${(c.documento_tipo ?? '').toUpperCase()} ${formatearDocumento(c.documento_tipo, c.documento)}`
    : 'sin documento';
  const tel = c.telefono ? ` · ${escapar(c.telefono)}` : '';
  return `${doc} · ${escapar(etiquetaCondicion(c.condicion_fiscal))}${tel}`;
};

export async function arrancar(ctx: any) {
  const { admin, chatId, telegramId, responder } = ctx;
  await guardarPaso(admin, telegramId, P.NOMBRE, {});
  await responder(chatId,
    'Vamos a cargar un cliente.\n\n¿Cómo se llama?\n\n<i>En cualquier momento podés cortar con /cancelar.</i>',
    sinTeclado);
}

export async function continuar(ctx: any, conversacion: any, texto: string) {
  const { admin, chatId, telegramId, responder } = ctx;
  const datos = conversacion.datos ?? {};
  const dicho = String(texto ?? '').trim();

  const seguir = (paso: string, d: any) => guardarPaso(admin, telegramId, paso, d);

  switch (conversacion.paso) {
    case P.NOMBRE: {
      if (dicho.length < 2) {
        await responder(chatId, 'Necesito un nombre para poder buscarlo o guardarlo.');
        return;
      }

      const parecidos = await clientesSimilares(admin, dicho);
      if (parecidos.length > 0) {
        await seguir(P.REVISAR_PARECIDOS, { nombre: dicho, parecidos });
        const lista = parecidos
          .map((p: any) => `• <b>${escapar(p.nombre)}</b>${p.telefono ? ` — ${escapar(p.telefono)}` : ''}`)
          .join('\n');
        await responder(chatId,
          `Ya tengo a alguien parecido cargado:\n\n${lista}\n\n¿Es uno de estos, o es alguien nuevo?`,
          teclado([...parecidos.map((p: any) => p.nombre), ES_NUEVO]));
        return;
      }

      await seguir(P.PERSONA, { nombre: dicho });
      await responder(chatId, `<b>${escapar(dicho)}</b>\n¿Es una persona o una empresa?`,
        teclado([PERSONA_FISICA, EMPRESA]));
      return;
    }

    case P.REVISAR_PARECIDOS: {
      if (dicho === ES_NUEVO) {
        await seguir(P.PERSONA, { nombre: datos.nombre });
        await responder(chatId, `<b>${escapar(datos.nombre)}</b>\n¿Es una persona o una empresa?`,
          teclado([PERSONA_FISICA, EMPRESA]));
        return;
      }
      const elegido = (datos.parecidos ?? []).find((p: any) => p.nombre === dicho);
      if (!elegido) {
        await responder(chatId, 'Tocá uno de los nombres, o "No, es alguien nuevo".',
          teclado([...(datos.parecidos ?? []).map((p: any) => p.nombre), ES_NUEVO]));
        return;
      }
      // Se elige uno existente: no se crea nada, solo se confirma que ya
      // estaba. Es el resultado que evita el duplicado.
      await olvidar(admin, telegramId);
      await responder(chatId,
        `Ya estaba cargado: <b>${escapar(elegido.nombre)}</b>${elegido.telefono ? ` — ${escapar(elegido.telefono)}` : ''}\n\n`
        + 'No se creó ningún cliente nuevo.', sinTeclado);
      return;
    }

    case P.PERSONA: {
      if (dicho !== PERSONA_FISICA && dicho !== EMPRESA) {
        await responder(chatId, 'Elegí una de las dos.', teclado([PERSONA_FISICA, EMPRESA]));
        return;
      }
      const esEmpresa = dicho === EMPRESA;
      const base = { ...datos, tipo_persona: esEmpresa ? 'juridica' : 'fisica' };

      if (esEmpresa) {
        await seguir(P.DOC, { ...base, documento_tipo: 'cuit' });
        await responder(chatId, '¿CUIT? (11 dígitos)', teclado([SIN_DOCUMENTO]));
        return;
      }
      await seguir(P.TIPO_DOC, base);
      await responder(chatId, '¿Con qué documento?', teclado(['DNI', 'CUIL', 'CUIT']));
      return;
    }

    case P.TIPO_DOC: {
      const tipo = dicho.toLowerCase();
      if (!['dni', 'cuil', 'cuit'].includes(tipo)) {
        await responder(chatId, 'Elegí uno de los tres.', teclado(['DNI', 'CUIL', 'CUIT']));
        return;
      }
      await seguir(P.DOC, { ...datos, documento_tipo: tipo });
      await responder(chatId,
        tipo === 'dni' ? '¿Número de DNI?' : `¿Número de ${tipo.toUpperCase()}? (11 dígitos)`,
        teclado([SIN_DOCUMENTO]));
      return;
    }

    case P.DOC: {
      const d = { ...datos };
      if (dicho === SIN_DOCUMENTO) {
        d.documento = null;
        d.documento_tipo = null;
      } else {
        const problema = revisarDocumento({
          tipoPersona: d.tipo_persona, tipoDocumento: d.documento_tipo, documento: dicho,
        });
        if (problema) {
          await responder(chatId, `${escapar(problema)}\n\nProbá de nuevo.`, teclado([SIN_DOCUMENTO]));
          return;
        }
        d.documento = dicho;
      }

      if (d.tipo_persona === 'juridica') {
        await seguir(P.TEL, { ...d, condicion_fiscal: 'responsable_inscripto' });
        await responder(chatId, `¿Teléfono de ${escapar(d.nombre)}?`, teclado([SIN_TELEFONO]));
        return;
      }
      await seguir(P.CONDICION, d);
      await responder(chatId, '¿Condición frente al IVA?',
        teclado(CONDICIONES_FISCALES.map((c: any) => c.etiqueta)));
      return;
    }

    case P.CONDICION: {
      const elegida = CONDICIONES_FISCALES.find((c: any) => c.etiqueta === dicho);
      if (!elegida) {
        await responder(chatId, 'Tocá una de las opciones.',
          teclado(CONDICIONES_FISCALES.map((c: any) => c.etiqueta)));
        return;
      }
      await seguir(P.TEL, { ...datos, condicion_fiscal: elegida.valor });
      await responder(chatId, `¿Teléfono de ${escapar(datos.nombre)}?`, teclado([SIN_TELEFONO]));
      return;
    }

    case P.TEL: {
      const tel = dicho === SIN_TELEFONO ? null : dicho;
      let creado;
      try {
        creado = await crearCliente(admin, { ...datos, telefono: tel });
      } catch (e: any) {
        console.error('No se pudo crear el cliente:', e);
        await responder(chatId,
          `No pude guardarlo: ${escapar(e?.message ?? 'error desconocido')}\n\nArrancá de nuevo con /cliente.`,
          sinTeclado);
        await olvidar(admin, telegramId);
        return;
      }
      await olvidar(admin, telegramId);
      await responder(chatId,
        `Listo, guardé a <b>${escapar(creado.nombre)}</b>.\n\n${resumenFiscal(creado)}`, sinTeclado);
      return;
    }

    default: {
      await olvidar(admin, telegramId);
      await responder(chatId, 'Me perdí. Arrancá de nuevo con /cliente.', sinTeclado);
    }
  }
}
