/**
 * El formato del mensaje se prueba sin bot y sin token: es texto que
 * entra y texto que sale.
 *
 * La ficha de abajo es la salida real de motor_completo() para el motor
 * N° 10 del taller, con los numeros tal como los devuelve Postgres
 * ("62.00", "0.60"). Escribirlos "limpios" haria pasar el test sin
 * probar el formateo de numeros, que es justo lo que suele romperse.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatearFicha, formatearLista, num, escapar } from './formato-telegram.js';

const FICHA = {
  motor: {
    nro_motor: 10,
    descripcion: 'BOMBEADOR',
    marca: null,
    modelo: null,
    ranuras: 32,
    rpm: null,
    largo_mm: '62.00',
    diam_int_mm: '93.00',
    diam_ext_mm: '165.00',
    observaciones: null,
  },
  circuitos: [
    {
      tipo: 'arranque',
      alambre_mm: '0.60',
      alambre_kg: null,
      alambre_hilos: 1,
      abertura_mm: null,
      abertura_fraccion: null,
      secciones: [
        { orden: 0, paso: 4, vueltas: 20, vueltas_tachadas: null },
        { orden: 1, paso: 6, vueltas: 20, vueltas_tachadas: null },
        { orden: 2, paso: 8, vueltas: 37, vueltas_tachadas: null },
      ],
    },
    {
      tipo: 'trabajo',
      alambre_mm: '0.70',
      alambre_kg: '1.080',
      alambre_hilos: 1,
      abertura_mm: '54.00',
      abertura_fraccion: '2/3/4',
      secciones: [
        { orden: 0, paso: 4, vueltas: 80, vueltas_tachadas: null },
        { orden: 1, paso: 6, vueltas: 80, vueltas_tachadas: null },
        { orden: 2, paso: 8, vueltas: 90, vueltas_tachadas: null },
      ],
    },
  ],
  aislaciones: [{ ancho_mm: '40.00', largo_mm: '78.00', cantidad: null, descripcion: null }],
};

describe('num', () => {
  test('coma decimal y sin ceros de relleno', () => {
    assert.equal(num('62.00'), '62');
    assert.equal(num('0.60'), '0,6');
    assert.equal(num('165.00'), '165');
    assert.equal(num('1.080', 3), '1,08');
  });

  test('vacio es null, no "0" ni "NaN"', () => {
    for (const v of [null, undefined, '', 'abc']) assert.equal(num(v), null);
  });

  test('el cero es un dato, no un vacio', () => {
    assert.equal(num('0.00'), '0');
  });
});

describe('escapar', () => {
  test('los tres caracteres que rompen el HTML de Telegram', () => {
    assert.equal(escapar('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
  });
});

describe('formatearFicha', () => {
  const t = formatearFicha(FICHA);

  test('encabeza con el numero y la descripcion', () => {
    assert.match(t, /Ficha N° 10<\/b> — BOMBEADOR/);
  });

  test('los dos circuitos con su paso y vueltas', () => {
    assert.match(t, /<b>Arranque<\/b>/);
    assert.match(t, /<b>Trabajo<\/b>/);
    assert.match(t, /4\/20 · 6\/20 · 8\/37/);
    assert.match(t, /4\/80 · 6\/80 · 8\/90/);
  });

  test('el alambre con calibre, peso y abertura', () => {
    assert.match(t, /⌀ 0,7 mm · 1,08 kg · abertura 54 mm \(2\/3\/4\)/);
  });

  test('un peso que falta se dice, no se omite', () => {
    // El arranque de esta ficha quedo sin kg. Callarlo se lee como "no
    // hace falta alambre", y quien la abre es para ir a comprarlo.
    assert.match(t, /⌀ 0,6 mm · falta el peso/);
  });

  test('no aparecen campos vacios ni "null"', () => {
    assert.doesNotMatch(t, /null|undefined|NaN/);
  });

  test('sin datos no explota', () => {
    assert.equal(typeof formatearFicha(null), 'string');
    assert.equal(typeof formatearFicha({ motor: { nro_motor: 1 } }), 'string');
  });

  test('un valor tachado se muestra junto al corregido', () => {
    const con = structuredClone(FICHA);
    con.circuitos[0].secciones[0].vueltas_tachadas = 32;
    assert.match(formatearFicha(con), /4\/20 \(antes 32\)/);
  });

  test('la descripcion se escapa: puede traer < o &', () => {
    const raro = structuredClone(FICHA);
    raro.motor.descripcion = 'MOTOR <B&B>';
    const s = formatearFicha(raro);
    assert.match(s, /MOTOR &lt;B&amp;B&gt;/);
    assert.doesNotMatch(s, /MOTOR <B&B>/);
  });
});

describe('formatearLista', () => {
  test('una linea por ficha con su numero', () => {
    const s = formatearLista([
      { nro_motor: 10, descripcion: 'BOMBEADOR', marca: null, hp_texto: null },
      { nro_motor: 9, descripcion: 'BATIDOR', marca: 'Czerweny', hp_texto: '1/2' },
    ]);
    assert.match(s, /N° 10<\/b> — BOMBEADOR/);
    assert.match(s, /N° 9<\/b> — BATIDOR/);
    assert.match(s, /Czerweny · 1\/2/);
  });

  test('avisa cuando hay mas de las que se muestran', () => {
    const s = formatearLista([{ nro_motor: 1, descripcion: 'X' }], { total: 40 });
    assert.match(s, /1 de 40/);
  });

  test('sin resultados no deja al usuario sin respuesta', () => {
    assert.match(formatearLista([]), /No encontré/);
  });
});
