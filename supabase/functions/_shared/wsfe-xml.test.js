/**
 * Lo que estos tests cuidan no es que el XML "se vea bien": es que el
 * orden de los elementos sea exactamente el del xs:sequence del WSDL de
 * ARCA. Ese orden no se puede deducir leyendo el codigo ni se rompe de
 * forma visible --el rechazo llega despues, hablando de otra cosa-- asi
 * que queda fijado aca.
 *
 * Correr:  node --test supabase/functions/_shared/wsfe-xml.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  armarTra, sobreLoginCms, sobreWsfe, camposFecae, esc, fechaArca, fechaDeArca, hoyArgentina,
  leerTa, leerFecae, leerUltimoAutorizado, leerConsulta, leerErrores, comoArray,
} from './wsfe-xml.js';

/** Los nombres de los elementos en el orden en que aparecen. */
const etiquetas = (xml) => [...xml.matchAll(/<([A-Za-z][\w.]*)(?:\s[^>]*)?>/g)].map((m) => m[1]);

const valorDe = (xml, tag) => xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1] ?? null;

const AUTH = { token: 'TOKEN', sign: 'FIRMA', cuit: '20236517811' };

const DETALLE = {
  concepto: 2,
  docTipo: 96,
  docNro: 32999233,
  cbteDesde: 7,
  cbteHasta: 7,
  cbteFch: '20260818',
  servDesde: '20260818',
  servHasta: '20260818',
  vtoPago: '20260818',
  impTotal: 10000,
  impNeto: 10000,
  impIva: 0,
  moneda: 'PES',
  cotizacion: 1,
  condicionIvaReceptorId: 5,
};

describe('armarTra', () => {
  const ahora = new Date('2026-08-18T22:00:00Z');
  const tra = armarTra('wsfe', ahora);

  test('lleva la cabecera y el servicio, en orden', () => {
    assert.deepEqual(
      etiquetas(tra),
      ['loginTicketRequest', 'header', 'uniqueId', 'generationTime', 'expirationTime', 'service'],
    );
    assert.equal(valorDe(tra, 'service'), 'wsfe');
  });

  test('la ventana es de diez minutos para cada lado', () => {
    assert.equal(valorDe(tra, 'generationTime'), '2026-08-18T18:50:00-03:00');
    assert.equal(valorDe(tra, 'expirationTime'), '2026-08-18T19:10:00-03:00');
  });

  test('el uniqueId es el epoch en segundos', () => {
    assert.equal(valorDe(tra, 'uniqueId'), String(Math.floor(ahora.getTime() / 1000)));
  });

  // Si esto se escribiera con toISOString() daria "Z" y la hora en UTC.
  // WSAA compara contra su propio reloj y hay que hablarle en su huso.
  test('la hora va con el offset de Argentina escrito', () => {
    assert.match(valorDe(tra, 'generationTime'), /-03:00$/);
    assert.doesNotMatch(tra, /Z<\/generationTime>/);
  });
});

