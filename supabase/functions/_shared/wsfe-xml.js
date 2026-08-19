/**
 * El XML de WSAA y WSFEv1: como se arma y como se lee.
 *
 * Todo lo que no necesita red ni criptografia vive aca y no en
 * `deno/wsaa.ts` ni `deno/wsfe.ts`, por una razon practica: los archivos
 * de `deno/` importan `npm:` y no se pueden correr con `node --test`.
 * Este si, y es justamente la parte donde un error se paga caro y en
 * silencio --un elemento fuera de orden, una fecha con el formato
 * equivocado-- porque ARCA lo rechaza sin explicar cual fue.
 *
 * Dos reglas que gobiernan el archivo entero:
 *
 *   1. EL ORDEN ES PARTE DEL CONTRATO. Los tipos del WSDL son
 *      `xs:sequence`, no `xs:all`: mandar ImpIVA antes que ImpTrib es
 *      tan invalido como no mandarlo. Por eso los campos se pasan como
 *      array de pares y no como objeto: un objeto invita a reordenarlo
 *      "para que quede mas prolijo" y eso rompe la emision.
 *
 *   2. LO OPCIONAL SE OMITE, NO SE MANDA VACIO. Un `<Iva/>` vacio en una
 *      Factura C es rechazo; no mandar el elemento es lo correcto.
 */

