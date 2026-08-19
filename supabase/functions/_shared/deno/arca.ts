/**
 * La frontera con ARCA (ex AFIP).
 *
 * Es lo unico que conocen `factura-emitir` y `factura-reconciliar`:
 * cinco funciones que no cambiaron de firma cuando abajo se reemplazo un
 * intermediario por WSAA y WSFEv1 propios.
 *
 * Vive en `deno/` por la misma razon que pdf-comprobante.ts: hace
 * fetch() a un servicio externo, lee secretos de Deno.env y escribe en
 * `arca_token` con la service_role. Nada de esto debe importarse desde
 * `apps/web`.
 *
 * ---------------------------------------------------------------
 * Dos vias, un solo camino de datos
 *
 *   ARCA_VIA=propio (default)  wsaa.ts + wsfe.ts, SOAP directo
 *   ARCA_VIA=sdk               sdk.ts, via app.afipsdk.com
 *
 * La segunda existe para poder comparar y para poder volver atras
 * cambiando un secret. Las dos entregan la respuesta con la misma forma
 * y la LEEN con las mismas funciones de `../wsfe-xml.js`: si algun dia
 * difieren, la diferencia esta en el transporte, no en como se
 * interpreta lo que dijo ARCA.
 *
 * ---------------------------------------------------------------
 * El cache del ticket
 *
 * El TA vale unas 12 horas y ARCA no entrega dos validos a la vez: pedir
 * uno nuevo mientras el anterior vive contesta "El CEE ya posee un TA
 * valido". Por eso se guarda en `arca_token` y se renueva recien cuando
 * le quedan menos de 10 minutos.
 *
 * La fila esta partida por entorno y ademas se compara el CUIT: un
 * ticket de homologacion no sirve en produccion, y uno emitido para el
 * CUIT de pruebas del SDK no sirve para el CUIT del taller. Las dos
 * confusiones son faciles de provocar cambiando un secret, y las dos dan
 * errores que no hablan del ticket.
 */

import * as wsaa from './wsaa.ts';
import * as wsfe from './wsfe.ts';
import * as sdk from './sdk.ts';
import {
  fechaArca, leerFecae, leerUltimoAutorizado, leerConsulta,
} from '../wsfe-xml.js';

export { fechaArca };

export interface ContextoArca {
  /** 'dev' es homologacion. */
  environment: 'dev' | 'prod';
  via: 'propio' | 'sdk';
  cuit: string;
  cert?: string;
  key?: string;
  accessToken?: string;
}

function leerContextoArca(): ContextoArca {
  const environment = Deno.env.get('ARCA_PRODUCCION') === 'true' ? 'prod' : 'dev';
  const via = Deno.env.get('ARCA_VIA') === 'sdk' ? 'sdk' : 'propio';
  const cuit = Deno.env.get('ARCA_CUIT');
  const cert = Deno.env.get('ARCA_CERT') || undefined;
  const key = Deno.env.get('ARCA_KEY') || undefined;
  const accessToken = Deno.env.get('AFIPSDK_ACCESS_TOKEN') || undefined;

  if (!cuit) throw new Error('Falta el secret ARCA_CUIT.');

  if (via === 'sdk') {
    if (!accessToken) throw new Error('Falta el secret AFIPSDK_ACCESS_TOKEN.');
  } else if (!cert || !key) {
    // Con la via propia no hay certificado prestado: sin el certificado
    // del taller no hay forma de firmar el ticket de acceso.
    throw new Error(
      'Faltan los secrets ARCA_CERT y ARCA_KEY. Se sacan en WSASS para homologacion '
      + 'o en Administracion de Certificados Digitales para produccion.',
    );
  }

  return { environment, via, cuit, cert, key, accessToken };
}

const esProduccion = (ctx: ContextoArca) => ctx.environment === 'prod';

/**
 * Un TA valido: el de la tabla si todavia le queda margen, o uno nuevo.
 * `admin` es el cliente con service_role, que es el unico que puede
 * tocar `arca_token` (la tabla no tiene policies).
 */