describe('sobreLoginCms', () => {
  test('mete el CMS en in0 con el namespace del servicio', () => {
    const s = sobreLoginCms('BASE64==', 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms');
    assert.match(s, /<loginCms xmlns="https:\/\/wsaahomo\.afip\.gov\.ar\/ws\/services\/LoginCms">/);
    assert.equal(valorDe(s, 'in0'), 'BASE64==');
  });
});

describe('sobreWsfe', () => {
  test('el Auth va primero y con los tres campos en orden', () => {
    const s = sobreWsfe('FECompUltimoAutorizado', AUTH, [['PtoVta', 1], ['CbteTipo', 11]]);
    // El sobre no aparece en la lista: `etiquetas` no matchea nombres con
    // prefijo de namespace, y soap:Envelope y soap:Body lo tienen.
    assert.deepEqual(etiquetas(s), [
      'FECompUltimoAutorizado', 'Auth', 'Token', 'Sign', 'Cuit', 'PtoVta', 'CbteTipo',
    ]);
  });

  test('el namespace de WSFEv1 va como default en el metodo', () => {
    const s = sobreWsfe('FECompUltimoAutorizado', AUTH, []);
    assert.match(s, /<FECompUltimoAutorizado xmlns="http:\/\/ar\.gov\.afip\.dif\.FEV1\/">/);
  });

  test('omite lo que viene nulo pero nunca el cero', () => {
    const s = sobreWsfe('X', AUTH, [['Vacio', null], ['Cero', 0], ['Texto', '']]);
    assert.doesNotMatch(s, /<Vacio>/);
    assert.doesNotMatch(s, /<Texto>/);
    assert.equal(valorDe(s, 'Cero'), '0');
  });
});

describe('camposFecae', () => {
  const orden = (detalle) => {
    const xml = sobreWsfe('FECAESolicitar', AUTH, camposFecae(1, 11, detalle));
    // Se saltea el sobre y el Auth: lo que se esta fijando es el detalle.
    return etiquetas(xml).slice(etiquetas(xml).indexOf('FeCAEReq'));
  };

  test('respeta el xs:sequence del WSDL', () => {
    assert.deepEqual(orden(DETALLE), [
      'FeCAEReq',
      'FeCabReq', 'CantReg', 'PtoVta', 'CbteTipo',
      'FeDetReq', 'FECAEDetRequest',
      'Concepto', 'DocTipo', 'DocNro', 'CbteDesde', 'CbteHasta', 'CbteFch',
      'ImpTotal', 'ImpTotConc', 'ImpNeto', 'ImpOpEx', 'ImpTrib', 'ImpIVA',
      'FchServDesde', 'FchServHasta', 'FchVtoPago',
      'MonId', 'MonCotiz', 'CondicionIVAReceptorId',
    ]);
  });

  // Las dos que el JSON del SDK tapaba, porque ahi el orden no contaba.
  test('ImpIVA va despues de ImpTrib y las fechas despues de los importes', () => {
    const o = orden(DETALLE);
    assert.ok(o.indexOf('ImpIVA') > o.indexOf('ImpTrib'));
    assert.ok(o.indexOf('FchServDesde') > o.indexOf('ImpIVA'));
  });

  test('una Factura C no manda Iva ni Tributos', () => {
    const xml = sobreWsfe('FECAESolicitar', AUTH, camposFecae(1, 11, DETALLE));
    assert.doesNotMatch(xml, /<Iva>|<Iva\/>|<Tributos>/);
  });

  test('con concepto 1 (productos) no van las fechas de servicio', () => {
    const o = orden({ ...DETALLE, concepto: 1 });
    assert.ok(!o.includes('FchServDesde'));
    assert.ok(!o.includes('FchVtoPago'));
  });

  test('los importes en cero viajan igual', () => {
    const xml = sobreWsfe('FECAESolicitar', AUTH, camposFecae(1, 11, DETALLE));
    assert.equal(valorDe(xml, 'ImpTotConc'), '0');
    assert.equal(valorDe(xml, 'ImpIVA'), '0');
    assert.equal(valorDe(xml, 'ImpNeto'), '10000');
  });
});

describe('leerTa', () => {
  test('saca token, firma y vencimiento', () => {
    const ta = leerTa({
      loginTicketResponse: {
        header: { expirationTime: '2026-08-19T10:00:00-03:00' },
        credentials: { token: 'T', sign: 'S' },
      },
    });
    assert.deepEqual(ta, { token: 'T', sign: 'S', expiracion: '2026-08-19T10:00:00-03:00' });
  });

  test('sin credenciales avisa en vez de devolver vacio', () => {
    assert.throws(() => leerTa({ loginTicketResponse: { header: {} } }), /credenciales/);
  });
});

describe('leerFecae', () => {
  test('autorizada devuelve CAE y vencimiento en formato de Postgres', () => {
    const r = leerFecae({
      FeCabResp: { Resultado: 'A' },
      FeDetResp: { FECAEDetResponse: { Resultado: 'A', CAE: '76123456789012', CAEFchVto: '20260828' } },
    });
    assert.equal(r.resultado, 'A');
    assert.equal(r.cae, '76123456789012');
    assert.equal(r.caeVencimiento, '2026-08-28');
    assert.equal(r.errores, null);
  });

  // Rechazo real de la orden #7. La forma { Err: [...] } es la que ya
  // esta guardada en facturas viejas y la que sabe leer la pantalla.
  test('rechazada conserva codigo y mensaje', () => {
    const r = leerFecae({
      FeCabResp: { Resultado: 'R' },
      FeDetResp: { FECAEDetResponse: { Resultado: 'R' } },
      Errors: { Err: { Code: '501', Msg: 'Error interno de base de datos - FECAEcSolicitar CabInsert' } },
    });
    assert.equal(r.resultado, 'R');
    assert.equal(r.cae, null);
    assert.deepEqual(r.errores.Err, [
      { Code: 501, Msg: 'Error interno de base de datos - FECAEcSolicitar CabInsert' },
    ]);
  });

  // Rechazo real de la orden #4: ARCA lo manda como observacion, no como
  // error, y aun asi el comprobante no queda autorizado.
  test('las observaciones tambien se guardan', () => {
    const r = leerFecae({
      FeCabResp: { Resultado: 'R' },
      FeDetResp: {
        FECAEDetResponse: {
          Resultado: 'R',
          Observaciones: { Obs: { Code: '10015', Msg: 'DocNro no se encuentra registrado en los padrones' } },
        },
      },
    });
    assert.equal(r.observaciones.Obs[0].Code, 10015);
  });

  test('una respuesta sin nada reconocible no se lee como autorizada', () => {
    assert.equal(leerFecae({}).resultado, 'R');
    assert.equal(leerFecae({}).cae, null);
  });
});

describe('leerUltimoAutorizado', () => {
  test('devuelve el numero', () => {
    assert.equal(leerUltimoAutorizado({ CbteNro: '42' }), 42);
  });

  test('sin comprobantes previos es cero', () => {
    assert.equal(leerUltimoAutorizado({ CbteNro: '0' }), 0);
  });

  // Devolver 0 ante un error hace numerar desde 1 sobre un punto de
  // venta que ya tiene comprobantes, y el rechazo aparece dos pasos
  // despues hablando de otra cosa.
  test('un error de ARCA levanta excepcion en vez de dar cero', () => {
    assert.throws(
      () => leerUltimoAutorizado({ Errors: { Err: { Code: 602, Msg: 'Sin Resultados' } } }),
      /602: Sin Resultados/,
    );
  });
});

describe('leerConsulta', () => {
  test('sin autorizacion devuelve null', () => {
    assert.equal(leerConsulta({ ResultGet: { CbteNro: 7 } }), null);
    assert.equal(leerConsulta({}), null);
  });

  test('con autorizacion devuelve el CAE', () => {
    const r = leerConsulta({ ResultGet: { CodAutorizacion: '76123456789012', FchVto: '20260828' } });
    assert.deepEqual(r, { cae: '76123456789012', caeVencimiento: '2026-08-28' });
  });
});

describe('utilidades', () => {
  test('esc no rompe un nombre con ampersand', () => {
    assert.equal(esc('Perez & Hijos'), 'Perez &amp; Hijos');
    assert.equal(esc('<script>'), '&lt;script&gt;');
  });

  test('comoArray normaliza el elemento que viene solo', () => {
    assert.deepEqual(comoArray({ a: 1 }), [{ a: 1 }]);
    assert.deepEqual(comoArray([1, 2]), [1, 2]);
    assert.deepEqual(comoArray(null), []);
  });

  test('fechaArca escribe yyyymmdd y no inventa fechas', () => {
    assert.equal(fechaArca('2026-08-12'), '20260812');
    assert.equal(fechaArca(null), null);
  });

  // Entre las 21 y la medianoche de Argentina, UTC ya esta en el dia
  // siguiente: una factura emitida a esa hora saldria fechada manana.
  test('hoyArgentina no se adelanta un dia a la noche', () => {
    assert.equal(hoyArgentina(new Date('2026-08-19T01:00:00Z')), '2026-08-18');
    assert.equal(hoyArgentina(new Date('2026-08-19T03:27:00Z')), '2026-08-19');
    assert.equal(hoyArgentina(new Date('2026-08-19T15:00:00Z')), '2026-08-19');
  });

  test('fechaDeArca vuelve al formato de Postgres', () => {
    assert.equal(fechaDeArca('20260812'), '2026-08-12');
    assert.equal(fechaDeArca(''), null);
  });

  test('leerErrores devuelve null cuando no hay ninguno', () => {
    assert.equal(leerErrores({}), null);
    assert.equal(leerErrores({ Errors: '' }), null);
  });
});
