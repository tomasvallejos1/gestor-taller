/**
 * WSFEv1: los tres metodos de facturacion electronica que usa el taller.
 *
 *   FECompUltimoAutorizado - que numero sigue
 *   FECAESolicitar         - pedir el CAE
 *   FECompConsultar        - preguntar por un comprobante ya numerado
 *
 * Es SOAP 1.1 sobre HTTP: un POST con un XML y una respuesta con otro.
 * El armado y la lectura estan en `../wsfe-xml.js`, que se testea con
 * `node --test`; aca queda solo lo que necesita red.
 *
 * El orden de los elementos de cada pedido esta verificado contra el
 * WSDL de homologacion. No es un detalle de estilo: los tipos son
 * `xs:sequence` y ARCA rechaza lo que venga desordenado.
 */

import { XMLParser } from 'npm:fast-xml-parser@4.5.0';
import {
  NS_WSFE, sobreWsfe, camposFecae, leerFecae, leerUltimoAutorizado, leerConsulta,
} from '../wsfe-xml.js';

const URL_WSFE = {
  dev: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  prod: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
};

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  // Sin conversion automatica de numeros. El CAE son 14 digitos y el
  // dia que ARCA emita uno con cero adelante, pasarlo por Number lo
  // convierte en un CAE distinto del que quedo impreso en el papel.
  parseTagValue: false,
  trimValues: true,
});

export interface AuthWsfe {
  token: string;
  sign: string;
  cuit: string;
}

/**
 * Un metodo cualquiera de WSFEv1.
 *
 * La respuesta viene envuelta en `<Metodo>Response` / `<Metodo>Result`,
 * que es la envoltura del SOAP. Desenvolverla aca, a la vista y en un
 * solo lugar, es justamente lo que faltaba cuando esto pasaba por un
 * intermediario: leerla un nivel mas arriba no falla, devuelve undefined
 * y hace que todo parezca un rechazo sin motivo.
 */
async function llamar(
  metodo: string,
  auth: AuthWsfe,
  campos: unknown[],
  produccion: boolean,
): Promise<any> {
  const resp = await fetch(URL_WSFE[produccion ? 'prod' : 'dev'], {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `${NS_WSFE}${metodo}`,
    },
    body: sobreWsfe(metodo, auth, campos),
  });

  const texto = await resp.text();
  const cuerpo = parser.parse(texto)?.Envelope?.Body;

  const falla = cuerpo?.Fault;
  if (falla) {
    throw new Error(`ARCA rechazo el pedido de ${metodo}: ${falla.faultstring ?? JSON.stringify(falla)}`);
  }
  if (!resp.ok) {
    throw new Error(`ARCA respondio ${resp.status} en ${metodo}: ${texto.slice(0, 300)}`);
  }

  const res = cuerpo?.[`${metodo}Response`]?.[`${metodo}Result`];
  if (res === undefined) {
    throw new Error(`Respuesta inesperada de ${metodo}: ${texto.slice(0, 300)}`);
  }
  return res;
}

/** Ultimo numero autorizado para un punto de venta y tipo. */
export async function ultimoAutorizado(
  auth: AuthWsfe, ptoVta: number, cbteTipo: number, produccion: boolean,
): Promise<number> {
  const res = await llamar('FECompUltimoAutorizado', auth, [
    ['PtoVta', ptoVta],
    ['CbteTipo', cbteTipo],
  ], produccion);
  return leerUltimoAutorizado(res);
}

/** Pide el CAE de UN comprobante. */
export async function solicitarCae(
  auth: AuthWsfe, ptoVta: number, cbteTipo: number, detalle: unknown, produccion: boolean,
) {
  const res = await llamar('FECAESolicitar', auth,
    camposFecae(ptoVta, cbteTipo, detalle), produccion);
  return leerFecae(res);
}

/** Consulta un comprobante ya numerado. No pide ni consume nada. */
export async function consultar(
  auth: AuthWsfe, ptoVta: number, cbteTipo: number, numero: number, produccion: boolean,
) {
  const res = await llamar('FECompConsultar', auth, [
    // Orden del WSDL: CbteTipo, CbteNro, PtoVta. No es alfabetico ni el
    // mismo que usa FECompUltimoAutorizado, asi que no se puede deducir.
    ['FeCompConsReq', [
      ['CbteTipo', cbteTipo],
      ['CbteNro', numero],
      ['PtoVta', ptoVta],
    ]],
  ], produccion);
  return leerConsulta(res);
}