export async function obtenerTicket(admin: any, ctx: ContextoArca) {
  const { data: cache } = await admin
    .from('arca_token').select('*')
    .eq('servicio', 'wsfe').eq('entorno', ctx.environment)
    .maybeSingle();

  const vigente = cache
    && cache.cuit === ctx.cuit
    && new Date(cache.expira_en).getTime() > Date.now() + 10 * 60 * 1000;
  if (vigente) return { token: cache.token, sign: cache.sign, cuit: ctx.cuit };

  let ta;
  try {
    ta = ctx.via === 'sdk'
      ? await sdk.pedirTicketSdk(ctx as sdk.ContextoSdk)
      : await wsaa.pedirTicketAcceso('wsfe', {
        cert: ctx.cert!, key: ctx.key!, produccion: esProduccion(ctx),
      });
  } catch (e) {
    // Los ultimos 10 minutos de vida del ticket son una zona gris: para
    // nosotros ya no sirve --no queremos empezar una emision con un
    // ticket a punto de morir-- pero para ARCA sigue vivo, y entonces se
    // niega a dar otro. Ahi lo correcto es seguir usando el que hay.
    const yaHayUno = /ya posee un ta/i.test((e as Error).message ?? '');
    if (yaHayUno && cache?.cuit === ctx.cuit
        && new Date(cache.expira_en).getTime() > Date.now()) {
      return { token: cache.token, sign: cache.sign, cuit: ctx.cuit };
    }
    throw e;
  }

  await admin.from('arca_token').upsert({
    servicio: 'wsfe',
    entorno: ctx.environment,
    cuit: ctx.cuit,
    token: ta.token,
    sign: ta.sign,
    // Sin vencimiento declarado se asume corto: mejor pedir de mas que
    // usar un ticket muerto y no entender por que rebota todo.
    expira_en: ta.expiracion ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    actualizado_en: new Date().toISOString(),
  }, { onConflict: 'servicio,entorno' });

  return { token: ta.token, sign: ta.sign, cuit: ctx.cuit };
}

/** Ultimo numero autorizado para un tipo de comprobante y punto de venta. */
export async function fecompUltimoAutorizado(
  admin: any, ctx: ContextoArca, ptoVta: number, cbteTipo: number,
): Promise<number> {
  const auth = await obtenerTicket(admin, ctx);

  if (ctx.via === 'sdk') {
    const r = await sdk.llamarSdk(ctx as sdk.ContextoSdk, auth, 'FECompUltimoAutorizado', {
      PtoVta: ptoVta, CbteTipo: cbteTipo,
    });
    return leerUltimoAutorizado(r);
  }
  return wsfe.ultimoAutorizado(auth, ptoVta, cbteTipo, esProduccion(ctx));
}

export interface DetalleFeCae {
  concepto: number;
  docTipo: number;
  docNro: number;
  cbteDesde: number;
  cbteHasta: number;
  cbteFch: string;       // yyyymmdd
  servDesde?: string | null;
  servHasta?: string | null;
  vtoPago?: string | null;
  impTotal: number;
  impNeto: number;
  impIva: number;
  moneda: string;
  cotizacion: number;
  condicionIvaReceptorId: number;
}

export interface ResultadoFeCae {
  resultado: 'A' | 'R' | 'P';
  cae: string | null;
  caeVencimiento: string | null;
  observaciones: unknown;
  errores: unknown;
  /** La respuesta entera, para el caso en que no venga ni CAE ni error.
   *  Sin esto, un cambio de forma del otro lado se ve como un rechazo
   *  vacio y no queda rastro de que contesto ARCA en realidad. */
  crudo: unknown;
}

/** Pide el CAE para UN comprobante (CantReg siempre 1: el taller emite
 *  de a uno, nunca en lote, asi que no hace falta ese camino). */
export async function fecaeSolicitar(
  admin: any, ctx: ContextoArca,
  ptoVta: number, cbteTipo: number, detalle: DetalleFeCae,
): Promise<ResultadoFeCae> {
  const auth = await obtenerTicket(admin, ctx);

  if (ctx.via === 'sdk') {
    const r = await sdk.llamarSdk(ctx as sdk.ContextoSdk, auth, 'FECAESolicitar',
      sdk.paramsFecaeSdk(ptoVta, cbteTipo, detalle));
    return leerFecae(r) as ResultadoFeCae;
  }
  return wsfe.solicitarCae(auth, ptoVta, cbteTipo, detalle, esProduccion(ctx)) as Promise<ResultadoFeCae>;
}

/**
 * Reconciliacion: le pregunta a ARCA por un comprobante ya numerado,
 * para el caso en que la respuesta de FECAESolicitar se perdio antes de
 * llegar a confirmar_factura(). Nunca se vuelve a pedir un CAE para un
 * numero que ya se intento: solo se consulta.
 */
export async function fecompConsultar(
  admin: any, ctx: ContextoArca, ptoVta: number, cbteTipo: number, numero: number,
) {
  const auth = await obtenerTicket(admin, ctx);

  if (ctx.via === 'sdk') {
    const r = await sdk.llamarSdk(ctx as sdk.ContextoSdk, auth, 'FECompConsultar', {
      FeCompConsReq: { CbteTipo: cbteTipo, CbteNro: numero, PtoVta: ptoVta },
    });
    return leerConsulta(r);
  }
  return wsfe.consultar(auth, ptoVta, cbteTipo, numero, esProduccion(ctx));
}

export { leerContextoArca };
