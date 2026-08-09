/**
 * Armar un presupuesto conversando.
 *
 * El webhook no tiene memoria, asi que cada respuesta se interpreta
 * mirando en que paso quedo la charla (tabla telegram_conversacion). El
 * flujo es una maquina de estados chica y explicita: cada paso sabe que
 * pregunto y a donde va con la respuesta.
 *
 * SOBRE LOS TECLADOS
 *
 * Se usan teclados de RESPUESTA (`keyboard`) y no botones inline
 * (`inline_keyboard`). Los inline mandan `callback_query`, y el webhook
 * esta registrado con allowed_updates: ['message']: los botones se verian
 * lindos y no haria nada al tocarlos. Los de respuesta mandan un mensaje
 * comun, que es lo que este bot ya sabe atender.
 *
 * SOBRE LOS NUMEROS
 *
 * Los precios se escriben como se escriben acá: "1.500,50". El punto es
 * separador de miles y la coma el decimal, al reves de lo que entiende
 * Number(). Convertirlo mal no da error, da un presupuesto por mil veces
 * menos, asi que se parsea a mano y se rechaza lo que no cierra.
 */

import {
  buscarClientes, crearCliente, crearPresupuesto, guardarItems,
  obtenerPresupuesto, pesos, numeroComprobante, nombreArchivo,
} from '../_shared/datos-presupuestos.js';
import {
  CONDICIONES_FISCALES, revisarDocumento, formatearDocumento, etiquetaCondicion,
} from '../_shared/fiscal.js';
import { escapar } from '../_shared/formato-telegram.js';
import { guardarPaso as guardarPasoDe, olvidar } from './conversacion.ts';

export const FLUJO = 'presupuesto';

const P = {
  CLIENTE_MODO: 'cliente_modo',
  CLIENTE_BUSCAR: 'cliente_buscar',
  CLIENTE_ELEGIR: 'cliente_elegir',
  NUEVO_NOMBRE: 'nuevo_nombre',
  NUEVO_PERSONA: 'nuevo_persona',
  NUEVO_TIPO_DOC: 'nuevo_tipo_doc',
  NUEVO_DOC: 'nuevo_doc',
  NUEVO_CONDICION: 'nuevo_condicion',
  NUEVO_TEL: 'nuevo_tel',
  ITEM_DESC: 'item_desc',
  ITEM_CANT: 'item_cant',
  ITEM_PRECIO: 'item_precio',
  ITEM_MAS: 'item_mas',
  VIGENCIA: 'vigencia',
  NOTAS: 'notas',
  CONFIRMAR: 'confirmar',
};

const BUSCAR = 'Buscar un cliente';
const NUEVO = 'Cargar uno nuevo';
const SIN_CLIENTE = 'Sin cliente';
const OTRO_RENGLON = 'Agregar otro renglón';
const TERMINAR = 'Terminar y ver el total';
const SIN_TELEFONO = 'No tengo el teléfono';
const SIN_NOTAS = 'Sin observaciones';
const CONFIRMAR_SI = 'Emitir el presupuesto';
const VOLVER_BUSCAR = 'Buscar de nuevo';
const PERSONA_FISICA = 'Persona física';
const EMPRESA = 'Empresa';
const SIN_DOCUMENTO = 'No lo tengo a mano';

/** Teclado de respuesta, una opcion por fila. */
const teclado = (opciones: string[]) => ({
  reply_markup: {
    keyboard: opciones.map((o) => [{ text: o }]),
    resize_keyboard: true,
    one_time_keyboard: true,
  },
});

const sinTeclado = { reply_markup: { remove_keyboard: true } };

/**
 * "1.500,50" -> 1500.5 · "1500" -> 1500 · "abc" -> null
 *
 * Si hay coma, manda como decimal y los puntos son miles. Sin coma, un
 * punto solo con 1 o 2 decimales tambien se acepta ("12.50"), pero
 * "1.500" se lee como mil quinientos: en un precio del taller es mucho
 * mas probable que sea eso que uno con milesimas.
 */
