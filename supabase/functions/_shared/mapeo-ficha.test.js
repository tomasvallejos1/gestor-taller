/**
 * El mapeo se testea sin llamar a ningun modelo: las entradas son
 * transcripciones como las que devuelve, escritas a mano aca. Asi se
 * puede iterar el mapeo en milisegundos en vez de esperar 30 segundos y
 * gastar cuota por cada prueba.
 *
 * Correr:  node --test supabase/functions/_shared/mapeo-ficha.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  campoDeEtiqueta, bobinadoDeEtiqueta, aislacionDeEtiqueta, mapearLineas, normalizar,
} from './mapeo-ficha.js';
// El set de regresion del final cruza mapeo con parseo a proposito: lo
// que importa es el dato que termina en el formulario, no el paso
// intermedio. Cada uno por su lado pasaba en verde mientras la ficha
// real se guardaba mal.
import { parsearAlambre, parsearAbertura, armarSecciones } from './parseo.js';

describe('normalizar', () => {
  test('saca tildes, signos y mayusculas', () => {
    assert.equal(normalizar('ABERT.'), 'abert');
    assert.equal(normalizar('Diám: INT.'), 'diam int');
    assert.equal(normalizar('  RANURAS  '), 'ranuras');
  });
});

describe('campoDeEtiqueta', () => {
  test('las etiquetas de las fichas reales', () => {
    assert.equal(campoDeEtiqueta('MOTOR'), 'descripcion');
    assert.equal(campoDeEtiqueta('HP'), 'hp_texto');
    assert.equal(campoDeEtiqueta('AMP'), 'amperaje_texto');
    assert.equal(campoDeEtiqueta('CAP'), 'capacitor_texto');
    assert.equal(campoDeEtiqueta('RANURAS'), 'ranuras');
    assert.equal(campoDeEtiqueta('RPM'), 'rpm');
    assert.equal(campoDeEtiqueta('Largo'), 'largo_mm');
    assert.equal(campoDeEtiqueta('Observaciones'), 'observaciones');
  });

  test('lo especifico le gana a lo general', () => {
    // Este era el error del primer diseño: "Diam EXT" caia en interior.
    assert.equal(campoDeEtiqueta('Diam EXT'), 'diam_ext_mm');
    assert.equal(campoDeEtiqueta('Diam INT'), 'diam_int_mm');
    assert.equal(campoDeEtiqueta('Diam'), 'diam_int_mm', 'sin aclarar, es el interior');
    assert.equal(aislacionDeEtiqueta('Aislacion largo'), 'largo_mm');
    assert.equal(aislacionDeEtiqueta('Largo'), null, 'largo solo NO es de aislacion');
    assert.equal(campoDeEtiqueta('Largo'), 'largo_mm', 'largo solo es el de la carcasa');
  });

  test('etiqueta desconocida devuelve null', () => {
    assert.equal(campoDeEtiqueta('color de la caja'), null);
    assert.equal(campoDeEtiqueta(''), null);
    assert.equal(campoDeEtiqueta(null), null);
  });
});

describe('bobinadoDeEtiqueta', () => {
  test('las variantes que se ven en las fichas', () => {
    assert.equal(bobinadoDeEtiqueta('Alambre'), 'alambre');
    assert.equal(bobinadoDeEtiqueta('Paso'), 'paso');
    assert.equal(bobinadoDeEtiqueta('Vueltas'), 'vueltas');
    assert.equal(bobinadoDeEtiqueta('VTAS'), 'vueltas');
    assert.equal(bobinadoDeEtiqueta('Vuelta'), 'vueltas');
    assert.equal(bobinadoDeEtiqueta('ABERT.'), 'abertura');
  });
});

describe('mapearLineas', () => {
  // Transcripcion equivalente a la que devolvio el modelo real.
  const LINEAS = [
    { seccion: 'general', etiqueta: 'MOTOR', valor: 'SIEMENS 1LA7', confianza: 'alta', texto_fuente: 'MOTOR: SIEMENS 1LA7' },
    { seccion: 'general', etiqueta: 'Cliente', valor: 'JORGE PEREZ', confianza: 'alta', texto_fuente: 'JORGE PEREZ' },
    { seccion: 'general', etiqueta: 'HP', valor: '1/2', confianza: 'alta', texto_fuente: 'HP: 1/2' },
    { seccion: 'general', etiqueta: 'CAP', valor: '12 uF', confianza: 'alta', texto_fuente: 'CAP: 12 uF' },
    { seccion: 'general', etiqueta: 'Largo', valor: '58 mm', confianza: 'alta', texto_fuente: 'Largo: 58 mm' },
    { seccion: 'general', etiqueta: 'Diam INT', valor: '71mm', confianza: 'alta', texto_fuente: 'Diam: INT. 71mm' },
    { seccion: 'general', etiqueta: 'RANURAS', valor: '36', confianza: 'alta', texto_fuente: 'RANURAS 36' },
    { seccion: 'general', etiqueta: 'RPM', valor: '1420', confianza: 'alta', texto_fuente: '1420 RPM' },
    { seccion: 'arranque', etiqueta: 'Alambre', valor: '0,40 mm 0,320 KG', confianza: 'alta', texto_fuente: 'Alambre: 0,40 mm 0,320 KG' },
    { seccion: 'arranque', etiqueta: 'Paso', valor: '6 - 8 - 10', confianza: 'alta', texto_fuente: 'Paso: 6 - 8 - 10' },
    { seccion: 'arranque', etiqueta: 'Vueltas', valor: '40 - 45 - 60', confianza: 'alta', texto_fuente: 'Vueltas: 40 - 45 - 60' },
    { seccion: 'arranque', etiqueta: 'ABERT', valor: '38mm (2/3)', confianza: 'media', texto_fuente: 'ABERT. 38mm (2/3)' },
    { seccion: 'trabajo', etiqueta: 'Alambre', valor: '2x0,50 mm 0,880 KG', confianza: 'alta', texto_fuente: 'Alambre: 2x0,50 mm 0,880 KG' },
    { seccion: 'trabajo', etiqueta: 'Paso', valor: '4 - 6', confianza: 'alta', texto_fuente: 'Paso: 4 - 6' },
    { seccion: 'trabajo', etiqueta: 'Vueltas', valor: '150.150', confianza: 'baja', texto_fuente: 'Vueltas: 150.150' },
    { seccion: 'trabajo', etiqueta: 'ABERT', valor: '44mm 3/4', confianza: 'media', texto_fuente: 'ABERT. 44mm 3/4' },
    { seccion: 'general', etiqueta: 'Observaciones', valor: 'CAMBIAR RODAMIENTO TRASERO', confianza: 'alta', texto_fuente: 'Observaciones: ...' },
  ];

  const r = mapearLineas(LINEAS);

  test('los campos generales caen donde corresponde', () => {
    assert.equal(r.campos.descripcion, 'SIEMENS 1LA7');
    assert.equal(r.campos.cliente, 'JORGE PEREZ');
    assert.equal(r.campos.hp_texto, '1/2');
    assert.equal(r.campos.capacitor_texto, '12 uF');
    assert.equal(r.campos.ranuras, '36');
    assert.equal(r.campos.rpm, '1420');
    assert.equal(r.campos.observaciones, 'CAMBIAR RODAMIENTO TRASERO');
  });

  test('Largo y Diam NO terminan en aislacion', () => {
    assert.equal(r.campos.largo_mm, '58 mm');
    assert.equal(r.campos.diam_int_mm, '71mm');
    assert.deepEqual(r.aislaciones, [], 'sin lineas de aislacion, la lista va vacia');
  });

  test('el bobinado queda separado por circuito', () => {
    assert.equal(r.circuitos.arranque.paso, '6 - 8 - 10');
    assert.equal(r.circuitos.arranque.vueltas, '40 - 45 - 60');
    assert.equal(r.circuitos.trabajo.paso, '4 - 6');
    assert.equal(r.circuitos.trabajo.vueltas, '150.150');
    assert.equal(r.circuitos.trabajo.alambre, '2x0,50 mm 0,880 KG');
  });

  test('la confianza viaja con el dato', () => {
    assert.equal(r.confianza.ranuras, 'alta');
    assert.equal(r.circuitos.trabajo.vueltas_confianza, 'baja');
    assert.equal(r.circuitos.arranque.abertura_confianza, 'media');
  });

  test('el texto de origen se conserva', () => {
    assert.equal(r.fuente.rpm, '1420 RPM');
    assert.match(r.circuitos.trabajo.vueltas_fuente, /150\.150/);
  });

  test('lo no reconocido se acumula en vez de perderse', () => {
    const con = mapearLineas([
      ...LINEAS,
      { seccion: 'general', etiqueta: 'Color', valor: 'azul', confianza: 'alta', texto_fuente: 'Color: azul' },
    ]);
    assert.equal(con.sinReconocer.length, 1);
    assert.equal(con.sinReconocer[0].valor, 'azul');
  });

  test('gana la lectura de mayor confianza si el campo se repite', () => {
    const con = mapearLineas([
      { seccion: 'general', etiqueta: 'RPM', valor: '1400', confianza: 'baja', texto_fuente: 'borroso' },
      { seccion: 'general', etiqueta: 'RPM', valor: '1420', confianza: 'alta', texto_fuente: '1420 RPM' },
    ]);
    assert.equal(con.campos.rpm, '1420');
  });

  test('valores vacios se ignoran', () => {
    const con = mapearLineas([
      { seccion: 'general', etiqueta: 'AMP', valor: '', confianza: 'alta', texto_fuente: 'AMP:' },
    ]);
    assert.equal(con.campos.amperaje_texto, undefined);
  });
});

describe('lineas sin separador (caso real del modelo)', () => {
  // Cuando el papel no trae dos puntos, el modelo devuelve el renglon
  // entero como etiqueta y el valor vacio. Medido contra una ficha real.
  const CRUDAS = [
    { seccion: 'general', etiqueta: 'RANURAS 36', valor: '', confianza: 'alta', texto_fuente: 'RANURAS 36' },
    { seccion: 'general', etiqueta: '1420 RPM', valor: '', confianza: 'alta', texto_fuente: '1420 RPM' },
    { seccion: 'general', etiqueta: 'JORGE PEREZ', valor: '', confianza: 'alta', texto_fuente: 'JORGE PEREZ' },
    { seccion: 'general', etiqueta: 'MOTOR:', valor: 'SIEMENS 1LA7', confianza: 'alta', texto_fuente: 'MOTOR: SIEMENS 1LA7' },
    { seccion: 'arranque', etiqueta: 'Arranque:', valor: '', confianza: 'alta', texto_fuente: 'Arranque:' },
  ];
  const r = mapearLineas(CRUDAS);

  test('separa el rotulo del numero', () => {
    assert.equal(r.campos.ranuras, '36');
    assert.equal(r.campos.rpm, '1420');
  });

  test('un nombre suelto en el encabezado se toma como cliente, con dudas', () => {
    assert.equal(r.campos.cliente, 'JORGE PEREZ');
    assert.equal(r.confianza.cliente, 'media', 'es una suposicion, no una certeza');
  });

  test('no rompe las lineas que si venian separadas', () => {
    assert.equal(r.campos.descripcion, 'SIEMENS 1LA7');
  });

  test('los titulos de seccion no ensucian los campos', () => {
    assert.equal(r.campos.aplicacion, undefined);
    assert.equal(r.sinReconocer.some((x) => x.etiqueta === 'Arranque:'), false);
  });

  test('un nombre no pisa un cliente ya leido con rotulo', () => {
    const con = mapearLineas([
      { seccion: 'general', etiqueta: 'Cliente', valor: 'PABLO MAGONERI', confianza: 'alta', texto_fuente: '' },
      { seccion: 'general', etiqueta: 'JUAN CARLOS', valor: '', confianza: 'alta', texto_fuente: '' },
    ]);
    assert.equal(con.campos.cliente, 'PABLO MAGONERI');
  });
});

describe('aislaciones', () => {
  const aisl = (etiqueta, valor) => ({
    seccion: 'general', etiqueta, valor, confianza: 'alta', texto_fuente: `${etiqueta} ${valor}`,
  });

  test('una sola aislacion arma una fila', () => {
    const r = mapearLineas([
      aisl('Aislacion largo', '60'),
      aisl('Aislacion ancho', '30'),
      aisl('Aislacion cantidad', '24'),
    ]);
    assert.equal(r.aislaciones.length, 1);
    assert.equal(r.aislaciones[0].largo_mm, '60');
    assert.equal(r.aislaciones[0].ancho_mm, '30');
    assert.equal(r.aislaciones[0].cantidad, '24');
  });

  test('un segundo bloque abre otra fila en vez de pisar el primero', () => {
    const r = mapearLineas([
      aisl('Aislacion largo', '60'), aisl('Aislacion ancho', '30'),
      aisl('Aislacion largo', '58'), aisl('Aislacion ancho', '8'),
    ]);
    assert.equal(r.aislaciones.length, 2, 'la segunda no debe pisar a la primera');
    assert.equal(r.aislaciones[0].largo_mm, '60');
    assert.equal(r.aislaciones[1].largo_mm, '58');
    assert.equal(r.aislaciones[1].ancho_mm, '8');
  });

  test('la aislacion no se mezcla con las medidas de la carcasa', () => {
    const r = mapearLineas([
      aisl('Largo', '58 mm'),
      aisl('Aislacion largo', '60'),
    ]);
    assert.equal(r.campos.largo_mm, '58 mm');
    assert.equal(r.aislaciones.length, 1);
    assert.equal(r.aislaciones[0].largo_mm, '60');
  });

  test('conserva confianza y texto fuente para la revision', () => {
    const r = mapearLineas([
      { seccion: 'general', etiqueta: 'Aislacion largo', valor: '60', confianza: 'baja', texto_fuente: 'AISL. LARGO 60' },
    ]);
    assert.equal(r.aislaciones[0].largo_mm_confianza, 'baja');
    assert.equal(r.aislaciones[0].largo_mm_fuente, 'AISL. LARGO 60');
  });
});

/**
 * Set de regresion: dos fichas reales, con lo que el modelo devolvio de
 * verdad y lo que dice el papel, verificado a mano por el taller.
 *
 * Los renglones son copia literal de datos_json, sin retoques. La
 * tentacion es escribirlos "prolijos" --agregarle el ⌀ a la etiqueta,
 * sacarle el punto de mas al KG-- y ahi el test deja de probar lo que
 * pasa y pasa a probar lo que uno cree que pasa. Los tres bugs que se
 * arreglaron aca vivian justamente en esa diferencia.
 */
