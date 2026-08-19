/**
 * La via vieja: hablar con ARCA a traves de app.afipsdk.com.
 *
 * Esto es lo que hacia `arca.ts` entero hasta que se implementaron WSAA
 * y WSFEv1 propios. Queda como segunda via, elegible con el secret
 * `ARCA_VIA=sdk`, por dos motivos concretos:
 *
 *   - permite comparar: la misma factura por las dos vias tiene que dar
 *     el mismo numero y el mismo resultado;
 *   - permite volver atras en el acto, cambiando un secret, si la via
 *     propia se topa con algo que no vimos.
 *
 * Se borra --archivo, rama del switch y secret-- cuando la via propia
 * autorice su primera factura. No se le agregan funciones nuevas.
 *
 * Diferencia importante con la version original: ya no pide ni cachea el
 * ticket de acceso. De eso se ocupa `arca.ts`, que es el que tiene la
 * tabla, para que las dos vias compartan el mismo cache y las mismas
 * reglas de vencimiento.
 */

const BASE = 'https://app.afipsdk.com/api/v1/afip';

export interface ContextoSdk {
  environment: 'dev' | 'prod';
  cuit: string;
  cert?: string;
  key?: string;
  accessToken: string;
}

/** Ticket de acceso, pedido por el SDK. En 'dev' y sin certificado usa
 *  el suyo de pruebas, que es lo unico que esta via todavia ofrece y la
 *  propia no. */
export async function pedirTicketSdk(ctx: ContextoSdk) {
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

  const ta = await resp.json() as { token: string; sign: string; expiration: string };
  return { token: ta.token, sign: ta.sign, expiracion: ta.expiration };
}

/**
 * Un metodo de WSFEv1 por el SDK.
 *
 * Devuelve la respuesta ya desenvuelta de `<Metodo>Result`, con la misma
 * forma que devuelve el cliente SOAP propio, para que la lectura sea
 * compartida (`leerFecae`, `leerUltimoAutorizado`, `leerConsulta`) y no
 * haya dos formas de interpretar lo mismo.
 */
export async function llamarSdk(
  ctx: ContextoSdk,
  auth: { token: string; sign: string; cuit: string },
  method: string,
  params: Record<string, unknown>,
) {
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
        Auth: { Token: auth.token, Sign: auth.sign, Cuit: auth.cuit },
        ...params,
      },
    }),
  });

  const cuerpo = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(`ARCA respondio ${resp.status} en ${method}: ${JSON.stringify(cuerpo)}`);
  }
  return cuerpo?.[`${method}Result`] ?? cuerpo;
}

/** Los params de FECAESolicitar en la forma JSON que espera el SDK. El
 *  orden no importa por esta via; por la propia si, y esta escrito en
 *  `camposFecae()` de `../wsfe-xml.js`. */
export function paramsFecaeSdk(ptoVta: number, cbteTipo: number, d: any) {
  const servicios = d.concepto !== 1;
  return {
    FeCAEReq: {
      FeCabReq: { CantReg: 1, PtoVta: ptoVta, CbteTipo: cbteTipo },
      FeDetReq: {
        FECAEDetRequest: {
          Concepto: d.concepto,
          DocTipo: d.docTipo,
          DocNro: d.docNro,
          CbteDesde: d.cbteDesde,
          CbteHasta: d.cbteHasta,
          CbteFch: d.cbteFch,
          FchServDesde: servicios ? d.servDesde ?? undefined : undefined,
          FchServHasta: servicios ? d.servHasta ?? undefined : undefined,
          FchVtoPago: servicios ? d.vtoPago ?? undefined : undefined,
          ImpTotal: d.impTotal,
          ImpTotConc: 0,
          ImpNeto: d.impNeto,
          ImpOpEx: 0,
          ImpIVA: d.impIva,
          ImpTrib: 0,
          MonId: d.moneda,
          MonCotiz: d.cotizacion,
          CondicionIVAReceptorId: d.condicionIvaReceptorId,
        },
      },
    },
  };
}
