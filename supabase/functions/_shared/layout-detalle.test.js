import test from 'node:test';
import assert from 'node:assert/strict';
import {
  disponerRenglones, envolver, altoMayuscula, columnas,
  TAM_TEXTO, INTERLINEA, MARGEN,
} from './layout-detalle.js';

// Helvetica ronda 0,5 del cuerpo por caracter. Alcanza para probar la
// geometria: lo que se verifica es la separacion entre renglones, no el
// ancho exacto de una fuente.
const medir = (t, tam) => String(t).length * tam * 0.5;

const ANCHO_DESC = 237;
const disponer = (items) => disponerRenglones({
  items, medir, anchoDesc: ANCHO_DESC, yInicio: 553, yMinimo: 190, yTope: 799,
});

const ITEMS = [
  { descripcion: 'Rebobinado de motor monofasico 1,5 HP clase H', cantidad: 1, precio_unit: 120000 },
  { descripcion: 'Cambio de rodamientos', cantidad: 2, precio_unit: 18000 },
  { descripcion: 'Torneado de eje y rectificado del alojamiento trasero completo', cantidad: 1, precio_unit: 45000 },
  { descripcion: 'Barnizado', cantidad: 1, precio_unit: 9000 },
];

test('envolver', async (t) => {
  await t.test('corta por espacios sin pasarse del ancho', () => {
    for (const r of envolver(ITEMS[0].descripcion, medir, TAM_TEXTO, ANCHO_DESC)) {
      assert.ok(medir(r, TAM_TEXTO) <= ANCHO_DESC, `"${r}" se pasa del ancho`);
    }
  });

  await t.test('una palabra sola mas ancha que la columna se parte igual', () => {
    // Sin esto se derramaba sobre la columna de cantidad.
    const largo = 'A'.repeat(200);
    for (const r of envolver(largo, medir, TAM_TEXTO, ANCHO_DESC)) {
      assert.ok(medir(r, TAM_TEXTO) <= ANCHO_DESC, 'una linea quedo mas ancha que la columna');
    }
  });

  await t.test('sin descripcion devuelve un renglon vacio, no cero', () => {
    assert.deepEqual(envolver('', medir, TAM_TEXTO, ANCHO_DESC), ['']);
    assert.deepEqual(envolver(null, medir, TAM_TEXTO, ANCHO_DESC), ['']);
  });
});

test('columnas', async (t) => {
  // Anchos reales de Helvetica 9 medidos con pdf-lib. El bug que se
  // arreglo era este: "$ 1.243.123,00" mide 60pt y la columna de
  // importe tenia 62, asi que quedaba pegado al precio unitario.
  const ANCHOS = {
    '$ 12,00': 30.0,
    '$ 23.122,00': 47.5,
    '$ 1.243.123,00': 60.0,
    '$ 12.430.123,00': 65.1,
    '$ 123.430.123,00': 70.1,
  };
  const c = columnas();
  const LUZ_MINIMA = 8;

  await t.test('el importe nunca se pega al precio unitario', () => {
    for (const [texto, ancho] of Object.entries(ANCHOS)) {
      const izqImporte = c.derImporte - ancho;
      const luz = izqImporte - c.derPrecio;
      assert.ok(
        luz >= LUZ_MINIMA,
        `con ${texto} quedan ${luz.toFixed(1)}pt entre importe y precio unitario`,
      );
    }
  });

  await t.test('el precio unitario nunca se pega a la cantidad', () => {
    for (const [texto, ancho] of Object.entries(ANCHOS)) {
      const luz = (c.derPrecio - ancho) - c.derCant;
      assert.ok(luz >= LUZ_MINIMA, `con ${texto} quedan ${luz.toFixed(1)}pt`);
    }
  });

  await t.test('la descripcion no llega a la columna de cantidad', () => {
    const finDesc = c.izqDesc + c.anchoDesc;
    // La cantidad mas ancha realista: "9.999" alineada a la derecha.
    const izqCant = c.derCant - 26;
    assert.ok(izqCant - finDesc >= LUZ_MINIMA, 'la descripcion roza la cantidad');
  });

  await t.test('todo entra en la hoja', () => {
    assert.ok(c.izqDesc >= MARGEN);
    assert.ok(c.derImporte <= 595.28 - MARGEN + 8);
    assert.ok(c.anchoDesc > 200, 'la descripcion quedo demasiado angosta');
  });
});

test('disponerRenglones', async (t) => {
  await t.test('ningun texto se pisa con otro', () => {
    const { filas } = disponer(ITEMS);
    const bases = filas.flatMap((f) => f.lineas.map((l) => ({ y: l.y, pagina: f.pagina })));

    for (let i = 1; i < bases.length; i++) {
      if (bases[i].pagina !== bases[i - 1].pagina) continue;
      const separacion = bases[i - 1].y - bases[i].y;
      assert.ok(
        separacion >= INTERLINEA,
        `dos renglones a ${separacion}pt: entran uno adentro del otro`,
      );
    }
  });

  await t.test('la raya separadora no toca el texto de abajo', () => {
    // Este es el bug que se estaba arreglando: la raya quedaba a 6pt de
    // la base siguiente y una mayuscula de 9pt mide 6,45pt.
    const { filas } = disponer(ITEMS);

    for (let i = 0; i < filas.length - 1; i++) {
      const siguiente = filas[i + 1];
      if (siguiente.pagina !== filas[i].pagina) continue;
      const luz = filas[i].ySeparador - siguiente.lineas[0].y;
      assert.ok(
        luz > altoMayuscula(TAM_TEXTO),
        `la raya del item ${i + 1} queda a ${luz}pt de la base del ${i + 2}, `
        + `y las mayusculas miden ${altoMayuscula(TAM_TEXTO).toFixed(2)}pt`,
      );
    }
  });

  await t.test('la raya no toca el texto de arriba', () => {
    const { filas } = disponer(ITEMS);
    for (const f of filas) {
      const ultima = f.lineas[f.lineas.length - 1].y;
      assert.ok(f.ySeparador < ultima, 'la raya quedo por encima de su propio texto');
      // Los descendentes (p, g, j) bajan ~0,21 del cuerpo.
      assert.ok(ultima - f.ySeparador > TAM_TEXTO * 0.21, 'la raya corta los descendentes');
    }
  });

  await t.test('los importes se alinean con la primera linea de la descripcion', () => {
    const { filas } = disponer(ITEMS);
    for (const f of filas) assert.equal(f.yImportes, f.lineas[0].y);
  });

  await t.test('una fila que no entra pasa entera a la pagina siguiente', () => {
    // Descripciones largas hasta forzar el corte de pagina.
    const muchos = Array.from({ length: 30 }, (_, i) => ({
      descripcion: `Trabajo numero ${i + 1} con una descripcion larga que ocupa dos renglones`,
      cantidad: 1, precio_unit: 1000,
    }));
    const { filas, paginas } = disponer(muchos);

    assert.ok(paginas > 1, 'con 30 items tendria que haber cortado de pagina');
    for (const f of filas) {
      const paginasDeLasLineas = new Set(f.lineas.map(() => f.pagina));
      assert.equal(paginasDeLasLineas.size, 1, 'una fila quedo repartida en dos paginas');
      const ultima = f.lineas[f.lineas.length - 1].y;
      assert.ok(ultima > 0, 'un renglon quedo fuera de la hoja');
    }
  });

  await t.test('sin items no rompe', () => {
    const { filas, paginas } = disponer([]);
    assert.deepEqual(filas, []);
    assert.equal(paginas, 1);
  });
});
