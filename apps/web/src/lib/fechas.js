/**
 * Fechas de la base, sin que se corran un dia.
 *
 * Una columna `date` de Postgres llega como "2026-08-12", y
 * `new Date("2026-08-12")` la interpreta como medianoche UTC: en
 * Argentina eso son las 21:00 del dia anterior, y la pantalla termina
 * mostrando el 11. Es el clasico "me lo trajo el 12 y aca dice 11".
 *
 * Por eso el formateo parte el texto en vez de construir un Date: lo
 * unico que no puede correrse es lo que nunca entra en una zona
 * horaria.
 */

export function fechaCorta(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  if (!d) return String(iso);
  return `${d}/${m}/${a}`;
}

/** Fecha de hoy en formato de la base, en hora local. */
export const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Dias enteros entre una fecha de la base y hoy. */
export function diasDesde(iso) {
  if (!iso) return null;
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!d) return null;
  // Los dos extremos a medianoche local: asi la cuenta da dias de
  // calendario y no depende de la hora a la que se abra la pantalla.
  const desde = new Date(a, m - 1, d);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((hoy - desde) / 86400000);
}

/**
 * "hace 6 dias".
 *
 * Para una orden abierta importa cuanto lleva esperando, no la fecha
 * exacta: "12/08" obliga a restar mentalmente. Pasado el mes y medio
 * la cuenta de dias deja de decir algo y vuelve la fecha.
 */
export function haceCuanto(iso) {
  const n = diasDesde(iso);
  if (n === null) return '';
  if (n <= 0) return 'hoy';
  if (n === 1) return 'ayer';
  if (n <= 45) return `hace ${n} dias`;
  return fechaCorta(iso);
}
