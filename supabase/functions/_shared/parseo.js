/**
 * Parseo de los valores tal como los escribe el taller.
 *
 * Lo usan dos consumidores distintos y por eso vive aca:
 *   - la importacion desde Mongo, donde todos los campos son String
 *   - la extraccion de fichas por foto
 *
 * REGLA CENTRAL, y la mas facil de romper:
 *
 *   En estas fichas la coma es el separador DECIMAL y el punto es un
 *   separador de LISTA, igual que el guion.
 *
 *     "0,35"        -> 0.35        (un numero)
 *     "150.150"     -> [150, 150]  (DOS valores, no 150.15)
 *     "20.20-37"    -> [20, 20, 37]
 *     "6-8-10-12"   -> [6, 8, 10, 12]
 *
 * Interpretar "150.150" como 150,15 es el error mas peligroso de todo el
 * sistema: es silencioso, pasa cualquier validacion de tipo, y termina en
 * un motor rebobinado con la cantidad de vueltas equivocada.
 *
 * Ninguna funcion de este modulo descarta el texto original. Si algo no
 * parsea devuelve `valor: null` y conserva `texto`, para que el dato
 * crudo siga estando y alguien pueda revisarlo.
 */

/** @typedef {{ valor: number|null, texto: string|null }} Numerico */

const VACIO = Object.freeze({ valor: null, texto: null });

function limpiar(entrada) {
  if (entrada === null || entrada === undefined) return null;
  const s = String(entrada).trim();
  return s === '' ? null : s;
}

/**
 * Numero suelto. La coma manda como separador decimal.
 *
 * Si aparece un punto sin coma se lo trata como decimal (caso "0.5",
 * tipeado a la inglesa en el formulario web). Esa heuristica es segura
 * SOLO en contexto escalar: para listas usar parsearLista, donde el punto
 * siempre separa.
 *
 * @param {unknown} entrada
 * @returns {Numerico}
 */
export function parsearNumero(entrada) {
  const texto = limpiar(entrada);
  if (texto === null) return { ...VACIO };

  // Fracciones tipeadas: "1/2" -> 0.5. Aparece en HP.
  const fraccion = texto.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraccion) {
    const den = Number(fraccion[2]);
    if (den !== 0) {
      return { valor: Number(fraccion[1]) / den, texto };
    }
    return { valor: null, texto };
  }

  // Un guion entre digitos significa que esto era una lista, no un
  // escalar. "4-6-8" no es un numero: devolver 4 seria inventar un dato.
  if (/\d\s*-\s*\d/.test(texto)) return { valor: null, texto };

  // Con coma presente, la coma es el decimal y el punto queda relegado a
  // separador de miles ("1.250,50" -> 1250.50).
  const normalizado = texto.includes(',')
    ? texto.replace(/(\d)\.(?=\d{3}\b)/g, '$1').replace(',', '.')
    : texto;

  // Se BUSCA el numero en vez de borrar todo lo que no lo sea. Limpiar
  // por descarte deja pasar el punto de una abreviatura: "ABERT. 42mm"
  // se convertia en ".42" y de ahi en 0.42 en lugar de 42.
  const m = normalizado.match(/\d+(?:\.\d+)?/);
  if (!m) return { valor: null, texto };

  const valor = Number(m[0]);
  return Number.isFinite(valor) ? { valor, texto } : { valor: null, texto };
}

/**
 * Lista de enteros de una celda de paso o vueltas.
 *
 * Punto, guion, coma, barra y espacio son todos separadores. En este
 * contexto la coma NO es decimal: paso y vueltas son siempre enteros
 * (no existe "media vuelta"), asi que un separador es lo unico que la
 * coma puede estar significando.
 *
 * @param {unknown} entrada
 * @returns {{ valores: number[], texto: string|null }}
 */
