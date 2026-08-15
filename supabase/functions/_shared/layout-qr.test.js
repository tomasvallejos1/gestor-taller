import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosQr, CAJA_QR } from './layout-qr.js';

/** Fake con la misma interfaz que qrcode-generator: getModuleCount()
 *  e isDark(fila, columna). Un tablero de N modulos con un patron
 *  reconocible (bordes prendidos, centro apagado) alcanza para probar
 *  la geometria sin depender de la libreria real. */
function tablero(n, encendido) {
  return {
    getModuleCount: () => n,
    isDark: (f, c) => encendido(f, c),
  };
}

test('modulosQr', async (t) => {
  await t.test('un modulo por celda cuando todo esta encendido', () => {
    const n = 5;
    const codigo = tablero(n, () => true);
    const rects = modulosQr(codigo, { x: 0, y: 0, lado: 100 });
    assert.equal(rects.length, n * n);
  });

  await t.test('ningun rectangulo se sale de la caja', () => {
    const n = 21; // tamaño tipico de un QR version 1
    const codigo = tablero(n, () => true);
    const x = 42;
    const y = 100;
    const lado = CAJA_QR;
    const rects = modulosQr(codigo, { x, y, lado });

    for (const r of rects) {
      assert.ok(r.x >= x - 0.01, `modulo x=${r.x} arranca antes de la caja`);
      assert.ok(r.y >= y - 0.01, `modulo y=${r.y} arranca antes de la caja`);
      assert.ok(r.x + r.width <= x + lado + 0.01, `modulo se pasa del borde derecho`);
      assert.ok(r.y + r.height <= y + lado + 0.01, `modulo se pasa del borde superior`);
    }
  });

  await t.test('solo pinta los modulos oscuros', () => {
    const n = 3;
    // Solo el modulo (0,0) esta prendido.
    const codigo = tablero(n, (f, c) => f === 0 && c === 0);
    const rects = modulosQr(codigo, { x: 0, y: 0, lado: 30 });
    assert.equal(rects.length, 1);
  });

  await t.test('la fila 0 del codigo queda arriba de la caja, no abajo', () => {
    // pdf-lib mide Y desde abajo; el QR se lee de arriba hacia abajo.
    // Sin la inversion, la primera fila del codigo terminaria pintada
    // al pie de la caja en vez de en el borde superior.
    const n = 2;
    const arriba = tablero(n, (f, c) => f === 0 && c === 0);
    const abajo = tablero(n, (f, c) => f === 1 && c === 0);

    const rArriba = modulosQr(arriba, { x: 0, y: 0, lado: 20 })[0];
    const rAbajo = modulosQr(abajo, { x: 0, y: 0, lado: 20 })[0];

    assert.ok(rArriba.y > rAbajo.y, 'la fila 0 deberia quedar mas arriba (mayor y) que la fila 1');
  });

  await t.test('el lado por defecto es CAJA_QR', () => {
    const codigo = tablero(1, () => true);
    const r = modulosQr(codigo, { x: 0, y: 0 })[0];
    assert.equal(r.width, CAJA_QR);
  });
});
