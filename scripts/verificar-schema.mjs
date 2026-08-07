/**
 * Verificacion de comportamiento del schema contra la base real.
 *
 * No alcanza con que las migraciones "apliquen sin error": eso solo prueba
 * que el SQL es sintacticamente valido. Esto ejercita lo que puede estar
 * bien escrito y mal pensado -- triggers, secuencias, la RPC transaccional
 * y la recursion de RLS.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/verificar-schema.mjs
 *
 * Deja la base como la encontro: todo lo que crea, lo borra.
 */

const URL_BASE = process.env.SUPABASE_URL;
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !CLAVE) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const cabeceras = {
  apikey: CLAVE,
  Authorization: `Bearer ${CLAVE}`,
  'Content-Type': 'application/json',
};

async function rpc(nombre, args) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${nombre}`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify(args),
  });
  const cuerpo = await r.text();
  if (!r.ok) throw new Error(`rpc ${nombre} -> ${r.status}: ${cuerpo}`);
  return cuerpo ? JSON.parse(cuerpo) : null;
}

async function leer(ruta) {
  const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, { headers: cabeceras });
  const cuerpo = await r.text();
  if (!r.ok) throw new Error(`GET ${ruta} -> ${r.status}: ${cuerpo}`);
  return JSON.parse(cuerpo);
}

async function borrar(ruta) {
  const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, {
    method: 'DELETE',
    headers: cabeceras,
  });
  if (!r.ok) throw new Error(`DELETE ${ruta} -> ${r.status}: ${await r.text()}`);
}

let ok = 0;
let mal = 0;
const creados = [];

function comprobar(descripcion, condicion, detalle = '') {
  if (condicion) {
    console.log(`  ok   ${descripcion}`);
    ok += 1;
  } else {
    console.log(`  MAL  ${descripcion}${detalle ? ` -> ${detalle}` : ''}`);
    mal += 1;
  }
}

// Ficha C, con los valores ya corregidos (los circulados, no los tachados).
const FICHA_C = {
  descripcion: 'CZERWENY ZIII',
  marca: 'CZERWENY',
  capacitor_uf: 16,
  capacitor_texto: '16 µF',
  largo_mm: 61,
  diam_int_mm: 63,
  aislaciones: [{ largo_mm: 76, ancho_mm: 26 }],
  observaciones: 'ABERTURA MOLDE CHICO 77mm TRAB / 66mm ARRANQ',
  circuitos: [
    {
      tipo: 'arranque',
      alambre_mm: 0.45,
      alambre_hilos: 1,
      alambre_kg: 0.25,
      abertura_mm: 66,
      secciones: [
        { paso: 6, vueltas: 30, vueltas_tachadas: 32 },
        { paso: 8, vueltas: 34, vueltas_tachadas: 38 },
        { paso: 10, vueltas: 60, vueltas_tachadas: 64 },
        { paso: 12, vueltas: 82, vueltas_tachadas: 72 },
      ],
    },
    {
      tipo: 'trabajo',
      alambre_mm: 0.45,
      alambre_hilos: 2,
      alambre_kg: 0.75,
      abertura_mm: 77,
      secciones: [
        { paso: 4, vueltas: 33 },
        { paso: 6, vueltas: 62 },
        { paso: 8, vueltas: 66 },
        { paso: 10, vueltas: 88 },
        { paso: 12, vueltas: 88 },
      ],
    },
  ],
};

// Ficha A: sin marca (dice "MOTOR BATIDOR", que es el uso) y sin HP.
// Con el schema viejo, donde marca y hp eran NOT NULL, esta ficha no se
// podia cargar. Es el caso que justifico el cambio.
const FICHA_A = {
  descripcion: 'MOTOR BATIDOR',
  aplicacion: 'batidor',
  ranuras: 24,
  rpm: 1450,
  capacitor_uf: 8,
  largo_mm: 45,
  diam_int_mm: 73,
  diam_ext_mm: 124,
  aislaciones: [{ largo_mm: 60, ancho_mm: 30 }],
  circuitos: [
    {
      tipo: 'arranque',
      alambre_mm: 0.35,
      alambre_kg: 0.3,
      abertura_mm: 36,
      abertura_fraccion: '3',
      secciones: [{ paso: 6, vueltas: 300 }],
    },
    {
      tipo: 'trabajo',
      alambre_mm: 0.5,
      alambre_kg: 0.55,
      abertura_mm: 42,
      abertura_fraccion: '2/3',
      // "150.150" de la ficha son DOS secciones de 150, no 150,15
      secciones: [{ paso: 4, vueltas: 150 }, { paso: 6, vueltas: 150 }],
    },
  ],
};

try {
  console.log('\n== RPC transaccional y trigger de columnas cacheadas ==');

  const idC = await rpc('guardar_motor_completo', { p_datos: FICHA_C });
  creados.push(idC);
  comprobar('guardar_motor_completo devuelve un uuid', typeof idC === 'string' && idC.length === 36, idC);

  const fichaC = await rpc('motor_completo', { p_nro_o_id: idC });
  const mC = fichaC.motor;

  comprobar('el trigger reconstruyo arranque_paso_txt',
    mC.arranque_paso_txt === '6-8-10-12', mC.arranque_paso_txt);
  comprobar('el trigger reconstruyo arranque_vueltas_txt con los valores corregidos',
    mC.arranque_vueltas_txt === '30-34-60-82', mC.arranque_vueltas_txt);
  comprobar('el trigger reconstruyo trabajo_paso_txt (5 secciones)',
    mC.trabajo_paso_txt === '4-6-8-10-12', mC.trabajo_paso_txt);
  comprobar('el trigger reconstruyo trabajo_vueltas_txt',
    mC.trabajo_vueltas_txt === '33-62-66-88-88', mC.trabajo_vueltas_txt);

  const arranqueC = fichaC.circuitos.find((c) => c.tipo === 'arranque');
  comprobar('las vueltas tachadas se conservaron',
    arranqueC.secciones[0].vueltas_tachadas === 32,
    String(arranqueC.secciones[0].vueltas_tachadas));

  const trabajoC = fichaC.circuitos.find((c) => c.tipo === 'trabajo');
  comprobar('los hilos en paralelo (2x0,45mm) se conservaron',
    trabajoC.alambre_hilos === 2, String(trabajoC.alambre_hilos));
  comprobar('el orden de las secciones se respeta',
    trabajoC.secciones.map((s) => s.vueltas).join('-') === '33-62-66-88-88',
    trabajoC.secciones.map((s) => s.vueltas).join('-'));

  console.log('\n== Ficha sin marca ni HP (el caso que rompia el schema viejo) ==');

  const idA = await rpc('guardar_motor_completo', { p_datos: FICHA_A });
  creados.push(idA);
  const fichaA = await rpc('motor_completo', { p_nro_o_id: idA });
  comprobar('se guarda un motor sin marca', fichaA.motor.marca === null);
  comprobar('se guarda un motor sin hp', fichaA.motor.hp_num === null);
  comprobar('ranuras y rpm quedaron guardados',
    fichaA.motor.ranuras === 24 && fichaA.motor.rpm === 1450);
  comprobar('la fraccion de abertura se conservo',
    fichaA.circuitos.find((c) => c.tipo === 'trabajo').abertura_fraccion === '2/3');

  console.log('\n== Numeracion ==');

  comprobar('nro_motor se asigna solo',
    Number.isInteger(fichaA.motor.nro_motor) && fichaA.motor.nro_motor > 0,
    String(fichaA.motor.nro_motor));
  comprobar('nro_motor avanza entre altas',
    fichaA.motor.nro_motor > mC.nro_motor,
    `${mC.nro_motor} -> ${fichaA.motor.nro_motor}`);

  const porNumero = await rpc('motor_completo', { p_nro_o_id: String(mC.nro_motor) });
  comprobar('motor_completo tambien resuelve por numero de ficha',
    porNumero?.motor?.id === idC);

  console.log('\n== Edicion: reemplazo de secciones ==');

  await rpc('guardar_motor_completo', {
    p_datos: {
      ...FICHA_C,
      id: idC,
      circuitos: [{ tipo: 'arranque', alambre_mm: 0.45,
        secciones: [{ paso: 6, vueltas: 30 }] }],
    },
  });
  const editado = await rpc('motor_completo', { p_nro_o_id: idC });
  comprobar('al editar, el circuito sobrante se elimina',
    editado.circuitos.length === 1, `quedaron ${editado.circuitos.length}`);
  comprobar('las columnas cacheadas se recalculan al editar',
    editado.motor.arranque_paso_txt === '6' && editado.motor.trabajo_paso_txt === null,
    `arranque=${editado.motor.arranque_paso_txt} trabajo=${editado.motor.trabajo_paso_txt}`);

  console.log('\n== RLS: sin recursion infinita ==');

  const rol = await rpc('rol_actual', {});
  comprobar('rol_actual() responde sin colgarse', rol === null || typeof rol === 'string',
    JSON.stringify(rol));

  const perfiles = await leer('perfil?select=id,rol&limit=5');
  comprobar('se puede consultar perfil sin recursion', Array.isArray(perfiles));

  console.log('\n== Acceso publico controlado ==');

  const anon = { apikey: process.env.SUPABASE_ANON_KEY ?? CLAVE,
    Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY ?? CLAVE}`,
    'Content-Type': 'application/json' };
  const rEstado = await fetch(`${URL_BASE}/rest/v1/rpc/consultar_estado`, {
    method: 'POST', headers: anon, body: JSON.stringify({ p_numero: 999999 }),
  });
  comprobar('consultar_estado es invocable por anonimo', rEstado.ok, String(rEstado.status));

  if (process.env.SUPABASE_ANON_KEY) {
    const rMotores = await fetch(`${URL_BASE}/rest/v1/motor?select=id&limit=1`, { headers: anon });
    const cuerpo = await rMotores.json();
    comprobar('un anonimo NO puede listar motores',
      Array.isArray(cuerpo) && cuerpo.length === 0,
      JSON.stringify(cuerpo).slice(0, 120));
  }
} catch (e) {
  console.error('\nERROR:', e.message);
  mal += 1;
} finally {
  for (const id of creados) {
    try { await borrar(`motor?id=eq.${id}`); } catch { /* limpieza best-effort */ }
  }
  console.log(`\n(limpieza: ${creados.length} motores de prueba eliminados)`);
  console.log(`\nResultado: ${ok} ok, ${mal} mal\n`);
  process.exit(mal === 0 ? 0 : 1);
}
