/**
 * Cliente del Afip SDK (app.afipsdk.com) para hablar con los webservices
 * de ARCA (ex AFIP) sin implementar WSAA/WSFEv1 propios.
 *
 * Vive en `deno/` por la misma razon que pdf-comprobante.ts: hace
 * fetch() a un servicio externo y lee secretos de Deno.env, y ademas
 * escribe en `arca_token` con la service_role. Nada de esto debe
 * importarse desde `apps/web`.
 *
 * Contrato verificado contra docs.afipsdk.com/integracion/api:
 *
 *   POST /v1/afip/auth
 *     body: { environment, tax_id, wsid, cert?, key? }
 *     header: Authorization: Bearer <ACCESS_TOKEN>
 *     -> { token, sign, expiration }
 *
 *   POST /v1/afip/requests
 *     body: { environment, method, wsid, params }
 *     header: Authorization: Bearer <ACCESS_TOKEN>
 *     -> la respuesta cruda del webservice pedido
 *
 * `token`/`sign` son el TA que da ARCA y hay que reenviarlo en
 * `params.Auth` de cada llamada a un webservice. El TA vale unas 12
 * horas; pedir uno nuevo mientras el anterior sigue vivo hace que AFIP
 * conteste "El CEE ya posee un TA valido", asi que se cachea en la
 * tabla `arca_token` y se renueva solo cuando esta por vencer.
 */

const BASE = 'https://app.afipsdk.com/api/v1/afip';

export interface ContextoArca {
  /** 'dev' usa el CUIT de pruebas del SDK sin certificado propio. */
  environment: 'dev' | 'prod';
  cuit: string;
  cert?: string;
  key?: string;
  accessToken: string;
}

function leerContextoArca(): ContextoArca {
  const environment = Deno.env.get('ARCA_PRODUCCION') === 'true' ? 'prod' : 'dev';
  const accessToken = Deno.env.get('AFIPSDK_ACCESS_TOKEN');
  const cuit = Deno.env.get('ARCA_CUIT');

  if (!accessToken) throw new Error('Falta el secret AFIPSDK_ACCESS_TOKEN.');
  if (!cuit) throw new Error('Falta el secret ARCA_CUIT.');

  return {
    environment,
    cuit,
    cert: Deno.env.get('ARCA_CERT') ?? undefined,
    key: Deno.env.get('ARCA_KEY') ?? undefined,
    accessToken,
  };
}

async function pedirTa(ctx: ContextoArca) {
  const resp = await fetch(`${BASE}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.accessToken}`,
    },
    body: JSON.stringify({
      environment: ctx.environment,
      tax_id: ctx.cuit,
      wsid: 'wsfe',
      ...(ctx.cert ? { cert: ctx.cert, key: ctx.key } : {}),
    }),
  });

  if (!resp.ok) {
    const texto = await resp.text().catch(() => '');
    throw new Error(`No se pudo autenticar contra ARCA (${resp.status}): ${texto}`);
  }

  return resp.json() as Promise<{ token: string; sign: string; expiration: string }>;
}

/**
 * Devuelve un TA valido, del cache si todavia le queda margen o uno
 * nuevo si no. `admin` es el cliente de Supabase con service_role: esta
 * tabla no tiene policies, asi que solo la Edge Function puede tocarla.
 */
export async function obtenerTicket(admin: any, ctx: ContextoArca) {
  const { data: cache } = await admin
    .from('arca_token').select('*').eq('servicio', 'wsfe').maybeSingle();

  const vigente = cache && new Date(cache.expira_en).getTime() > Date.now() + 10 * 60 * 1000;
  if (vigente) return { token: cache.token, sign: cache.sign };

  const ta = await pedirTa(ctx);
  await admin.from('arca_token').upsert({
    servicio: 'wsfe',
    token: ta.token,
    sign: ta.sign,
    expira_en: ta.expiration,
    actualizado_en: new Date().toISOString(),
  });

  return { token: ta.token, sign: ta.sign };
}