export function parsearLista(entrada) {
  const texto = limpiar(entrada);
  if (texto === null) return { valores: [], texto: null };

  const valores = texto
    .split(/[\s.\-,/]+/)
    .map((p) => p.replace(/[^\d]/g, ''))
    .filter((p) => p !== '')
    .map(Number)
    .filter(Number.isFinite);

  return { valores, texto };
}

/**
 * Especificacion de alambre.
 *
 *   "⌀ 0,50mm — 0,550 KG"  -> { mm: 0.5,  hilos: 1, kg: 0.55 }
 *   "⌀2x0,45mm  0,750KG"   -> { mm: 0.45, hilos: 2, kg: 0.75 }
 *
 * El "2x" son hilos en paralelo: dos alambres de 0,45mm bobinados juntos.
 * Colapsarlo a 0,45 pierde la mitad de la seccion de cobre.
 *
 * @param {unknown} entrada
 * @returns {{ mm: number|null, hilos: number, kg: number|null, texto: string|null }}
 */
export function parsearAlambre(entrada) {
  const texto = limpiar(entrada);
  if (texto === null) return { mm: null, hilos: 1, kg: null, texto: null };

  let hilos = 1;
  let resto = texto;

  const multiplicador = resto.match(/(\d+)\s*[xX]\s*(?=[\d.,])/);
  if (multiplicador) {
    hilos = Number(multiplicador[1]);
    resto = resto.replace(multiplicador[0], '');
  }

  // El simbolo de diametro define cual de los dos numeros es el calibre.
  // Es la unica señal no ambigua: en la ficha B, "⌀ 0,70  KG 1,080", el
  // "KG" queda entre los dos numeros y puede leerse como sufijo de 0,70
  // o como prefijo de 1,080. El ⌀ no admite esa duda.
  let mm = null;
  const conDiametro = resto.match(/(?:⌀|Ø|diam\.?)\s*([\d.,]+)/i);
  if (conDiametro) {
    mm = parsearNumero(conDiametro[1]).valor;
    resto = resto.replace(conDiametro[0], ' ');
  }

  // El peso se identifica por su unidad, que aparece de cualquiera de los
  // dos lados segun quien escribio la ficha:
  //   ficha A -> "0,300 KG"   (numero, despues unidad)
  //   ficha B -> "KG 1,080"   (unidad, despues numero)
  let kg = null;
  const pesoAntes = resto.match(/([\d.,]+)\s*(?:kg|kilos?)\b/i);
  const pesoDespues = resto.match(/\b(?:kg|kilos?)\.?\s*([\d.,]+)/i);
  const peso = pesoAntes ?? pesoDespues;
  if (peso) {
    kg = parsearNumero(peso[1]).valor;
    resto = resto.replace(peso[0], ' ');
  }

  // Sin ⌀ escrito, el calibre es el numero que quedo sin unidad.
  if (mm === null) mm = parsearNumero(resto).valor;

  return { mm, hilos, kg, texto };
}

/**
 * Abertura de molde: medida en mm mas una fraccion de relacion.
 *
 *   "ABERT. 42mm (2/3)" -> { mm: 42, fraccion: '2/3' }
 *   "54mm 3/4"          -> { mm: 54, fraccion: '3/4' }
 *   "36mm (3)"          -> { mm: 36, fraccion: '3'   }
 *
 * @param {unknown} entrada
 * @returns {{ mm: number|null, fraccion: string|null, texto: string|null }}
 */
export function parsearAbertura(entrada) {
  const texto = limpiar(entrada);
  if (texto === null) return { mm: null, fraccion: null, texto: null };

  let fraccion = null;
  let resto = texto;

  // Fraccion explicita "2/3" o "3/4".
  const barra = resto.match(/(\d+)\s*\/\s*(\d+)/);
  if (barra) {
    fraccion = `${barra[1]}/${barra[2]}`;
    resto = resto.replace(barra[0], '');
  } else {
    // Numero solo entre parentesis: "(3)".
    const parentesis = resto.match(/\(\s*(\d+)\s*\)/);
    if (parentesis) {
      fraccion = parentesis[1];
      resto = resto.replace(parentesis[0], '');
    }
  }

  const mm = parsearNumero(resto).valor;
  return { mm, fraccion, texto };
}

