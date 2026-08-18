import test from 'node:test';
import assert from 'node:assert/strict';
import { pesos, numeroComprobante, nombreArchivo } from './datos-presupuestos.js';

/**
 * parsearMonto vive en telegram/presupuesto.ts (TypeScript, no importable
 * desde node --test). Se replica aca la MISMA implementacion para poder
 * probarla. Si se toca una, hay que tocar la otra: el bloque de abajo es
 * copia literal a proposito, y estos tests son los que avisan.
 */
function parsearMonto(texto) {
  const t = String(texto ?? '').replace(/[^\d.,-]/g, '').trim();
  if (!t) return null;

  let normal;
  if (t.includes(',')) {
    normal = t.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+\.\d{1,2}$/.test(t)) {
    normal = t;
  } else {
    normal = t.replace(/\./g, '');
  }

  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

test('parsearMonto', async (t) => {
  await t.test('coma decimal, como se escribe en el papel', () => {
    assert.equal(parsearMonto('1.500,50'), 1500.5);
    assert.equal(parsearMonto('0,35'), 0.35);
    assert.equal(parsearMonto('1.330.701,00'), 1330701);
  });

  await t.test('el punto de miles NO se lee como decimal', () => {
    // Este es el error que importa: "1.500" son mil quinientos pesos.
    // Leerlo como 1,5 emite un presupuesto por mil veces menos y nadie
    // se da cuenta hasta que el cliente lo acepta.
    assert.equal(parsearMonto('1.500'), 1500);
    assert.equal(parsearMonto('120.000'), 120000);
  });

  await t.test('sin separadores', () => {
    assert.equal(parsearMonto('1500'), 1500);
    assert.equal(parsearMonto('0'), 0);
  });

  await t.test('acepta el punto decimal si tiene 1 o 2 decimales', () => {
    // Alguien acostumbrado al teclado numerico escribe "12.50".
    assert.equal(parsearMonto('12.50'), 12.5);
    assert.equal(parsearMonto('12.5'), 12.5);
  });

  await t.test('ignora el simbolo y los espacios', () => {
    assert.equal(parsearMonto('$ 1.500,50'), 1500.5);
    assert.equal(parsearMonto('  2500  '), 2500);
    assert.equal(parsearMonto('1500 pesos'), 1500);
  });

  await t.test('lo que no es un numero devuelve null, no NaN ni 0', () => {
    // Devolver 0 seria peor que fallar: un renglon a precio cero se
    // guarda sin chistar.
    assert.equal(parsearMonto('abc'), null);
    assert.equal(parsearMonto(''), null);
    assert.equal(parsearMonto(null), null);
    assert.equal(parsearMonto(undefined), null);
  });
});

test('pesos', async (t) => {
  await t.test('formato argentino', () => {
    assert.equal(pesos(1500.5), '$ 1.500,50');
    assert.equal(pesos(1330701), '$ 1.330.701,00');
    assert.equal(pesos(0), '$ 0,00');
  });

  await t.test('un valor invalido no rompe el PDF', () => {
    assert.equal(pesos(null), '$ 0,00');
    assert.equal(pesos(undefined), '$ 0,00');
    assert.equal(pesos('no es un numero'), '$ 0,00');
  });
});

test('nombre del archivo', async (t) => {
  const p = { punto_venta: 1, numero: 5 };

  await t.test('numero de comprobante con ceros', () => {
    assert.equal(numeroComprobante(p), '0001-00000005');
  });

  await t.test('el archivo se llama como el comprobante', () => {
    assert.equal(nombreArchivo(p), 'presupuesto-0001-00000005.pdf');
  });

  await t.test('sin espacios ni acentos', () => {
    // Viaja por WhatsApp y por mail, que tratan distinto los nombres
    // raros. Ascii y guiones, nada mas.
    assert.match(nombreArchivo(p), /^[a-z0-9.-]+$/);
  });

  await t.test('aguanta un presupuesto sin punto de venta', () => {
    assert.equal(nombreArchivo({ numero: 12 }), 'presupuesto-0001-00000012.pdf');
  });
});
