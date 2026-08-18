/**
 * Acceso a datos de motores, compartido entre la web y el bot.
 *
 * Cada funcion recibe el cliente de Supabase como primer argumento en vez
 * de importarlo. Es lo unico que hace falta para que el mismo codigo corra
 * en el navegador --con la sesion del usuario y sus policies-- y adentro
 * de una Edge Function en Deno, donde el cliente se arma por request.
 *
 * La alternativa era que el bot escribiera sus propias consultas. Con dos
 * implementaciones, un filtro nuevo o un cambio de columna hay que
 * acordarse de hacerlo en los dos lados; el dia que alguien se olvide, la
 * web y el bot muestran fichas distintas del mismo motor y nadie sabe cual
 * creer.
 */

const COLUMNAS_LISTA = `
  id, nro_motor, descripcion, marca, modelo,
  hp_num, hp_texto, tipo_electrico, aplicacion,
  arranque_paso_txt, trabajo_paso_txt, creado_en
`;

/**
 * Listado con filtros aplicados en la base.
 *
 * El front viejo se traia TODOS los motores y filtraba en memoria. Con
 * pocas fichas daba igual; con las del taller entero, es bajar la base
 * completa a un celular en cada visita a la pantalla.
 *
 * @param {object} cliente cliente de Supabase ya autenticado
 * @param {{nro?: string, texto?: string, marca?: string, modelo?: string,
 *          hp?: string, tipo?: string, orden?: string,
 *          pagina?: number, porPagina?: number}} filtros
 */
export async function listarMotores(cliente, filtros = {}) {
  const {
    nro, texto, marca, modelo, hp, tipo,
    orden = 'recientes', pagina = 0, porPagina = 50,
  } = filtros;

  let q = cliente.from('motor').select(COLUMNAS_LISTA, { count: 'exact' });

  if (nro) {
    const n = Number(String(nro).replace(/\D/g, ''));
    if (Number.isFinite(n) && n > 0) q = q.eq('nro_motor', n);
  }

  // Busqueda general sobre el indice de texto completo (descripcion,
  // marca, modelo y aplicacion juntos).
  if (texto?.trim()) {
    q = q.textSearch('busqueda', texto.trim().split(/\s+/).join(' & '), {
      type: 'plain',
      config: 'spanish',
    });
  }

  if (marca?.trim()) q = q.ilike('marca', `%${marca.trim()}%`);
  if (modelo?.trim()) q = q.ilike('modelo', `%${modelo.trim()}%`);

  // hp se busca contra el texto original ("1/2") y no contra el numerico,
  // porque el usuario escribe lo que ve en la ficha.
  if (hp?.trim()) q = q.ilike('hp_texto', `%${hp.trim()}%`);

  // "Tipo" en la ficha de papel mezcla dos cosas: el tipo electrico
  // (monofasico/trifasico) y la aplicacion (batidor/bombeador). Se busca
  // en las dos.
  if (tipo?.trim()) {
    const t = tipo.trim();
    q = q.or(`aplicacion.ilike.%${t}%,tipo_electrico.ilike.%${t}%`);
  }

  const ordenes = {
    recientes: ['creado_en', false],
    antiguos: ['creado_en', true],
    nro_desc: ['nro_motor', false],
    nro_asc: ['nro_motor', true],
  };
  const [columna, asc] = ordenes[orden] ?? ordenes.recientes;
  q = q.order(columna, { ascending: asc });

  q = q.range(pagina * porPagina, pagina * porPagina + porPagina - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { motores: data ?? [], total: count ?? 0 };
}

/**
 * Ficha completa (motor + circuitos + secciones + fotos) en un viaje.
 * Acepta uuid o numero de ficha: la app vieja linkeaba por nroMotor.
 */
export async function obtenerMotor(cliente, nroOId) {
  const { data, error } = await cliente.rpc('motor_completo', {
    p_nro_o_id: String(nroOId),
  });
  if (error) throw error;
  return data; // null si no existe
}

/**
 * Alta o edicion. Todo en una transaccion del lado de Postgres: o se
 * guarda el motor con su bobinado completo, o no se guarda nada.
 */
export async function guardarMotor(cliente, datos) {
  const { data, error } = await cliente.rpc('guardar_motor_completo', {
    p_datos: datos,
  });
  if (error) throw error;
  return data; // uuid del motor
}

export async function eliminarMotor(cliente, id) {
  const { error } = await cliente.from('motor').delete().eq('id', id);
  if (error) throw error;
}

/** Etiqueta corta para listados: "5.5 HP" o el texto original. */
export function etiquetaPotencia(motor) {
  if (motor.hp_texto) return motor.hp_texto;
  if (motor.hp_num != null) return `${motor.hp_num} HP`;
  return null;
}