async function llamarWsfe(admin: any, ctx: ContextoArca, method: string, params: Record<string, unknown>) {
  const { token, sign } = await obtenerTicket(admin, ctx);

  const resp = await fetch(`${BASE}/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.accessToken}`,
    },
    body: JSON.stringify({
      environment: ctx.environment,
      method,
      wsid: 'wsfe',
      params: {
        Auth: { Token: token, Sign: sign, Cuit: ctx.cuit },
        ...params,
      },
    }),
  });

  const cuerpo = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(`ARCA respondio ${resp.status} en ${method}: ${JSON.stringify(cuerpo)}`);
  }
  return cuerpo;
}

/** Ultimo numero autorizado para un tipo de comprobante y punto de venta. */
export async function fecompUltimoAutorizado(
  admin: any, ctx: ContextoArca, ptoVta: number, cbteTipo: number,
): Promise<number> {
  const r = await llamarWsfe(admin, ctx, 'FECompUltimoAutorizado', {
    PtoVta: ptoVta,
    CbteTipo: cbteTipo,
  });
  return Number(r?.CbteNro ?? 0);
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
}

/** Pide el CAE para UN comprobante (CantReg siempre 1: el taller emite
 *  de a uno, nunca en lote, asi que no hace falta ese camino). */
export async function fecaeSolicitar(
  admin: any, ctx: ContextoArca,
  ptoVta: number, cbteTipo: number, detalle: DetalleFeCae,
): Promise<ResultadoFeCae> {
  const r = await llamarWsfe(admin, ctx, 'FECAESolicitar', {
    FeCAEReq: {
      FeCabReq: { CantReg: 1, PtoVta: ptoVta, CbteTipo: cbteTipo },
      FeDetReq: {
        FECAEDetRequest: {
          Concepto: detalle.concepto,
          DocTipo: detalle.docTipo,
          DocNro: detalle.docNro,
          CbteDesde: detalle.cbteDesde,
          CbteHasta: detalle.cbteHasta,
          CbteFch: detalle.cbteFch,
          FchServDesde: detalle.servDesde ?? undefined,
          FchServHasta: detalle.servHasta ?? undefined,
          FchVtoPago: detalle.vtoPago ?? undefined,
          ImpTotal: detalle.impTotal,
          ImpTotConc: 0,
          ImpNeto: detalle.impNeto,
          ImpOpEx: 0,
          ImpIVA: detalle.impIva,
          ImpTrib: 0,
          MonId: detalle.moneda,
          MonCotiz: detalle.cotizacion,
          CondicionIVAReceptorId: detalle.condicionIvaReceptorId,
        },
      },
    },
  });

  const cabecera = r?.FeCabResp;
  const det = r?.FeDetResp?.FECAEDetResponse?.[0] ?? r?.FeDetResp?.FECAEDetResponse;
  const errores = r?.Errors ?? det?.Errors ?? null;
  const observaciones = det?.Observaciones ?? null;

  return {
    resultado: (det?.Resultado ?? cabecera?.Resultado ?? 'R') as 'A' | 'R' | 'P',
    cae: det?.CAE ?? null,
    caeVencimiento: formatearFechaArca(det?.CAEFchVto),
    observaciones,
    errores,
  };
}

/** Reconciliacion: le pregunta a ARCA por un comprobante ya numerado,
 *  para el caso en que la respuesta de FECAESolicitar se perdio antes
 *  de llegar a confirmar_factura(). Nunca se vuelve a pedir un CAE para
 *  un numero que ya se intento: solo se consulta. */
export async function fecompConsultar(
  admin: any, ctx: ContextoArca, ptoVta: number, cbteTipo: number, numero: number,
) {
  const r = await llamarWsfe(admin, ctx, 'FECompConsultar', {
    FeCompConsReq: { CbteTipo: cbteTipo, CbteNro: numero, PtoVta: ptoVta },
  });

  const det = r?.ResultGet;
  if (!det || !det.CodAutorizacion) return null;

  return {
    cae: String(det.CodAutorizacion),
    caeVencimiento: formatearFechaArca(det.FchVto),
  };
}

/** ARCA devuelve fechas como "20260812"; Postgres quiere "2026-08-12". */
function formatearFechaArca(v: string | null | undefined): string | null {
  if (!v || v.length !== 8) return null;
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
}

export function fechaArca(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export { leerContextoArca };
