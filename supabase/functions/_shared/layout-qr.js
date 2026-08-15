/**
 * Geometria del QR de factura electronica dentro de una caja fija.
 *
 * Separado del dibujo por la misma razon que layout-detalle.js: repartir
 * una grilla de N modulos dentro de un lado fijo en puntos es aritmetica
 * de medio punto, y un redondeo mal hecho deja huecos entre modulos que
 * confunden al lector de codigos. Con las medidas afuera del generador
 * se puede probar sin producir un PDF ni desplegar nada.
 *
 * No genera el QR: recibe un objeto ya codificado (cualquiera con
 * `getModuleCount()` e `isDark(fila, columna)`, que es la interfaz de
 * `qrcode-generator`) y devuelve donde va cada modulo oscuro.
 */

export const CAJA_QR = 90;

/**
 * @param {{getModuleCount(): number, isDark(f: number, c: number): boolean}} codigo
 * @param {{x: number, y: number, lado?: number}} pos - esquina inferior
 *   izquierda de la caja y su lado en puntos.
 * @returns {Array<{x: number, y: number, width: number, height: number}>}
 *   un rectangulo por cada modulo oscuro, listo para drawRectangle.
 */
export function modulosQr(codigo, { x, y, lado = CAJA_QR }) {
  const n = codigo.getModuleCount();
  // Se trunca a entero: pdf-lib dibuja con precision de punto flotante,
  // pero un modulo fraccionario deja una linea de un pixel sin pintar
  // entre dos modulos vecinos que si se pintaron enteros.
  const tam = Math.floor((lado / n) * 100) / 100;
  const sobrante = lado - tam * n;
  const rects = [];

  for (let fila = 0; fila < n; fila += 1) {
    for (let col = 0; col < n; col += 1) {
      if (!codigo.isDark(fila, col)) continue;
      rects.push({
        x: x + sobrante / 2 + col * tam,
        // El QR se recorre de arriba hacia abajo pero pdf-lib mide Y
        // desde abajo: la fila 0 del codigo va en el borde superior de
        // la caja, no en el inferior.
        y: y + sobrante / 2 + (n - 1 - fila) * tam,
        width: tam,
        height: tam,
      });
    }
  }

  return rects;
}
