/**
 * La ficha, escrita para leerse en un chat.
 *
 * Vive aca y no adentro del bot para poder probarla sin webhook, sin
 * token y sin mandar un mensaje: es la parte que mas se toca --siempre
 * hay algo que ordenar distinto-- y la que mas barato sale testear.
 *
 * Se usa parse_mode HTML y no Markdown: en Markdown hay que escapar
 * quince caracteres y un guion sin escapar rompe el mensaje entero. En
 * HTML alcanza con tres.
 */

export const escapar = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/**
 * Numero como lo escribe el taller: coma decimal y sin ceros de relleno.
 * Postgres devuelve "62.00" y "0.60"; en la ficha dicen 62 y 0,60.
 */
export function num(v, decimales = 2) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(decimales).replace(/\.?0+$/, '').replace('.', ',');
}

const unir = (partes, sep = ' · ') => partes.filter(Boolean).join(sep);

const ETIQUETA_CIRCUITO = { arranque: 'Arranque', trabajo: 'Trabajo' };

function lineaAlambre(c) {
  const mm = num(c.alambre_mm);
  const hilos = Number(c.alambre_hilos) > 1 ? `${c.alambre_hilos}×` : '';
  const kg = num(c.alambre_kg, 3);

  const calibre = mm ? `⌀ ${hilos}${mm} mm` : null;

  // El peso ausente se dice, no se omite. Quien busca la ficha para
  // rebobinar necesita saber cuanto alambre pedir; un renglon que
  // simplemente no aparece se lee como "no hace falta".
  const peso = kg ? `${kg} kg` : (calibre ? 'falta el peso' : null);

  const abertura = num(c.abertura_mm)
    ? `abertura ${num(c.abertura_mm)} mm${c.abertura_fraccion ? ` (${c.abertura_fraccion})` : ''}`
    : null;

  return unir([calibre, peso, abertura]) || null;
}

function lineaSecciones(c) {
  const s = (c.secciones ?? [])
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map((x) => {
      const base = `${x.paso ?? '?'}/${x.vueltas ?? '?'}`;
      // El valor tachado se muestra: es lo que decia antes de corregirse,
      // y mas de una vez el corregido es el que esta mal.
      return x.vueltas_tachadas ? `${base} (antes ${x.vueltas_tachadas})` : base;
    });
  return s.length ? s.join(' · ') : null;
}

/** La ficha completa, para /ficha N. */
export function formatearFicha(ficha, { url } = {}) {
  if (!ficha?.motor) return 'No encontré esa ficha.';

  const m = ficha.motor;
  const L = [];

  L.push(`🔧 <b>Ficha N° ${m.nro_motor}</b> — ${escapar(m.descripcion ?? 'sin descripción')}`);

  const marca = unir([m.marca, m.modelo]);
  if (marca) L.push(escapar(marca));

  const cabecera = unir([
    m.hp_texto ?? (m.hp_num != null ? `${num(m.hp_num)} HP` : null),
    m.tipo_electrico,
    m.aplicacion,
    m.ranuras ? `${m.ranuras} ranuras` : null,
    m.rpm ? `${m.rpm} RPM` : null,
    m.amperaje_texto ?? (m.amperaje_num != null ? `${num(m.amperaje_num)} A` : null),
    m.capacitor_texto ?? (m.capacitor_uf != null ? `${num(m.capacitor_uf)} µF` : null),
  ]);
  if (cabecera) L.push(escapar(cabecera));

  const medidas = unir([
    num(m.largo_mm) ? `largo ${num(m.largo_mm)}` : null,
    num(m.diam_int_mm) ? `⌀ int ${num(m.diam_int_mm)}` : null,
    num(m.diam_ext_mm) ? `⌀ ext ${num(m.diam_ext_mm)}` : null,
  ]);
  if (medidas) L.push(`\n<b>Medidas (mm)</b>\n${escapar(medidas)}`);

  for (const tipo of ['arranque', 'trabajo']) {
    const c = (ficha.circuitos ?? []).find((x) => x.tipo === tipo);
    if (!c) continue;
    const alambre = lineaAlambre(c);
    const secciones = lineaSecciones(c);
    if (!alambre && !secciones) continue;

    L.push(`\n<b>${ETIQUETA_CIRCUITO[tipo]}</b>`);
    if (alambre) L.push(escapar(alambre));
    if (secciones) L.push(`paso/vueltas: ${escapar(secciones)}`);
  }

  const aisl = (ficha.aislaciones ?? [])
    .map((a) => unir([
      escapar(a.descripcion),
      [num(a.ancho_mm), num(a.largo_mm)].filter(Boolean).join(' × ') || null,
      a.cantidad ? `${a.cantidad} u` : null,
    ], ' '))
    .filter(Boolean);
  if (aisl.length) L.push(`\n<b>Aislaciones (mm)</b>\n${aisl.join('\n')}`);

  if (m.observaciones) L.push(`\n<b>Observaciones</b>\n${escapar(m.observaciones)}`);

  if (url) L.push(`\n<a href="${escapar(url)}">Abrir la ficha</a>`);

  return L.join('\n');
}

/** Resultados de /buscar. */
export function formatearLista(motores, { total } = {}) {
  if (!motores?.length) return 'No encontré ninguna ficha con eso.';

  const filas = motores.map((m) => {
    const detalle = unir([
      m.marca, m.hp_texto, m.tipo_electrico, m.aplicacion,
    ]);
    return `<b>N° ${m.nro_motor}</b> — ${escapar(m.descripcion ?? 'sin descripción')}`
      + (detalle ? `\n   <i>${escapar(detalle)}</i>` : '');
  });

  const cabecera = total && total > motores.length
    ? `${motores.length} de ${total} fichas:`
    : `${motores.length} ficha${motores.length === 1 ? '' : 's'}:`;

  return `${cabecera}\n\n${filas.join('\n')}\n\nPedime una con /ficha &lt;número&gt;`;
}