/** Escapa lo que va adentro de un elemento. */
export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** ARCA quiere las fechas como "20260812". */
export function fechaArca(d) {
  if (!d) return null;
  const dt = typeof d === 'string' ? new Date(d) : d;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Un instante en hora de Argentina, con el offset escrito.
 *
 * No se usa toISOString() --que termina en "Z"-- ni la zona horaria del
 * runtime: las Edge Functions corren en UTC y WSAA compara contra su
 * propio reloj. Escribiendo -03:00 explicito, el mismo codigo da el
 * mismo texto corra donde corra.
 */
function isoArgentina(d) {
  const t = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`
    + `T${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}-03:00`;
}

/**
 * Hoy en Argentina, en el formato de fecha de Postgres.
 *
 * No es `new Date().toISOString().slice(0, 10)`: eso da la fecha en UTC,
 * y entre las 21 y la medianoche de Argentina UTC ya esta en el dia
 * siguiente. Una factura emitida a las diez de la noche saldria fechada
 * manana, con el numero correlativo de hoy.
 */
export function hoyArgentina(ahora = new Date()) {
  const t = new Date(ahora.getTime() - 3 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

/** Los valores de un elemento que puede venir solo o repetido. */
export function comoArray(v) {
  if (v === null || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}


// =============================================================
//  WSAA: el ticket de acceso
// =============================================================

/**
 * El Ticket de Requerimiento de Acceso, que es lo que se firma.
 *
 * La ventana de +-10 minutos es la convencion: `generationTime` en el
 * pasado cubre que el reloj de ARCA vaya atrasado respecto del nuestro,
 * y `expirationTime` cerca acota cuanto vale este pedido si alguien lo
 * intercepta. No es la vigencia del ticket que devuelve ARCA --ese dura
 * unas 12 horas y lo decide ARCA--, es la de esta solicitud.
 */
export function armarTra(servicio, ahora = new Date()) {
  const desde = new Date(ahora.getTime() - 10 * 60 * 1000);
  const hasta = new Date(ahora.getTime() + 10 * 60 * 1000);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<loginTicketRequest version="1.0">',
    '  <header>',
    `    <uniqueId>${Math.floor(ahora.getTime() / 1000)}</uniqueId>`,
    `    <generationTime>${isoArgentina(desde)}</generationTime>`,
    `    <expirationTime>${isoArgentina(hasta)}</expirationTime>`,
    '  </header>',
    `  <service>${esc(servicio)}</service>`,
    '</loginTicketRequest>',
  ].join('\n');
}

/** El sobre SOAP del loginCms. `ns` cambia entre homologacion y
 *  produccion: es la URL del propio servicio. */
export function sobreLoginCms(cmsBase64, ns) {
  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">'
    + '<soapenv:Header/>'
    + '<soapenv:Body>'
    + `<loginCms xmlns="${ns}">`
    + `<in0>${esc(cmsBase64)}</in0>`
    + '</loginCms>'
    + '</soapenv:Body>'
    + '</soapenv:Envelope>';
}

/**
 * Token, firma y vencimiento del `loginTicketResponse` ya parseado.
 *
 * Se acepta con o sin el elemento raiz porque quien llama puede haberlo
 * desenvuelto antes; distinguirlo aca sale mas barato que acordarse
 * afuera.
 */
export function leerTa(obj) {
  const r = obj?.loginTicketResponse ?? obj;
  const token = r?.credentials?.token;
  const sign = r?.credentials?.sign;
  if (!token || !sign) {
    throw new Error('WSAA no devolvio credenciales en el ticket de acceso.');
  }
  return {
    token: String(token),
    sign: String(sign),
    expiracion: r?.header?.expirationTime ? String(r.header.expirationTime) : null,
  };
}


// =============================================================
//  WSFEv1: los tres metodos que usa el taller
// =============================================================

export const NS_WSFE = 'http://ar.gov.afip.dif.FEV1/';

/**
 * Dibuja una lista ordenada de campos.
 *
 * `campos` es un array de pares [nombre, valor]. Si el valor es a su vez
 * un array de pares, se anida. Lo que venga null, undefined o cadena
 * vacia se omite entero --ver la regla 2 del encabezado--; el cero NO se
 * omite, que es lo que hace que ImpTotConc y ImpIVA de una Factura C
 * viajen en 0 como corresponde.
 */
function nodos(campos, sangria = '') {
  return campos
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([nombre, valor]) => (
      Array.isArray(valor)
        ? `${sangria}<${nombre}>\n${nodos(valor, `${sangria}  `)}\n${sangria}</${nombre}>`
        : `${sangria}<${nombre}>${esc(valor)}</${nombre}>`
    ))
    .join('\n');
}

/**
 * El sobre SOAP 1.1 de cualquier metodo de WSFEv1.
 *
 * El namespace va como default en el elemento del metodo y lo heredan
 * todos los hijos: es la forma mas corta de no tener que prefijar
 * cuarenta elementos.
 */
export function sobreWsfe(metodo, auth, campos = []) {
  const cuerpo = [
    ['Auth', [
      ['Token', auth.token],
      ['Sign', auth.sign],
      ['Cuit', auth.cuit],
    ]],
    ...campos,
  ];

  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
    + '<soap:Body>'
    + `<${metodo} xmlns="${NS_WSFE}">\n${nodos(cuerpo, '  ')}\n</${metodo}>`
    + '</soap:Body>'
    + '</soap:Envelope>';
}

/**
 * Los campos de FECAESolicitar, en el orden del xs:sequence del WSDL.
 *
 * Verificado contra wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL. Dos
 * trampas que el JSON del SDK tapaba porque el orden ahi no importaba:
 * ImpIVA va DESPUES de ImpTrib, y las tres fechas de servicio van
 * DESPUES de todos los importes.
 *
 * Los opcionales que el taller no usa --CbtesAsoc, Tributos, Iva,
 * Opcionales, Compradores, PeriodoAsoc, Actividades-- no se dibujan. El
 * taller es monotributo y emite Factura C: no discrimina IVA, asi que
 * el elemento `Iva` no corresponde. El dia que pase a responsable
 * inscripto, ese es el elemento que hay que agregar aca, y va entre
 * Tributos y Opcionales.
 */
export function camposFecae(ptoVta, cbteTipo, d) {
  const servicios = d.concepto !== 1;

  return [
    ['FeCAEReq', [
      ['FeCabReq', [
        ['CantReg', 1],
        ['PtoVta', ptoVta],
        ['CbteTipo', cbteTipo],
      ]],
      ['FeDetReq', [
        ['FECAEDetRequest', [
          ['Concepto', d.concepto],
          ['DocTipo', d.docTipo],
          ['DocNro', d.docNro],
          ['CbteDesde', d.cbteDesde],
          ['CbteHasta', d.cbteHasta],
          ['CbteFch', d.cbteFch],
          ['ImpTotal', d.impTotal],
          ['ImpTotConc', 0],
          ['ImpNeto', d.impNeto],
          ['ImpOpEx', 0],
          ['ImpTrib', 0],
          ['ImpIVA', d.impIva],
          ['FchServDesde', servicios ? d.servDesde : null],
          ['FchServHasta', servicios ? d.servHasta : null],
          ['FchVtoPago', servicios ? d.vtoPago : null],
          ['MonId', d.moneda],
          ['MonCotiz', d.cotizacion],
          ['CondicionIVAReceptorId', d.condicionIvaReceptorId],
        ]],
      ]],
    ]],
  ];
}

/**
 * Los errores de una respuesta, con la forma en la que ya los guarda y
 * los muestra el resto del sistema: `{ Err: [{ Code, Msg }] }`.
 *
 * Se conserva esa forma a proposito aunque aca adentro sea incomoda:
 * es lo que hay escrito en `factura.arca_errores` de los intentos
 * viejos y lo que sabe leer `mensajeArca()` en la pantalla.
 */
export function leerErrores(res) {
  const err = comoArray(res?.Errors?.Err);
  if (!err.length) return null;
  return { Err: err.map((e) => ({ Code: Number(e.Code), Msg: String(e.Msg ?? '') })) };
}

function leerObservaciones(det) {
  const obs = comoArray(det?.Observaciones?.Obs);
  if (!obs.length) return null;
  return { Obs: obs.map((o) => ({ Code: Number(o.Code), Msg: String(o.Msg ?? '') })) };
}

/** "20260812" -> "2026-08-12", que es lo que quiere Postgres. */
export function fechaDeArca(v) {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.length !== 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/**
 * El ultimo numero autorizado.
 *
 * Si ARCA contesta con error --el caso tipico es un punto de venta que
 * no existe para ese CUIT-- se levanta excepcion en vez de devolver 0.
 * Devolver 0 hace que la emision arranque numerando en 1 contra un
 * punto de venta que ya tiene comprobantes, y el rechazo aparece dos
 * pasos despues, hablando de otra cosa.
 */
export function leerUltimoAutorizado(res) {
  const errores = leerErrores(res);
  if (errores) {
    throw new Error(errores.Err.map((e) => `${e.Code}: ${e.Msg}`).join(' · '));
  }
  return Number(res?.CbteNro ?? 0);
}

/** El resultado de pedir un CAE. */
export function leerFecae(res) {
  const cabecera = res?.FeCabResp;
  const det = comoArray(res?.FeDetResp?.FECAEDetResponse)[0] ?? null;

  return {
    resultado: det?.Resultado ?? cabecera?.Resultado ?? 'R',
    cae: det?.CAE ? String(det.CAE) : null,
    caeVencimiento: fechaDeArca(det?.CAEFchVto),
    observaciones: leerObservaciones(det),
    errores: leerErrores(res),
    crudo: res,
  };
}

/** La consulta de un comprobante ya numerado. Devuelve null cuando ARCA
 *  no tiene nada para ese numero, que es la respuesta que importa. */
export function leerConsulta(res) {
  const det = res?.ResultGet;
  if (!det || !det.CodAutorizacion) return null;
  return {
    cae: String(det.CodAutorizacion),
    caeVencimiento: fechaDeArca(det.FchVto),
  };
}
