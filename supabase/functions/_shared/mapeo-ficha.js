/**
 * Traduccion de las etiquetas del papel a los campos de la base.
 *
 * POR QUE ESTA SEPARADO DEL MODELO
 *
 * La primera version le pedia al modelo que devolviera directamente los
 * nombres internos del schema (`aislacion_largo_mm`, `diam_int_mm`...).
 * Fallaba de forma sistematica: un modelo de 12B transcribe muy bien lo
 * que ve, pero no puede adivinar la semantica de un esquema ajeno, asi
 * que "Largo: 58 mm" terminaba en `aislacion_largo_mm` y "Alambre: 0,40"
 * en `diam_ext_mm`.
 *
 * Ahora el modelo hace solo lo que hace bien --leer el papel y decir que
 * etiqueta acompaña a cada valor-- y la traduccion ocurre aca. La
 * ventaja practica es que este archivo se testea sin gastar una sola
 * llamada a la API, y que sirve igual para cualquier proveedor.
 */

/** Quita tildes, signos y mayusculas para comparar etiquetas. */
export function normalizar(etiqueta) {
  return String(etiqueta ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cada campo con las formas en que aparece escrito en las fichas.
 * El orden importa: se prueba de la mas especifica a la mas general,
 * porque "diam ext" tiene que ganarle a "diam".
 */
const SINONIMOS = [
  ['diam_ext_mm', ['diam ext', 'diametro ext', 'diametro exterior', 'ext', 'exterior']],
  ['diam_int_mm', ['diam int', 'diametro int', 'diametro interior', 'int', 'interior', 'diam', 'diametro']],
  ['largo_mm', ['largo carcasa', 'largo', 'long', 'longitud']],
  ['ranuras', ['ranuras', 'ranura', 'nro ranuras', 'n ranuras']],
  ['rpm', ['rpm', 'revoluciones', 'vel']],
  ['hp_texto', ['hp', 'potencia', 'cv']],
  ['amperaje_texto', ['amp', 'amperaje', 'amperes', 'corriente']],
  ['capacitor_texto', ['cap', 'capacitor', 'condensador', 'uf', 'micro']],
  ['descripcion', ['motor', 'equipo', 'descripcion', 'tipo de motor']],
  ['cliente', ['cliente', 'due', 'dueno', 'propietario', 'nombre']],
  ['marca', ['marca', 'fabricante']],
  ['modelo', ['modelo', 'mod']],
  ['aplicacion', ['aplicacion', 'uso', 'servicio']],
  ['observaciones', ['observaciones', 'obs', 'notas', 'nota', 'comentarios']],
];

/**
 * Las aislaciones son una LISTA: un motor lleva varias, de medidas
 * distintas. Van en su propia tabla para no chocar con los campos
 * sueltos del motor --"Largo" a secas es el largo de la carcasa, no el
 * de la aislacion-- y para poder acumular mas de una.
 */
const AISLACION = [
  ['largo_mm', ['aislacion largo', 'aisl largo', 'aislacion']],
  ['ancho_mm', ['aislacion ancho', 'aisl ancho']],
  ['cantidad', ['aislacion cantidad', 'cantidad aislacion', 'cant aislacion']],
];

/** Etiquetas propias del bobinado, que no son campos del motor. */
const BOBINADO = [
  ['alambre', ['alambre', 'hilo', 'cobre', 'esmaltado']],
  ['paso', ['paso', 'pasos']],
  ['vueltas', ['vueltas', 'vuelta', 'vtas', 'vta', 'espiras']],
  ['abertura', ['abertura', 'abert', 'molde', 'apertura']],
];

/**
 * El segundo paso compara por PALABRA COMPLETA, no por subcadena.
 * Con `includes` a secas, "color de la caja" matcheaba amperaje porque
 * contiene la letra "a", y "largo" matcheaba cualquier cosa con esas
 * cinco letras seguidas. Un mapeo silenciosamente equivocado es peor que
 * uno que no encuentra nada: al menos lo segundo se ve.
 */
function contienePalabra(texto, forma) {
  return new RegExp(`(^|\\s)${forma.replace(/\s+/g, '\\s+')}(\\s|$)`).test(texto);
}

function buscar(tabla, etiqueta) {
  const n = normalizar(etiqueta);
  if (!n) return null;

  for (const [campo, formas] of tabla) {
    if (formas.some((f) => n === f)) return campo;
  }
  for (const [campo, formas] of tabla) {
    if (formas.some((f) => contienePalabra(n, f))) return campo;
  }
  return null;
}

export const campoDeEtiqueta = (e) => buscar(SINONIMOS, e);
export const bobinadoDeEtiqueta = (e) => buscar(BOBINADO, e);
export const aislacionDeEtiqueta = (e) => buscar(AISLACION, e);

/**
 * Convierte la transcripcion del modelo en la estructura de la ficha.
 *
 * Entrada: { lineas: [{seccion, etiqueta, valor, confianza, texto_fuente}] }
 * donde `seccion` es 'general' | 'arranque' | 'trabajo'.
 *
 * Las lineas cuya etiqueta no se reconoce NO se descartan: se acumulan
 * en `sinReconocer` para que la pantalla de revision las muestre. Un dato
 * que el modelo leyo bien pero que nosotros no supimos ubicar sigue
 * siendo informacion util, y tirarlo en silencio es lo peor que se puede
 * hacer con el.
 */
/**
 * Reparte una linea que vino sin separar.
 *
 * Cuando el papel no trae dos puntos ("RANURAS 36" en vez de
 * "RANURAS: 36"), el modelo devuelve el renglon entero como etiqueta y
 * el valor vacio. Es un caso frecuente en las fichas manuscritas, donde
 * el rotulo y el numero conviven en el mismo trazo.
 *
 * Se separa aca en vez de pedirselo al modelo: es una regla de texto
 * deterministica, y toda regla que se pueda resolver sin el modelo es
 * una cosa menos que puede salir distinta en cada corrida.
 */
function separarEtiquetaYValor(etiqueta, valor) {
  if (String(valor ?? '').trim() !== '') return { etiqueta, valor };

  const texto = String(etiqueta ?? '').trim();
  const numero = texto.match(/\d[\d.,\s/-]*/);
  if (!numero) return { etiqueta, valor };

  const resto = texto.replace(numero[0], ' ').trim();
  if (!resto) return { etiqueta, valor };

  return { etiqueta: resto, valor: numero[0].trim() };
}

/**
 * Rotulos que solo marcan donde empieza un bloque. El prompt pide que no
 * se devuelvan como lineas, pero los modelos los incluyen igual; sin
 * este filtro terminan en "sin reconocer" y ensucian la revision con
 * ruido que no es un dato.
 */
const TITULOS = new Set([
  'arranque', 'trabajo', 'bobinado', 'datos', 'general', 'ficha', 'motor',
  'aislacion', 'medidas', 'circuito',
]);

const esTitulo = (etiqueta) => TITULOS.has(normalizar(etiqueta));

/** Un nombre de persona: dos o mas palabras, sin digitos. */
function pareceNombre(texto) {
  const t = String(texto ?? '').trim();
  if (!t || /\d/.test(t)) return false;
  const palabras = t.split(/\s+/);
  return palabras.length >= 2 && palabras.length <= 4 && t.length <= 40;
}

export function mapearLineas(lineas = []) {
  const campos = {};
  const confianza = {};
  const fuente = {};
  const circuitos = { arranque: {}, trabajo: {} };
  const aislaciones = [];
  const sinReconocer = [];

  // Si el dato ya esta ocupado en la ultima aislacion, es que empezo
  // otra: la ficha puede traer varios bloques ("AISLACION 60x30" y mas
  // abajo "AISLACION 58x8"). Pisar el valor perderia el primero.
  const anotarAislacion = (clave, valor, conf, txt) => {
    let ultima = aislaciones[aislaciones.length - 1];
    if (!ultima || clave in ultima) {
      ultima = {};
      aislaciones.push(ultima);
    }
    ultima[clave] = String(valor);
    ultima[`${clave}_confianza`] = conf ?? 'media';
    ultima[`${clave}_fuente`] = txt ?? '';
  };

  for (const linea of lineas) {
    const { seccion, confianza: conf, texto_fuente: txt } = linea ?? {};
    const { etiqueta, valor } = separarEtiquetaYValor(linea?.etiqueta, linea?.valor);

    if (valor == null || String(valor).trim() === '') {
      // Sin valor y sin numero que separar. Un renglon suelto en el
      // encabezado que parece un nombre casi siempre es el cliente,
      // escrito arriba a la derecha sin rotulo. Se toma con confianza
      // media para que la revision lo mire.
      const suelto = String(linea?.etiqueta ?? '').trim();
      if (esTitulo(suelto)) continue;

      if (seccion === 'general' && pareceNombre(suelto)
          && !campoDeEtiqueta(suelto) && !('cliente' in campos)) {
        campos.cliente = suelto;
        confianza.cliente = 'media';
        fuente.cliente = txt || suelto;
      } else if (suelto && !campoDeEtiqueta(suelto) && !bobinadoDeEtiqueta(suelto)) {
        sinReconocer.push({ seccion, etiqueta: suelto, valor: '', texto_fuente: txt });
      }
      continue;
    }

    const enBobinado = seccion === 'arranque' || seccion === 'trabajo';

    if (enBobinado) {
      const clave = bobinadoDeEtiqueta(etiqueta);
      if (clave) {
        circuitos[seccion][clave] = String(valor);
        circuitos[seccion][`${clave}_confianza`] = conf ?? 'media';
        circuitos[seccion][`${clave}_fuente`] = txt ?? '';
        continue;
      }
    }

    // Antes que los campos del motor: "aislacion largo" tiene que ganarle
    // a "largo" a secas, que es el largo de la carcasa.
    const claveAisl = aislacionDeEtiqueta(etiqueta);
    if (claveAisl) {
      anotarAislacion(claveAisl, valor, conf, txt);
      continue;
    }

    const campo = campoDeEtiqueta(etiqueta);
    if (campo) {
      // Si el campo ya vino, gana el de mayor confianza.
      const rango = { alta: 3, media: 2, baja: 1 };
      if (!(campo in campos) || (rango[conf] ?? 0) > (rango[confianza[campo]] ?? 0)) {
        campos[campo] = String(valor);
        confianza[campo] = conf ?? 'media';
        fuente[campo] = txt ?? '';
      }
      continue;
    }

    sinReconocer.push({ seccion, etiqueta, valor: String(valor), texto_fuente: txt });
  }

  return { campos, confianza, fuente, circuitos, aislaciones, sinReconocer };
}
