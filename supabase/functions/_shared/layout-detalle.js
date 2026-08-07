/**
 * Donde va cada renglon del detalle en el PDF del presupuesto.
 *
 * Esto vivia suelto adentro del generador y tenia un error de 0,45 pt
 * que no se ve leyendo el codigo pero si en el papel: la linea
 * separadora quedaba 6 pt por encima de la base del renglon siguiente,
 * y una mayuscula de 9 pt mide 6,45 pt de alto. Resultado: la raya
 * cruzaba el techo de las letras del renglon de abajo y parecia que un
 * item se montaba sobre el otro.
 *
 * Separado y con medidas explicitas se puede probar sin generar un PDF
 * ni desplegar la funcion.
 */

export const TAM_TEXTO = 9;
export const INTERLINEA = 11;

export const ANCHO_HOJA = 595.28;
export const MARGEN = 42;

/**
 * Las cuatro columnas del detalle.
 *
 * Se calculan en vez de estar escritas a mano porque el reparto anterior
 * le dejaba 62 pt a la columna de importe, y "$ 1.243.123,00" en cuerpo
 * 9 mide 60: quedaban 2 pt entre el precio unitario y el importe, o sea
 * pegados. Con un digito mas se superponian de verdad.
 *
 * Los anchos salen de la cifra mas grande que el taller puede llegar a
 * facturar, con aire de sobra.
 */
// 82 pt entran los nueve digitos de "$ 123.430.123,00" (70 pt) con aire.
// Con la inflacion, un rebobinado grande se va a esa cifra antes de lo
// que uno cree, asi que conviene que la columna aguante.
export const ANCHO_IMPORTE = 82;
export const ANCHO_PRECIO = 82;
export const ANCHO_CANT = 42;

export function columnas({ ancho = ANCHO_HOJA, margen = MARGEN } = {}) {
  const derImporte = ancho - margen - 8;
  const derPrecio = derImporte - ANCHO_IMPORTE;
  const derCant = derPrecio - ANCHO_PRECIO;
  const izqDesc = margen + 10;

  return {
    izqDesc,
    // La descripcion termina donde arranca la columna de cantidad.
    anchoDesc: derCant - ANCHO_CANT - izqDesc,
    derCant,
    derPrecio,
    derImporte,
  };
}

/** De la base del ultimo renglon hacia abajo, hasta la linea. */
export const PAD_ABAJO = 8;

/** De la linea hacia abajo, hasta la base del renglon siguiente. */
export const PAD_ARRIBA = 13;

/**
 * Alto de las mayusculas de Helvetica como fraccion del cuerpo. Es lo
 * que hay que despejar por encima de la base para que nada toque el
 * texto.
 */
export const FACTOR_MAYUSCULA = 0.717;

export const altoMayuscula = (tam = TAM_TEXTO) => tam * FACTOR_MAYUSCULA;

/**
 * Corta un texto en renglones que entren en el ancho dado.
 *
 * `medir(texto, tam)` devuelve el ancho en puntos.
 */
export function envolver(texto, medir, tam, ancho) {
  const palabras = String(texto ?? '').split(/\s+/).filter(Boolean);
  const renglones = [];
  let actual = '';

  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (medir(prueba, tam) > ancho && actual) {
      renglones.push(actual);
      actual = p;
    } else {
      actual = prueba;
    }
  }
  if (actual) renglones.push(actual);

  // Una sola palabra mas ancha que la columna no se puede cortar por
  // espacios. Se parte por caracteres: sin esto se derrama sobre la
  // columna de cantidad.
  const cortados = [];
  for (const r of renglones) {
    if (medir(r, tam) <= ancho) { cortados.push(r); continue; }
    let resto = r;
    while (resto && medir(resto, tam) > ancho) {
      let n = resto.length;
      while (n > 1 && medir(resto.slice(0, n), tam) > ancho) n -= 1;
      cortados.push(resto.slice(0, n));
      resto = resto.slice(n);
    }
    if (resto) cortados.push(resto);
  }

  return cortados.length ? cortados : [''];
}

/**
 * Calcula la posicion de cada renglon.
 *
 * Devuelve una lista de filas con: en que pagina cae, la base de cada
 * linea de texto, la base de los importes y donde va la raya de abajo.
 * No dibuja nada: eso queda del lado del generador.
 */
export function disponerRenglones({
  items = [],
  medir,
  anchoDesc,
  yInicio,
  yMinimo,
  yTope,
}) {
  const filas = [];
  let pagina = 0;
  let y = yInicio;

  for (const it of items) {
    const lineas = envolver(it.descripcion, medir, TAM_TEXTO, anchoDesc);
    const alto = (lineas.length - 1) * INTERLINEA + PAD_ABAJO + PAD_ARRIBA;

    // Si la fila no entra entera, va a la pagina siguiente. Se compara
    // contra el fondo de la fila --no contra su base-- para que una
    // descripcion de cuatro renglones no quede partida al pie.
    if (y - alto < yMinimo) {
      pagina += 1;
      y = yTope;
    }

    const baseUltima = y - (lineas.length - 1) * INTERLINEA;

    filas.push({
      item: it,
      pagina,
      alto,
      lineas: lineas.map((texto, i) => ({ texto, y: y - i * INTERLINEA })),
      // Cantidad, precio e importe van alineados con la primera linea.
      yImportes: y,
      ySeparador: baseUltima - PAD_ABAJO,
    });

    y -= alto;
  }

  return { filas, yFinal: y, paginas: pagina + 1 };
}
