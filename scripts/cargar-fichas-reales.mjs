/**
 * Carga las 3 fichas de papel reales del taller.
 *
 * No son datos de prueba inventados: son las fichas fotografiadas, y
 * cumplen dos funciones. Primero, dan contenido real para trabajar en vez
 * de una base vacia. Segundo, son el conjunto de regresion contra el que
 * se va a ajustar el prompt de extraccion por foto: si el modelo lee bien
 * estas tres, lee bien el formato del taller.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cargar-fichas-reales.mjs
 */

const URL_BASE = process.env.SUPABASE_URL;
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !CLAVE) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const FICHAS = [
  {
    // Manuscrita a lapiz, papel arrugado. Sin marca: "MOTOR BATIDOR" es
    // el uso. Cliente anotado arriba: PABLO MAGONERI.
    descripcion: 'MOTOR BATIDOR',
    aplicacion: 'batidor',
    ranuras: 24,
    rpm: 1450,
    capacitor_uf: 8,
    capacitor_texto: '8 µF',
    largo_mm: 45,
    diam_int_mm: 73,
    diam_ext_mm: 124,
    aislaciones: [{ largo_mm: 60, ancho_mm: 30 }],
    circuitos: [
      {
        tipo: 'arranque',
        alambre_mm: 0.35, alambre_hilos: 1, alambre_kg: 0.3,
        abertura_mm: 36, abertura_fraccion: '3',
        secciones: [{ paso: 6, vueltas: 300 }],
      },
      {
        tipo: 'trabajo',
        alambre_mm: 0.5, alambre_hilos: 1, alambre_kg: 0.55,
        abertura_mm: 42, abertura_fraccion: '2/3',
        // "VTAS 150.150" en la ficha: DOS secciones de 150, no 150,15
        secciones: [{ paso: 4, vueltas: 150 }, { paso: 6, vueltas: 150 }],
      },
    ],
  },
  {
    // Manuscrita a birome. Cliente: JUAN.
    descripcion: 'MOTOR BOMBEADOR',
    aplicacion: 'bombeador',
    ranuras: 32,
    largo_mm: 62,
    diam_int_mm: 93,
    diam_ext_mm: 165,
    aislaciones: [{ largo_mm: 40, ancho_mm: 24 }],
    circuitos: [
      {
        tipo: 'arranque',
        alambre_mm: 0.6, alambre_hilos: 1,
        // "VTAS = 20.20-37": el punto y el guion separan igual
        secciones: [{ paso: 4, vueltas: 20 }, { paso: 6, vueltas: 20 }, { paso: 8, vueltas: 37 }],
      },
      {
        tipo: 'trabajo',
        alambre_mm: 0.7, alambre_hilos: 1, alambre_kg: 1.08,
        abertura_mm: 54, abertura_fraccion: '3/4',
        secciones: [{ paso: 4, vueltas: 80 }, { paso: 6, vueltas: 80 }, { paso: 8, vueltas: 90 }],
      },
    ],
  },
  {
    // Formulario preimpreso. HP y AMP quedaron en blanco.
    descripcion: 'CZERWENY ZIII',
    marca: 'CZERWENY',
    modelo: 'ZIII',
    capacitor_uf: 16,
    capacitor_texto: '16 µF',
    largo_mm: 61,
    diam_int_mm: 63,
    aislaciones: [{ largo_mm: 76, ancho_mm: 26 }],
    observaciones: 'ABERTURA MOLDE CHICO 77mm TRAB / 66mm ARRANQ',
    circuitos: [
      {
        tipo: 'arranque',
        alambre_mm: 0.45, alambre_hilos: 1, alambre_kg: 0.25,
        abertura_mm: 66,
        // Los valores originales quedaron tachados y corregidos abajo.
        secciones: [
          { paso: 6, vueltas: 30, vueltas_tachadas: 32 },
          { paso: 8, vueltas: 34, vueltas_tachadas: 38 },
          { paso: 10, vueltas: 60, vueltas_tachadas: 64 },
          { paso: 12, vueltas: 82, vueltas_tachadas: 72 },
        ],
      },
      {
        tipo: 'trabajo',
        // "⌀ 2x0,45mm": dos hilos en paralelo
        alambre_mm: 0.45, alambre_hilos: 2, alambre_kg: 0.75,
        abertura_mm: 77,
        secciones: [
          { paso: 4, vueltas: 33 }, { paso: 6, vueltas: 62 },
          { paso: 8, vueltas: 66 }, { paso: 10, vueltas: 88 },
          { paso: 12, vueltas: 88 },
        ],
      },
    ],
  },
];

const cabeceras = {
  apikey: CLAVE,
  Authorization: `Bearer ${CLAVE}`,
  'Content-Type': 'application/json',
};

for (const ficha of FICHAS) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/guardar_motor_completo`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({ p_datos: ficha }),
  });
  const cuerpo = await r.text();
  if (!r.ok) {
    console.error(`  FALLO  ${ficha.descripcion}: ${cuerpo}`);
    process.exitCode = 1;
  } else {
    console.log(`  ok     ${ficha.descripcion}  ->  ${JSON.parse(cuerpo)}`);
  }
}
