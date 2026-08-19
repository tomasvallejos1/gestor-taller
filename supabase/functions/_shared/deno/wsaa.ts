/**
 * WSAA: conseguir el ticket de acceso a los webservices de ARCA.
 *
 * El protocolo entero son tres pasos:
 *
 *   1. armar un TRA (un XML con una ventana de tiempo y el servicio que
 *      se quiere usar),
 *   2. firmarlo en CMS/PKCS#7 con el certificado del taller,
 *   3. mandarlo a loginCms, que devuelve un token y una firma que valen
 *      unas 12 horas.
 *
 * El unico paso que no es texto es el segundo. No hay CMS en la
 * biblioteca estandar --ni en Deno ni en Node: `node:crypto` firma, pero
 * no arma la estructura ASN.1 de SignedData-- asi que se usa node-forge,
 * que es la que usan todas las implementaciones de referencia.
 *
 * El certificado NO sale de aca. Es la diferencia con el SDK: la clave
 * privada del taller se lee del secret, firma en memoria, y lo unico
 * que viaja es el CMS ya armado, que es exactamente lo que ARCA
 * necesita ver.
 */

import forge from 'npm:node-forge@1.3.1';
import { XMLParser } from 'npm:fast-xml-parser@4.5.0';
import { armarTra, sobreLoginCms, leerTa } from '../wsfe-xml.js';

const URL_WSAA = {
  dev: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
  prod: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
};

// El targetNamespace del WSDL es la URL del propio servicio, y cambia
// entre los dos ambientes.
const NS_WSAA = URL_WSAA;

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  // Los valores se dejan como texto: el token y la firma son base64 y
  // cualquier conversion automatica los estropea.
  parseTagValue: false,
  trimValues: true,
});

/**
 * Acepta el PEM tal cual o en base64.
 *
 * Un PEM son varias lineas, y pegarlo en un secret es donde mas se
 * rompe esto: segun por donde pase, las lineas se convierten en "\n"
 * literales o se pierden. Permitir el base64 del archivo entero da una
 * forma de cargarlo que no tiene saltos de linea que romper.
 */
function normalizarPem(valor: string, que: string): string {
  const v = (valor ?? '').trim();
  if (!v) throw new Error(`Falta ${que}.`);
  if (v.includes('-----BEGIN')) return v.replace(/\\n/g, '\n');

  try {
    const texto = new TextDecoder().decode(
      Uint8Array.from(atob(v.replace(/\s/g, '')), (c) => c.charCodeAt(0)),
    );
    if (!texto.includes('-----BEGIN')) throw new Error('no es un PEM');
    return texto;
  } catch {
    throw new Error(`${que} no parece un certificado en formato PEM.`);
  }
}

/**
 * El TRA firmado, en base64.
 *
 * SHA-256 y no SHA-1: ARCA acepta los dos y el segundo hace rato que no
 * es defendible. Si algun dia WSAA contestara "CMS invalido" sin mas
 * detalle, este es el primer lugar donde mirar.
 */
export function firmarCms(tra: string, certPem: string, keyPem: string): string {
  const cert = forge.pki.certificateFromPem(certPem);
  // privateKeyFromPem lee tanto PKCS#1 ("BEGIN RSA PRIVATE KEY") como
  // PKCS#8 ("BEGIN PRIVATE KEY"), que es lo que sale de openssl segun la
  // version y los flags con que se genero la clave.
  const key = forge.pki.privateKeyFromPem(keyPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      // messageDigest y signingTime los completa forge al firmar.
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();

  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

/**
 * Los rechazos de WSAA llegan como faultstring y son crípticos si uno no
 * sabe que trámite falta. Se traducen los tres que se ven de verdad.
 */
function explicar(faultstring: string): string {
  const s = faultstring.toLowerCase();

  if (s.includes('ya posee un ta valido') || s.includes('ya posee un ta válido')) {
    return `${faultstring} — Ya hay un ticket vivo para este CUIT y servicio. `
      + 'Suele pasar si se limpio el cache de `arca_token` antes de tiempo: '
      + 'hay que esperar a que venza el anterior.';
  }
  if (s.includes('no autorizado') || s.includes('computador')) {
    return `${faultstring} — El certificado existe pero no esta autorizado al `
      + 'servicio wsfe. Falta el paso de "Crear autorizacion a servicio" en WSASS '
      + '(o en el Administrador de Relaciones, si es el de produccion).';
  }
  if (s.includes('ac de confianza') || s.includes('no emitido')) {
    return `${faultstring} — El certificado no lo emitio ARCA. Suele ser haber `
      + 'cargado en ARCA_CERT el CSR (el pedido) en vez del .crt que devuelve '
      + 'WSASS, o un certificado autofirmado.';
  }
  if (s.includes('expirado') || s.includes('vencido')) {
    return `${faultstring} — El certificado vencio. Hay que sacar uno nuevo con el `
      + 'mismo procedimiento y volver a cargar ARCA_CERT.';
  }
  return faultstring;
}

export interface TicketAcceso {
  token: string;
  sign: string;
  expiracion: string | null;
}

/**
 * Pide el ticket de acceso. No cachea: de eso se ocupa `arca.ts`, que es
 * el que tiene la tabla.
 */
export async function pedirTicketAcceso(
  servicio: string,
  { cert, key, produccion }: { cert: string; key: string; produccion: boolean },
): Promise<TicketAcceso> {
  const entorno = produccion ? 'prod' : 'dev';
  const tra = armarTra(servicio);
  const cms = firmarCms(tra, normalizarPem(cert, 'ARCA_CERT'), normalizarPem(key, 'ARCA_KEY'));

  const resp = await fetch(URL_WSAA[entorno], {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      // El WSDL declara soapAction vacio, pero el header tiene que estar.
      SOAPAction: '',
    },
    body: sobreLoginCms(cms, NS_WSAA[entorno]),
  });

  const texto = await resp.text();
  const sobre = parser.parse(texto);
  const cuerpo = sobre?.Envelope?.Body;

  const falla = cuerpo?.Fault;
  if (falla) {
    throw new Error(`WSAA rechazo el pedido: ${explicar(String(falla.faultstring ?? falla))}`);
  }
  if (!resp.ok) {
    throw new Error(`WSAA respondio ${resp.status}: ${texto.slice(0, 300)}`);
  }

  // loginCmsReturn trae adentro otro XML, escapado. El parser ya
  // desescapo las entidades, asi que lo que hay en la mano es XML de
  // nuevo y hay que parsearlo una segunda vez.
  const adentro = cuerpo?.loginCmsResponse?.loginCmsReturn ?? cuerpo?.loginCmsReturn;
  if (!adentro) {
    throw new Error(`WSAA devolvio una respuesta inesperada: ${texto.slice(0, 300)}`);
  }

  return leerTa(parser.parse(String(adentro)));
}
