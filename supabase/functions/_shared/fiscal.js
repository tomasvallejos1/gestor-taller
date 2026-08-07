/**
 * Datos fiscales argentinos.
 *
 * La validacion de CUIT esta duplicada a proposito: la base la aplica
 * como trigger (es la que manda, y frena tambien al bot y a cualquier
 * script), y esta version corre en el navegador para avisar mientras se
 * escribe. Un error que aparece al tipear se corrige; uno que aparece al
 * guardar hace perder el formulario entero.
 *
 * Las dos implementan el mismo modulo 11; si divergen, gana la base.
 */

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

const PREFIJOS = new Set([
  '20', '23', '24', '27', // personas fisicas
  '30', '33', '34',       // personas juridicas
  '50', '51', '55', '56', '57', '58', '59',
]);

export const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '');

/** Digito verificador de los primeros 10 digitos. */
export function digitoVerificador(base10) {
  const d = soloDigitos(base10).slice(0, 10);
  if (d.length !== 10) return null;
  const suma = [...d].reduce((a, x, i) => a + Number(x) * PESOS[i], 0);
  const resto = suma % 11;
  // La convencion de AFIP para resto 1 es 9, no 10.
  return resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
}

export function cuitValido(cuit) {
  const d = soloDigitos(cuit);
  if (d.length !== 11) return false;
  if (!PREFIJOS.has(d.slice(0, 2))) return false;
  return digitoVerificador(d) === Number(d[10]);
}

export const dniValido = (dni) => {
  const d = soloDigitos(dni);
  return d.length >= 7 && d.length <= 8;
};

/** "20123456786" -> "20-12345678-6" */
export function formatearCuit(cuit) {
  const d = soloDigitos(cuit);
  if (d.length !== 11) return String(cuit ?? '');
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** "12345678" -> "12.345.678" */
export function formatearDni(dni) {
  const d = soloDigitos(dni);
  if (d.length < 7 || d.length > 8) return String(dni ?? '');
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatearDocumento(tipo, valor) {
  if (!valor) return '';
  return tipo === 'dni' ? formatearDni(valor) : formatearCuit(valor);
}

/**
 * Devuelve el problema en lenguaje llano, o null si esta bien.
 * Se devuelve el motivo y no un booleano porque "invalido" a secas no
 * le dice a nadie que corregir.
 */
export function revisarDocumento({ tipoPersona, tipoDocumento, documento }) {
  const d = soloDigitos(documento);
  if (!d) return null; // el documento es opcional

  if (tipoPersona === 'juridica' && (tipoDocumento === 'dni' || tipoDocumento === 'cuil')) {
    return 'Una empresa se identifica con CUIT, no con DNI ni CUIL.';
  }

  if (tipoDocumento === 'dni') {
    if (!dniValido(d)) return `Un DNI tiene 7 u 8 digitos, y este tiene ${d.length}.`;
    return null;
  }

  if (tipoDocumento === 'cuit' || tipoDocumento === 'cuil') {
    if (d.length !== 11) {
      return `Un ${tipoDocumento.toUpperCase()} tiene 11 digitos, y este tiene ${d.length}.`;
    }
    if (!PREFIJOS.has(d.slice(0, 2))) {
      return `${d.slice(0, 2)} no es un comienzo valido de ${tipoDocumento.toUpperCase()}.`;
    }
    if (!cuitValido(d)) {
      const correcto = digitoVerificador(d);
      return `El ultimo digito no coincide: para ${formatearCuit(d).slice(0, 13)} `
        + `deberia terminar en ${correcto}. Revisá los numeros.`;
    }
  }

  return null;
}

export const TIPOS_PERSONA = [
  { valor: 'fisica', etiqueta: 'Persona fisica' },
  { valor: 'juridica', etiqueta: 'Empresa' },
];

export const CONDICIONES_FISCALES = [
  { valor: 'consumidor_final', etiqueta: 'Consumidor final' },
  { valor: 'monotributo', etiqueta: 'Monotributista' },
  { valor: 'responsable_inscripto', etiqueta: 'Responsable inscripto' },
  { valor: 'exento', etiqueta: 'Exento' },
  { valor: 'no_alcanzado', etiqueta: 'No alcanzado' },
];

export const TIPOS_DOCUMENTO = [
  { valor: 'dni', etiqueta: 'DNI' },
  { valor: 'cuil', etiqueta: 'CUIL' },
  { valor: 'cuit', etiqueta: 'CUIT' },
];

export const etiquetaCondicion = (v) =>
  CONDICIONES_FISCALES.find((c) => c.valor === v)?.etiqueta ?? v ?? '';

/** El documento que corresponde por defecto segun el tipo de persona. */
export const documentoSugerido = (tipoPersona) =>
  (tipoPersona === 'juridica' ? 'cuit' : 'dni');
