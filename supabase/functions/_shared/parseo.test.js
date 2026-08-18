/**
 * Casos tomados literalmente de las 3 fichas de papel reales.
 * Correr con:  node --test supabase/functions/_shared/
 *
 * Estos tests son el contrato del parser. Si alguno se rompe, hay datos
 * del taller que se estan leyendo mal.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  parsearNumero,
  parsearLista,
  parsearAlambre,
  parsearAbertura,
  parsearEntero,
  armarSecciones,
  revisarPlausibilidad,
} from './parseo.js';

describe('parsearNumero', () => {
  test('la coma es el separador decimal', () => {
    assert.equal(parsearNumero('0,35').valor, 0.35);
    assert.equal(parsearNumero('0,300').valor, 0.3);
    assert.equal(parsearNumero('1,080').valor, 1.08);
  });

  test('descarta unidades y simbolos', () => {
    assert.equal(parsearNumero('8µF').valor, 8);
    assert.equal(parsearNumero('16 µF').valor, 16);
    assert.equal(parsearNumero('73mm').valor, 73);
    assert.equal(parsearNumero('165 mm').valor, 165);
    assert.equal(parsearNumero('⌀ 0,50 mm').valor, 0.5);
  });

  test('resuelve fracciones de HP', () => {
    assert.equal(parsearNumero('1/2').valor, 0.5);
    assert.equal(parsearNumero('3/4').valor, 0.75);
  });

  test('acepta punto decimal cuando no hay coma (tipeo web)', () => {
    assert.equal(parsearNumero('0.5').valor, 0.5);
    assert.equal(parsearNumero('5.5').valor, 5.5);
  });

  test('devuelve null ante una lista, en vez de inventar el primer valor', () => {
    assert.equal(parsearNumero('4-6-8').valor, null);
    assert.equal(parsearNumero('4-6-8').texto, '4-6-8', 'conserva el original');
  });

  test('vacio y nulo no explotan', () => {
    assert.equal(parsearNumero('').valor, null);
    assert.equal(parsearNumero(null).valor, null);
    assert.equal(parsearNumero(undefined).valor, null);
    assert.equal(parsearNumero('   ').valor, null);
  });

  test('texto sin numeros devuelve null', () => {
    assert.equal(parsearNumero('s/d').valor, null);
    assert.equal(parsearNumero('CAPSE.').valor, null);
  });
});

describe('parsearLista — el punto separa, no decimaliza', () => {
  test('"150.150" son DOS valores (ficha A, trabajo)', () => {
    assert.deepEqual(parsearLista('150.150').valores, [150, 150]);
  });

  test('"20.20-37" son TRES valores (ficha B, arranque)', () => {
    assert.deepEqual(parsearLista('20.20-37').valores, [20, 20, 37]);
  });

  test('"33.62-66-88-88" son CINCO valores (ficha C, trabajo)', () => {
    assert.deepEqual(parsearLista('33.62-66-88-88').valores, [33, 62, 66, 88, 88]);
  });

  test('listas con guion', () => {
    assert.deepEqual(parsearLista('6-8-10-12').valores, [6, 8, 10, 12]);
    assert.deepEqual(parsearLista('4-6-8').valores, [4, 6, 8]);
    assert.deepEqual(parsearLista('80-80-90').valores, [80, 80, 90]);
    assert.deepEqual(parsearLista('32-38-64-72').valores, [32, 38, 64, 72]);
    assert.deepEqual(parsearLista('30-34-60-82').valores, [30, 34, 60, 82]);
  });

  test('valor unico', () => {
    assert.deepEqual(parsearLista('6').valores, [6]);
    assert.deepEqual(parsearLista('300').valores, [300]);
  });

  test('vacio devuelve lista vacia', () => {
    assert.deepEqual(parsearLista('').valores, []);
    assert.deepEqual(parsearLista(null).valores, []);
  });

  test('tolera separadores mezclados y espacios de mas', () => {
    assert.deepEqual(parsearLista('4 - 6 - 8').valores, [4, 6, 8]);
    assert.deepEqual(parsearLista('20, 20, 37').valores, [20, 20, 37]);
  });
});

describe('parsearAlambre', () => {
  test('ficha A arranque: diametro y peso', () => {
    const r = parsearAlambre('⌀ 0,35 mm — 0,300 KG');
    assert.equal(r.mm, 0.35);
    assert.equal(r.kg, 0.3);
    assert.equal(r.hilos, 1);
  });

  test('ficha A trabajo', () => {
    const r = parsearAlambre('⌀ 0,50 mm — 0,550 KG');
    assert.equal(r.mm, 0.5);
    assert.equal(r.kg, 0.55);
  });

  test('ficha B trabajo: peso mayor a 1 kg', () => {
    const r = parsearAlambre('⌀ 0,70  KG 1,080');
    assert.equal(r.mm, 0.7);
    assert.equal(r.kg, 1.08);
  });

  // Los de abajo llegan SIN el ⌀ a proposito. El modelo devuelve el
  // simbolo como etiqueta ({etiqueta: "∅", valor: "0,70 KG 1,080"}), asi
  // que la funcion nunca lo ve. Escribir el ⌀ en el test le daba una
  // pista que la ficha real no trae, y por eso el caso invertido pasaba
  // en verde mientras se guardaba mal.
  test('sin ⌀: con un numero de cada lado del KG, el peso es el de la derecha', () => {
    const r = parsearAlambre('0,70 KG 1,080');
    assert.equal(r.mm, 0.7, 'el calibre es el numero anterior al KG');
    assert.equal(r.kg, 1.08, 'el peso es el posterior');
  });

  test('sin ⌀: con el peso a la izquierda y nada a la derecha', () => {
    const r = parsearAlambre('0,35 mm 0,300 KG');
    assert.equal(r.mm, 0.35);
    assert.equal(r.kg, 0.3);
  });

  test('sin ⌀: hilos en paralelo', () => {
    const r = parsearAlambre('2x0,45 mm 0,750 KG');
    assert.equal(r.mm, 0.45);
    assert.equal(r.hilos, 2);
    assert.equal(r.kg, 0.75);
  });

  test('un calibre de bobinado nunca pesa mas que un rollo entero', () => {
    // Red de seguridad contra la inversion: el diametro de un alambre de
    // bobinado esta entre 0,1 y 3 mm. Si sale 1,08 "mm" con 0,70 "kg",
    // los numeros se cambiaron de lugar.
    for (const t of ['0,70 KG 1,080', '⌀ 0,70 KG 1,080', '0,35 mm 0,300 KG']) {
      const r = parsearAlambre(t);
      assert.ok(r.mm > 0 && r.mm <= 3, `${t}: ${r.mm}mm no es un calibre de alambre`);
    }
  });

  test('ficha C trabajo: "2x" son dos hilos en paralelo', () => {
    const r = parsearAlambre('⌀ 2x0,45 mm   0,750 KG');
    assert.equal(r.mm, 0.45, 'el diametro es de CADA hilo');
    assert.equal(r.hilos, 2, 'no se puede perder el multiplicador');
    assert.equal(r.kg, 0.75);
  });

  test('ficha C arranque: un solo hilo', () => {
    const r = parsearAlambre('⌀ 0,45 mm   0,250 KG');
    assert.equal(r.mm, 0.45);
    assert.equal(r.hilos, 1);
    assert.equal(r.kg, 0.25);
  });

  test('solo diametro, sin peso anotado', () => {
    const r = parsearAlambre('⌀ 0,60');
    assert.equal(r.mm, 0.6);
    assert.equal(r.kg, null);
  });
});

describe('parsearAbertura', () => {
  test('ficha A arranque: numero entre parentesis', () => {
    const r = parsearAbertura('ABERT. 36mm (3)');
    assert.equal(r.mm, 36);
    assert.equal(r.fraccion, '3');
  });

  test('ficha A trabajo: fraccion entre parentesis', () => {
    const r = parsearAbertura('ABERT. 42mm (2/3)');
    assert.equal(r.mm, 42);
    assert.equal(r.fraccion, '2/3');
  });

  test('ficha B trabajo: fraccion sin parentesis', () => {
    const r = parsearAbertura('ABERT. 54mm 3/4');
    assert.equal(r.mm, 54);
    assert.equal(r.fraccion, '3/4');
  });

  test('solo medida', () => {
    const r = parsearAbertura('77mm');
    assert.equal(r.mm, 77);
    assert.equal(r.fraccion, null);
  });
});

describe('parsearEntero', () => {
  test('extrae el numero de entre las palabras', () => {
    assert.equal(parsearEntero('24 RANURAS').valor, 24);
    assert.equal(parsearEntero('RANURAS 32').valor, 32);
    assert.equal(parsearEntero('1450 RPM').valor, 1450);
  });
});

describe('armarSecciones', () => {
  test('ficha A arranque: paso 6 / vueltas 300', () => {
    const r = armarSecciones('6', '300');
    assert.equal(r.alineado, true);
    assert.deepEqual(r.secciones, [{ orden: 0, paso: 6, vueltas: 300 }]);
  });

  test('ficha A trabajo: paso 4-6 / vueltas 150.150', () => {
    const r = armarSecciones('4-6', '150.150');
    assert.equal(r.alineado, true, 'el punto separa: 2 pasos, 2 vueltas');
    assert.deepEqual(r.secciones, [
      { orden: 0, paso: 4, vueltas: 150 },
      { orden: 1, paso: 6, vueltas: 150 },
    ]);
  });

  test('ficha B arranque: paso 4-6-8 / vueltas 20.20-37', () => {
    const r = armarSecciones('4-6-8', '20.20-37');
    assert.equal(r.alineado, true);
    assert.deepEqual(r.secciones, [
      { orden: 0, paso: 4, vueltas: 20 },
      { orden: 1, paso: 6, vueltas: 20 },
      { orden: 2, paso: 8, vueltas: 37 },
    ]);
  });

  test('ficha C trabajo: paso 4-6-8-10-12 / vueltas 33.62-66-88-88', () => {
    const r = armarSecciones('4-6-8-10-12', '33.62-66-88-88');
    assert.equal(r.alineado, true, '5 pasos y 5 vueltas');
    assert.equal(r.secciones.length, 5);
    assert.deepEqual(r.secciones.map((s) => s.vueltas), [33, 62, 66, 88, 88]);
  });

  test('ficha C arranque, valores ya corregidos', () => {
    const r = armarSecciones('6-8-10-12', '30-34-60-82');
    assert.equal(r.alineado, true);
    assert.deepEqual(r.secciones.map((s) => s.vueltas), [30, 34, 60, 82]);
  });

  test('largos distintos: marca desalineado y NO rellena', () => {
    const r = armarSecciones('4-6-8', '80-80');
    assert.equal(r.alineado, false);
    assert.equal(r.secciones.length, 3);
    assert.equal(r.secciones[2].vueltas, null, 'faltante queda null, no inventado');
    assert.equal(r.secciones[2].paso, 8);
  });

  test('celda vacia no genera secciones', () => {
    const r = armarSecciones('', '');
    assert.deepEqual(r.secciones, []);
    assert.equal(r.alineado, true);
  });
});

describe('revisarPlausibilidad', () => {
  test('las fichas reales no disparan advertencias', () => {
    assert.deepEqual(
      revisarPlausibilidad({
        ranuras: 24,
        rpm: 1450,
        alambreMm: 0.35,
        secciones: [{ paso: 6, vueltas: 300 }],
      }),
      [],
    );
    assert.deepEqual(
      revisarPlausibilidad({
        ranuras: 32,
        alambreMm: 0.7,
        secciones: [{ paso: 4, vueltas: 80 }, { paso: 6, vueltas: 80 }],
      }),
      [],
    );
  });

  test('atrapa "150.150" mal leido como 150150', () => {
    const avisos = revisarPlausibilidad({ secciones: [{ paso: 4, vueltas: 150150 }] });
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /150\.150/, 'la advertencia nombra el caso concreto');
  });

  test('ranuras y rpm fuera de rango', () => {
    assert.equal(revisarPlausibilidad({ ranuras: 3 }).length, 1);
    assert.equal(revisarPlausibilidad({ ranuras: 240 }).length, 1);
    assert.equal(revisarPlausibilidad({ rpm: 12 }).length, 1);
  });

  test('diametro de alambre imposible', () => {
    assert.equal(revisarPlausibilidad({ alambreMm: 45 }).length, 1,
      'un alambre de 45mm seria una barra, casi seguro son 0,45');
  });

  test('sin datos no inventa advertencias', () => {
    assert.deepEqual(revisarPlausibilidad({}), []);
  });
});
