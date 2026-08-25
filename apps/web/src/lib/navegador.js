/**
 * Cosas que el navegador da o no da segun donde este abierta la app.
 *
 * EL PROBLEMA: varias APIs modernas solo existen en "contexto seguro"
 * --HTTPS, o localhost--. En produccion la app va por HTTPS y estan
 * todas. Pero en el taller el celular entra al server de desarrollo por
 * la red local, `http://192.168.0.216:5173`, y eso NO es contexto
 * seguro: ahi `crypto.randomUUID` y `navigator.clipboard` directamente
 * no existen.
 *
 * Y no fallan avisando. `crypto.randomUUID()` tira "is not a function"
 * en la cara de quien iba a sacarle una foto a una ficha, y
 * `navigator.clipboard.writeText()` revienta con el link del
 * presupuesto ya generado y sin copiar. Las dos son cosas que se hacen
 * desde el celular, que es justo el aparato donde la app se abre por
 * http.
 *
 * Asi que todo lo que dependa del contexto seguro pasa por aca, con su
 * plan B. Nada de esto es un capricho de navegadores viejos: es la app
 * andando desde el telefono del taller.
 */

/**
 * Un identificador unico para nombrar un archivo en Storage.
 *
 * `crypto.getRandomValues` SI existe por http --no esta restringido a
 * contexto seguro, a diferencia de `randomUUID`-- asi que el plan B
 * arma el mismo UUID v4 a mano y queda igual de bueno.
 */
export function idUnico() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
    const hex = [...b].map((n) => n.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`
      + `-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Ultimo recurso. Alcanza: esto nombra un archivo, y lo unico que se
  // le pide a ese nombre es no repetirse. Que sea adivinable no importa
  // porque el bucket es privado y cada lectura va por una URL firmada.
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`;
}

/**
 * Copia texto al portapapeles. Devuelve si se pudo.
 *
 * El plan B es el truco viejo: un textarea fuera de pantalla, se
 * selecciona y se le pide al documento que copie. `execCommand` esta
 * deprecado y sigue andando en todos lados, que es exactamente lo que
 * hace falta para el unico caso donde se lo necesita.
 */
export async function copiarTexto(texto) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Puede fallar por permisos aunque exista (por ejemplo si se llama
      // sin un gesto del usuario detras). Se prueba el plan B igual.
    }
  }

  try {
    const caja = document.createElement('textarea');
    caja.value = texto;
    // Fuera de la vista pero enfocable: `display:none` no se puede
    // seleccionar, y sin seleccion no hay copia.
    caja.setAttribute('readonly', '');
    caja.style.position = 'fixed';
    caja.style.top = '-1000px';
    caja.style.opacity = '0';
    document.body.appendChild(caja);

    caja.select();
    caja.setSelectionRange(0, texto.length); // iOS ignora select() solo
    const ok = document.execCommand('copy');

    document.body.removeChild(caja);
    return ok;
  } catch {
    return false;
  }
}