/**
 * Entero suelto rodeado de palabras: "24 RANURAS", "1450 RPM".
 * @param {unknown} entrada
 * @returns {Numerico}
 */
export function parsearEntero(entrada) {
  const texto = limpiar(entrada);
  if (texto === null) return { ...VACIO };

  const m = texto.match(/\d+/);
  return m ? { valor: Number(m[0]), texto } : { valor: null, texto };
}

/**
 * Alinea paso y vueltas en secciones listas para bobinado_seccion.
 *
 * Si los largos no coinciden NO se rellena ni se recorta: se emparejan
 * hasta donde hay dato, el faltante queda null, y se levanta `alineado:
 * false` para que la revision lo marque. Adivinar aca es exactamente lo
 * que hay que evitar.
 *
 * @param {unknown} pasoTexto
 * @param {unknown} vueltasTexto
 */
export function armarSecciones(pasoTexto, vueltasTexto) {
  const paso = parsearLista(pasoTexto);
  const vueltas = parsearLista(vueltasTexto);
  const largo = Math.max(paso.valores.length, vueltas.valores.length);

  const secciones = [];
  for (let i = 0; i < largo; i += 1) {
    secciones.push({
      orden: i,
      paso: paso.valores[i] ?? null,
      vueltas: vueltas.valores[i] ?? null,
    });
  }

  return {
    secciones,
    alineado: paso.valores.length === vueltas.valores.length,
    pasoTexto: paso.texto,
    vueltasTexto: vueltas.texto,
  };
}

/**
 * Rangos de plausibilidad. No rechazan nada: marcan para revision.
 * Existen para atrapar el fallo silencioso donde el modelo lee bien el
 * formato pero mal el valor.
 */
export const LIMITES = Object.freeze({
  vueltasPorSeccion: 500,
  pasoMaximo: 48,
  ranurasMin: 4,
  ranurasMax: 96,
  rpmMin: 400,
  rpmMax: 30000,
  alambreMmMin: 0.05,
  alambreMmMax: 5,
});

/**
 * @param {{ranuras?: number|null, rpm?: number|null, secciones?: Array<{paso: number|null, vueltas: number|null}>, alambreMm?: number|null}} datos
 * @returns {string[]} advertencias en lenguaje llano, vacio si todo cierra
 */
export function revisarPlausibilidad(datos) {
  const avisos = [];
  const { ranuras, rpm, secciones = [], alambreMm } = datos;

  if (ranuras != null && (ranuras < LIMITES.ranurasMin || ranuras > LIMITES.ranurasMax)) {
    avisos.push(`Ranuras fuera de rango habitual: ${ranuras}`);
  }
  if (rpm != null && (rpm < LIMITES.rpmMin || rpm > LIMITES.rpmMax)) {
    avisos.push(`RPM fuera de rango habitual: ${rpm}`);
  }
  if (alambreMm != null
      && (alambreMm < LIMITES.alambreMmMin || alambreMm > LIMITES.alambreMmMax)) {
    avisos.push(`Diametro de alambre fuera de rango: ${alambreMm} mm`);
  }

  for (const s of secciones) {
    // Este es el chequeo que atrapa "150.150" leido como 150150 o similar.
    if (s.vueltas != null && s.vueltas > LIMITES.vueltasPorSeccion) {
      avisos.push(
        `${s.vueltas} vueltas en una seccion es inusualmente alto. `
        + 'Verificar que no sean dos valores juntos (ej: "150.150" son 150 y 150).',
      );
    }
    if (s.paso != null && s.paso > LIMITES.pasoMaximo) {
      avisos.push(`Paso ${s.paso} es inusualmente alto.`);
    }
  }

  return avisos;
}