export function parsearMonto(texto: string): number | null {
  const t = String(texto ?? '').replace(/[^\d.,-]/g, '').trim();
  if (!t) return null;

  let normal: string;
  if (t.includes(',')) {
    normal = t.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+\.\d{1,2}$/.test(t)) {
    normal = t;
  } else {
    normal = t.replace(/\./g, '');
  }

  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** Cantidades: acepta decimales ("1,5 kg de barniz") pero no negativos. */
export function parsearCantidad(texto: string): number | null {
  const n = parsearMonto(texto);
  if (n === null || n <= 0) return null;
  return n;
}

// ---------------------------------------------------------------
//  Estado
// ---------------------------------------------------------------

const guardarPaso = (admin: any, telegramId: number, paso: string, datos: any) =>
  guardarPasoDe(admin, telegramId, FLUJO, paso, datos);

// ---------------------------------------------------------------
//  Resumen
// ---------------------------------------------------------------

function resumen(datos: any): string {
  const items = datos.items ?? [];
  const total = items.reduce(
    (a: number, i: any) => a + (Number(i.cantidad) || 0) * (Number(i.precio_unit) || 0), 0,
  );

  // Los datos fiscales salen impresos en el PDF que recibe el cliente.
  // Se muestran acá porque en el alta de una empresa la condicion no se
  // pregunta --se asume responsable inscripto-- y este es el unico lugar
  // donde se puede ver antes de emitir.
  const f = datos.cliente_fiscal;
  const fiscal = f
    ? `\n<i>${f.documento
        ? `${(f.documento_tipo ?? '').toUpperCase()} ${formatearDocumento(f.documento_tipo, f.documento)} · `
        : ''}${escapar(etiquetaCondicion(f.condicion_fiscal))}</i>`
    : '';

  const quien = datos.cliente_nombre
    ? `${escapar(datos.cliente_nombre)}${fiscal}`
    : '<i>sin cliente</i>';

  const renglones = items.map((i: any, n: number) => {
    const sub = (Number(i.cantidad) || 0) * (Number(i.precio_unit) || 0);
    const cant = Number(i.cantidad);
    const cantTxt = cant % 1 === 0 ? String(cant) : String(i.cantidad).replace('.', ',');
    return `${n + 1}. ${escapar(i.descripcion)}\n    ${cantTxt} × ${pesos(i.precio_unit)} = <b>${pesos(sub)}</b>`;
  }).join('\n');

  return `<b>Presupuesto para:</b> ${quien}\n\n${renglones}\n\n<b>TOTAL: ${pesos(total)}</b>`;
}

// ---------------------------------------------------------------
//  Entrada al flujo
// ---------------------------------------------------------------

export async function arrancar(ctx: any) {
  const { admin, chatId, telegramId, responder } = ctx;
  await guardarPaso(admin, telegramId, P.CLIENTE_MODO, { items: [] });
  await responder(
    chatId,
    'Vamos con un presupuesto nuevo.\n\n¿Para quién es?\n\n<i>En cualquier momento podés cortar con /cancelar.</i>',
    teclado([BUSCAR, NUEVO, SIN_CLIENTE]),
  );
}

// ---------------------------------------------------------------
//  Paso a paso
// ---------------------------------------------------------------

export async function continuar(ctx: any, conversacion: any, texto: string) {
  const { admin, chatId, telegramId, responder } = ctx;
  const datos = conversacion.datos ?? {};
  const dicho = String(texto ?? '').trim();

  const seguir = (paso: string, d: any) => guardarPaso(admin, telegramId, paso, d);

  switch (conversacion.paso) {
    // ---------- Cliente ----------
    case P.CLIENTE_MODO: {
      if (dicho === SIN_CLIENTE) {
        await seguir(P.ITEM_DESC, { ...datos, cliente_id: null, cliente_nombre: null });
        await responder(chatId,
          'Va sin cliente asignado.\n\n<b>Renglón 1</b>\n¿Qué trabajo o repuesto va?',
          sinTeclado);
        return;
      }
      if (dicho === NUEVO) {
        await seguir(P.NUEVO_NOMBRE, datos);
        await responder(chatId, '¿Cómo se llama el cliente?', sinTeclado);
        return;
      }
      if (dicho === BUSCAR) {
        await seguir(P.CLIENTE_BUSCAR, datos);
        await responder(chatId, 'Escribime parte del nombre.', sinTeclado);
        return;
      }
      await responder(chatId, 'Elegí una de las opciones.', teclado([BUSCAR, NUEVO, SIN_CLIENTE]));
      return;
    }

    case P.CLIENTE_BUSCAR: {
      const encontrados = await buscarClientes(admin, dicho);
      if (encontrados.length === 0) {
        await responder(chatId,
          `No encontré ninguno con "${escapar(dicho)}".\n\nProbá con otra parte del nombre, o cargalo nuevo.`,
          teclado([NUEVO, SIN_CLIENTE]));
        // Se queda en el mismo paso: el proximo texto es otra busqueda.
        await seguir(P.CLIENTE_BUSCAR, datos);
        return;
      }

      // Los candidatos se guardan para no volver a consultar y, sobre
      // todo, para no depender de que el nombre tipeado matchee exacto.
      // Se guardan tambien sus datos fiscales: son los que van a salir
      // impresos, y el resumen final los tiene que poder mostrar.
      const candidatos = encontrados.map((c: any) => ({
        id: c.id,
        nombre: c.nombre,
        documento: c.documento,
        documento_tipo: c.documento_tipo,
        condicion_fiscal: c.condicion_fiscal,
      }));
      await seguir(P.CLIENTE_ELEGIR, { ...datos, candidatos });
      await responder(chatId, 'Tocá el que corresponda:',
        teclado([...candidatos.map((c: any) => c.nombre), VOLVER_BUSCAR]));
      return;
    }

    case P.CLIENTE_ELEGIR: {
      if (dicho === VOLVER_BUSCAR) {
        await seguir(P.CLIENTE_BUSCAR, { ...datos, candidatos: null });
        await responder(chatId, 'Escribime parte del nombre.', sinTeclado);
        return;
      }
      const elegido = (datos.candidatos ?? []).find((c: any) => c.nombre === dicho);
      if (!elegido) {
        await responder(chatId, 'Tocá uno de los botones, o "Buscar de nuevo".',
          teclado([...(datos.candidatos ?? []).map((c: any) => c.nombre), VOLVER_BUSCAR]));
        return;
      }
      await seguir(P.ITEM_DESC, {
        ...datos,
        cliente_id: elegido.id,
        cliente_nombre: elegido.nombre,
        cliente_fiscal: {
          documento: elegido.documento,
          documento_tipo: elegido.documento_tipo,
          condicion_fiscal: elegido.condicion_fiscal,
        },
        candidatos: null,
      });
      await responder(chatId,
        `Presupuesto para <b>${escapar(elegido.nombre)}</b>.\n\n<b>Renglón 1</b>\n¿Qué trabajo o repuesto va?`,
        sinTeclado);
      return;
    }

    case P.NUEVO_NOMBRE: {
      if (dicho.length < 2) {
        await responder(chatId, 'Necesito un nombre para poder guardarlo.');
        return;
      }
      await seguir(P.NUEVO_PERSONA, { ...datos, nuevo: { nombre: dicho } });
      await responder(chatId, `<b>${escapar(dicho)}</b>\n¿Es una persona o una empresa?`,
        teclado([PERSONA_FISICA, EMPRESA]));
      return;
    }

    case P.NUEVO_PERSONA: {
      if (dicho !== PERSONA_FISICA && dicho !== EMPRESA) {
        await responder(chatId, 'Elegí una de las dos.', teclado([PERSONA_FISICA, EMPRESA]));
        return;
      }
      const esEmpresa = dicho === EMPRESA;
      const nuevo = { ...datos.nuevo, tipo_persona: esEmpresa ? 'juridica' : 'fisica' };

      if (esEmpresa) {
        // Una empresa se identifica con CUIT y punto: preguntarle el tipo
        // de documento seria ofrecerle dos opciones que la validacion
        // rechaza despues.
        await seguir(P.NUEVO_DOC, { ...datos, nuevo: { ...nuevo, documento_tipo: 'cuit' } });
        await responder(chatId, '¿CUIT? (11 dígitos)', teclado([SIN_DOCUMENTO]));
        return;
      }

      await seguir(P.NUEVO_TIPO_DOC, { ...datos, nuevo });
      await responder(chatId, '¿Con qué documento?', teclado(['DNI', 'CUIL', 'CUIT']));
      return;
    }

    case P.NUEVO_TIPO_DOC: {
      const tipo = dicho.toLowerCase();
      if (!['dni', 'cuil', 'cuit'].includes(tipo)) {
        await responder(chatId, 'Elegí uno de los tres.', teclado(['DNI', 'CUIL', 'CUIT']));
        return;
      }
      await seguir(P.NUEVO_DOC, { ...datos, nuevo: { ...datos.nuevo, documento_tipo: tipo } });
      await responder(chatId,
        tipo === 'dni' ? '¿Número de DNI?' : `¿Número de ${tipo.toUpperCase()}? (11 dígitos)`,
        teclado([SIN_DOCUMENTO]));
      return;
    }

    case P.NUEVO_DOC: {
      const nuevo = { ...datos.nuevo };

      if (dicho === SIN_DOCUMENTO) {
        nuevo.documento = null;
        nuevo.documento_tipo = null;
      } else {
        // Se valida acá y no al guardar: el modulo 11 del CUIT atrapa un
        // digito cambiado, y avisarlo ahora es una pregunta de nuevo. Que
        // salte al final significa perder toda la carga.
        const problema = revisarDocumento({
          tipoPersona: nuevo.tipo_persona,
          tipoDocumento: nuevo.documento_tipo,
          documento: dicho,
        });
        if (problema) {
          await responder(chatId, `${escapar(problema)}\n\nProbá de nuevo.`, teclado([SIN_DOCUMENTO]));
          return;
        }
        nuevo.documento = dicho;
      }

      if (nuevo.tipo_persona === 'juridica') {
        // Para empresas no se pregunta la condicion: se asume responsable
        // inscripto, que es lo habitual. Queda a la vista en el resumen
        // antes de emitir, para poder frenarlo si no corresponde.
        await seguir(P.NUEVO_TEL, {
          ...datos, nuevo: { ...nuevo, condicion_fiscal: 'responsable_inscripto' },
        });
        await responder(chatId, `¿Teléfono de ${escapar(nuevo.nombre)}?`, teclado([SIN_TELEFONO]));
        return;
      }

      await seguir(P.NUEVO_CONDICION, { ...datos, nuevo });
      await responder(chatId, '¿Condición frente al IVA?',
        teclado(CONDICIONES_FISCALES.map((c: any) => c.etiqueta)));
      return;
    }

    case P.NUEVO_CONDICION: {
      const elegida = CONDICIONES_FISCALES.find((c: any) => c.etiqueta === dicho);
      if (!elegida) {
        await responder(chatId, 'Tocá una de las opciones.',
          teclado(CONDICIONES_FISCALES.map((c: any) => c.etiqueta)));
        return;
      }
      await seguir(P.NUEVO_TEL, {
        ...datos, nuevo: { ...datos.nuevo, condicion_fiscal: elegida.valor },
      });
      await responder(chatId, `¿Teléfono de ${escapar(datos.nuevo.nombre)}?`, teclado([SIN_TELEFONO]));
      return;
    }

    case P.NUEVO_TEL: {
      const tel = dicho === SIN_TELEFONO ? null : dicho;
      let creado;
      try {
        creado = await crearCliente(admin, { ...datos.nuevo, telefono: tel });
      } catch (e: any) {
        console.error('No se pudo crear el cliente:', e);
        await responder(chatId,
          `No pude guardarlo: ${escapar(e?.message ?? 'error desconocido')}\n\n`
          + 'Arrancá de nuevo con /presupuesto.', sinTeclado);
        await olvidar(admin, telegramId);
        return;
      }
      await seguir(P.ITEM_DESC, {
        ...datos,
        cliente_id: creado.id,
        cliente_nombre: creado.nombre,
        cliente_fiscal: {
          documento: creado.documento,
          documento_tipo: creado.documento_tipo,
          condicion_fiscal: creado.condicion_fiscal,
        },
        nuevo: null,
      });
      await responder(chatId,
        `Cliente <b>${escapar(creado.nombre)}</b> guardado.\n\n<b>Renglón 1</b>\n¿Qué trabajo o repuesto va?`,
        sinTeclado);
      return;
    }

    // ---------- Renglones ----------
    case P.ITEM_DESC: {
      if (dicho.length < 2) {
        await responder(chatId, 'Describime el trabajo o el repuesto, aunque sea corto.');
        return;
      }
      await seguir(P.ITEM_CANT, { ...datos, borrador: { descripcion: dicho } });
      await responder(chatId, `<b>${escapar(dicho)}</b>\n¿Cuántas unidades?`, teclado(['1']));
      return;
    }

    case P.ITEM_CANT: {
      const cant = parsearCantidad(dicho);
      if (cant === null) {
        await responder(chatId, 'Necesito un número mayor que cero. Por ejemplo: <code>2</code>');
        return;
      }
      await seguir(P.ITEM_PRECIO, {
        ...datos, borrador: { ...datos.borrador, cantidad: cant },
      });
      await responder(chatId,
        '¿Precio por unidad?\n\n<i>Se escribe como en el papel: 1.500,50</i>',
        sinTeclado);
      return;
    }

    case P.ITEM_PRECIO: {
      const precio = parsearMonto(dicho);
      if (precio === null || precio < 0) {
        await responder(chatId, 'No entendí ese precio. Por ejemplo: <code>1.500,50</code>');
        return;
      }
      const items = [...(datos.items ?? []), { ...datos.borrador, precio_unit: precio }];
      const nuevos = { ...datos, items, borrador: null };
      await seguir(P.ITEM_MAS, nuevos);
      await responder(chatId, `${resumen(nuevos)}\n\n¿Agregás otro renglón?`,
        teclado([OTRO_RENGLON, TERMINAR]));
      return;
    }

    case P.ITEM_MAS: {
      if (dicho === OTRO_RENGLON) {
        await seguir(P.ITEM_DESC, datos);
        await responder(chatId,
          `<b>Renglón ${(datos.items ?? []).length + 1}</b>\n¿Qué trabajo o repuesto va?`,
          sinTeclado);
        return;
      }
      if (dicho === TERMINAR) {
        await seguir(P.VIGENCIA, datos);
        await responder(chatId, '¿Por cuántos días vale el presupuesto?',
          teclado(['15 días', '30 días', '60 días']));
        return;
      }
      await responder(chatId, 'Elegí una de las dos opciones.', teclado([OTRO_RENGLON, TERMINAR]));
      return;
    }

    // ---------- Cierre ----------
    case P.VIGENCIA: {
      const dias = parseInt(dicho.replace(/\D/g, ''), 10);
      if (!Number.isFinite(dias) || dias < 1 || dias > 365) {
        await responder(chatId, 'Decime un número de días, entre 1 y 365.',
          teclado(['15 días', '30 días', '60 días']));
        return;
      }
      await seguir(P.NOTAS, { ...datos, vigencia_dias: dias });
      await responder(chatId,
        '¿Alguna observación para que vea el cliente?\n\n<i>Plazos, condiciones de pago, lo que sea.</i>',
        teclado([SIN_NOTAS]));
      return;
    }

    case P.NOTAS: {
      const notas = dicho === SIN_NOTAS ? null : dicho;
      const listos = { ...datos, notas };
      await seguir(P.CONFIRMAR, listos);
      await responder(chatId,
        `${resumen(listos)}\n\nVale ${listos.vigencia_dias} días.`
        + `${notas ? `\n\n<b>Observaciones:</b> ${escapar(notas)}` : ''}`
        + '\n\n¿Lo emito?',
        teclado([CONFIRMAR_SI, 'Cancelar']));
      return;
    }

    case P.CONFIRMAR: {
      if (dicho !== CONFIRMAR_SI) {
        await olvidar(admin, telegramId);
        await responder(chatId, 'Listo, lo descarté. No se guardó nada.', sinTeclado);
        return;
      }
      await emitir(ctx, datos);
      return;
    }

    default:
      await olvidar(admin, telegramId);
      await responder(chatId, 'Me perdí. Arrancá de nuevo con /presupuesto.', sinTeclado);
  }
}

// ---------------------------------------------------------------
//  Emision
// ---------------------------------------------------------------

async function emitir(ctx: any, datos: any) {
  const { admin, chatId, telegramId, responder, mandarDocumento } = ctx;

  await responder(chatId, 'Emitiendo y armando el PDF...', sinTeclado);

  let presupuesto;
  try {
    presupuesto = await crearPresupuesto(admin, {
      cliente_id: datos.cliente_id,
      vigencia_dias: datos.vigencia_dias,
      notas: datos.notas,
    });
    await guardarItems(admin, presupuesto.id, datos.items ?? []);
    // Relectura: los totales los pone un trigger al insertar los
    // renglones, asi que la fila que devolvio el insert todavia dice 0.
    presupuesto = await obtenerPresupuesto(admin, presupuesto.id);
  } catch (e) {
    console.error('No se pudo crear el presupuesto:', e);
    await olvidar(admin, telegramId);
    await responder(chatId, 'No pude guardar el presupuesto. Probá de nuevo con /presupuesto.');
    return;
  }

  // Guardado. De acá en adelante, si algo falla el presupuesto YA existe:
  // hay que decirlo, no dejar creer que se perdio todo.
  await olvidar(admin, telegramId);

  const numero = numeroComprobante(presupuesto);

  try {
    const bytes = await pdfDe(presupuesto.id);
    await mandarDocumento(chatId, bytes, nombreArchivo(presupuesto),
      `Presupuesto N° ${numero} · <b>${pesos(presupuesto.total)}</b>`);
  } catch (e) {
    console.error('El PDF fallo:', e);
    await responder(chatId,
      `El presupuesto <b>N° ${numero}</b> quedó guardado por ${pesos(presupuesto.total)}, `
      + 'pero no pude generar el PDF. Descargalo desde el sistema.');
  }
}

/**
 * Pide el PDF a la funcion que ya lo sabe hacer.
 *
 * Se llama con service_role porque del lado del bot no hay sesion de
 * usuario. Duplicar el generador para esquivar eso terminaria en dos PDF
 * distintos del mismo presupuesto, que es peor que esta llamada interna.
 */
async function pdfDe(presupuestoId: string): Promise<Uint8Array> {
  const url = Deno.env.get('SUPABASE_URL')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const r = await fetch(`${url}/functions/v1/presupuesto-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${servicio}`,
      apikey: servicio,
    },
    body: JSON.stringify({ presupuesto_id: presupuestoId }),
  });

  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok || !cuerpo?.url) {
    throw new Error(cuerpo?.error ?? `presupuesto-pdf respondio ${r.status}`);
  }

  const archivo = await fetch(cuerpo.url);
  if (!archivo.ok) throw new Error(`No se pudo bajar el PDF (${archivo.status})`);
  return new Uint8Array(await archivo.arrayBuffer());
}
