/**
 * Genera todos los PNG que necesita la PWA a partir de un solo SVG
 * fuente (design/icon-fuente.svg).
 *
 * Un solo dibujo, varios tamanos: asi si el dia de manana se cambia el
 * icono, se edita un archivo y se corre este script, en vez de tener que
 * acordarse de retocar seis PNG a mano y que alguno quede desactualizado.
 *
 * Uso:  node scripts/generar-iconos.mjs
 */

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FUENTE = fileURLToPath(new URL('../design/icon-fuente.svg', import.meta.url));
const GLIFO = fileURLToPath(new URL('../design/icon-glifo.svg', import.meta.url));
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));

// El color mas oscuro del degrade del fondo: el maskable necesita un
// color solido de borde a borde, no el degrade completo, porque el
// glifo se compone chico y centrado y un degrade ahi se veria como un
// recuadro de otro tono en vez de fondo continuo.
const FONDO_SOLIDO = '#1c3f61';

mkdirSync(PUBLIC, { recursive: true });

const rutaPublic = (nombre) => `${PUBLIC}${nombre}`;
const desde = (opts = {}) => sharp(FUENTE, { density: 384 }).resize(opts.tam, opts.tam, opts);

async function normal(tam, nombre) {
  await desde({ tam }).png().toFile(rutaPublic(nombre));
  console.log(`  ${nombre} (${tam}x${tam})`);
}

/**
 * Maskable: Android recorta el icono con formas distintas (circulo,
 * squircle, etc) segun el launcher, y solo garantiza visible el 80%
 * central. El dibujo ya tiene margen de sobra, pero se lo achica un
 * poco mas para no confiar en el limite justo.
 */
async function maskable(tam, nombre) {
  const lienzo = Math.round(tam * 0.6);
  const glifo = await sharp(GLIFO, { density: 384 }).resize(lienzo, lienzo).png().toBuffer();
  await sharp({
    create: { width: tam, height: tam, channels: 4, background: FONDO_SOLIDO },
  })
    .composite([{ input: glifo, gravity: 'center' }])
    .png()
    .toFile(rutaPublic(nombre));
  console.log(`  ${nombre} (${tam}x${tam}, maskable)`);
}

console.log('Generando iconos desde design/icon-fuente.svg...\n');

await normal(192, 'pwa-192.png');
await normal(512, 'pwa-512.png');
await maskable(192, 'maskable-192.png');
await maskable(512, 'maskable-512.png');

// iOS ignora el manifest para el icono de pantalla de inicio y usa este
// link especifico. No admite transparencia: el fondo del SVG ya es
// opaco, asi que alcanza con el tamano que Apple recomienda.
await normal(180, 'apple-touch-icon.png');

await normal(32, 'favicon-32.png');
await normal(16, 'favicon-16.png');

console.log('\nListo.');