describe('fichas reales del taller', () => {
  const L = (seccion, etiqueta, valor) => ({
    seccion, etiqueta, valor, confianza: 'alta', texto_fuente: valor,
  });

  describe('bombeador de Juan', () => {
    const leido = mapearLineas([
      L('general', 'MOTOR', 'BOMBEADOR'), L('general', 'Cliente', 'JUAN'),
      L('general', 'RANURAS', '32'), L('general', 'Largo', '62'),
      L('general', 'Diam', '93 mm'), L('general', 'EXT.', '165mm'),
      L('arranque', '∅', '0,60 k'),
      L('arranque', 'Paso', '4 - 6 - 8'), L('arranque', 'Vtas', '20.20-37'),
      L('trabajo', '∅', '0,70 KG 1,080'), L('trabajo', 'ABERT.', '54 mm 2 3/4'),
      L('trabajo', 'Paso', '4 - 6 - 8'), L('trabajo', 'Vtas', '80-80-90'),
    ]);

    test('el ⌀ es la etiqueta del alambre, no un renglon perdido', () => {
      assert.deepEqual(leido.sinReconocer, [], 'no puede quedar nada sin ubicar');
      assert.ok(leido.circuitos.arranque.alambre, 'el arranque quedo sin alambre');
      assert.ok(leido.circuitos.trabajo.alambre, 'el trabajo quedo sin alambre');
    });

    test('trabajo: 0,70mm y 1,080kg, en ese orden', () => {
      const a = parsearAlambre(leido.circuitos.trabajo.alambre);
      assert.equal(a.mm, 0.7, 'el calibre');
      assert.equal(a.kg, 1.08, 'el peso');
    });

    test('trabajo: la relacion es de tres terminos', () => {
      const ab = parsearAbertura(leido.circuitos.trabajo.abertura);
      assert.equal(ab.mm, 54);
      assert.equal(ab.fraccion, '2/3/4', 'se perdia el primer termino');
    });

    test('el punto entre vueltas separa, no decimaliza', () => {
      const s = armarSecciones(leido.circuitos.arranque.paso, leido.circuitos.arranque.vueltas);
      assert.equal(s.alineado, true);
      assert.deepEqual(s.secciones.map((x) => x.vueltas), [20, 20, 37]);
    });
  });

  describe('batidor de Magneri', () => {
    const leido = mapearLineas([
      L('general', 'Motor', 'BATIDOR'), L('general', 'Cliente', 'PABLO MAGNERI'),
      L('general', 'RANURAS', '24'), L('general', 'Largo', '45'),
      L('general', 'Diam', '73 mm 124 mm'), L('general', 'CONDENSADOR', '8 MF'),
      L('general', 'RPM', '1450 RPM.'),
      L('arranque', '∅', '0,35 mm - 0,300 KG'),
      L('arranque', 'Paso', '6'), L('arranque', 'VTAS', '300'),
      L('trabajo', '∅', '0,50 mm - 0,550 KG.'),
      L('trabajo', 'PASO', '4 - 6'), L('trabajo', 'VTAS', '150 . 150'),
    ]);

    test('los dos diametros de un mismo renglon van a campos distintos', () => {
      assert.equal(leido.campos.diam_int_mm, '73', 'el menor es el interior');
      assert.equal(leido.campos.diam_ext_mm, '124', 'el mayor es el exterior');
      assert.equal(leido.confianza.diam_ext_mm, 'media', 'lo dedujimos nosotros');
    });

    test('arranque: 0,35mm y 0,300kg', () => {
      const a = parsearAlambre(leido.circuitos.arranque.alambre);
      assert.equal(a.mm, 0.35);
      assert.equal(a.kg, 0.3);
    });

    test('un punto detras del KG no se lleva puesto el peso', () => {
      const a = parsearAlambre(leido.circuitos.trabajo.alambre);
      assert.equal(a.mm, 0.5);
      assert.equal(a.kg, 0.55, '"0,550 KG." con punto final daba null');
    });
  });
});
