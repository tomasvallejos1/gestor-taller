import { supabase } from './supabase';

const COLUMNAS = `
  id, nombre, telefono, email, direccion, notas, creado_en,
  tipo_persona, condicion_fiscal, documento_tipo, documento
`;

export async function listarClientes({ texto = '', pagina = 0, porPagina = 100 } = {}) {
  let q = supabase.from('cliente').select(COLUMNAS, { count: 'exact' });

  if (texto.trim()) {
    const t = texto.trim();
    q = q.or(`nombre.ilike.%${t}%,telefono.ilike.%${t}%,email.ilike.%${t}%,documento.ilike.%${t.replace(/\D/g, '')}%`);
  }

  q = q.order('nombre').range(pagina * porPagina, pagina * porPagina + porPagina - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { clientes: data ?? [], total: count ?? 0 };
}

export async function obtenerCliente(id) {
  const { data, error } = await supabase
    .from('cliente').select(COLUMNAS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function guardarCliente(cliente) {
  const fila = {
    nombre: cliente.nombre.trim(),
    telefono: cliente.telefono?.trim() || null,
    email: cliente.email?.trim() || null,
    direccion: cliente.direccion?.trim() || null,
    notas: cliente.notas?.trim() || null,
    tipo_persona: cliente.tipo_persona || null,
    condicion_fiscal: cliente.condicion_fiscal || null,
    // Sin documento no tiene sentido guardar el tipo: la base lo
    // normaliza a digitos y valida el verificador.
    documento: cliente.documento?.trim() || null,
    documento_tipo: cliente.documento?.trim() ? (cliente.documento_tipo || null) : null,
  };

  const consulta = cliente.id
    ? supabase.from('cliente').update(fila).eq('id', cliente.id)
    : supabase.from('cliente').insert(fila);

  const { data, error } = await consulta.select(COLUMNAS).single();
  if (error) throw error;
  return data;
}

export async function eliminarCliente(id) {
  const { error } = await supabase.from('cliente').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Clientes con nombre parecido al que se esta por dar de alta.
 *
 * En un taller el mismo cliente entra tres veces como "Juan Perez",
 * "juan perez" y "Perez Juan", y despues su historial queda partido en
 * tres. Esto no bloquea nada: avisa antes de crear el duplicado.
 *
 * Usa el indice trigram de la tabla, asi que compara por similitud y no
 * por prefijo: "Perez Juan" encuentra "Juan Perez".
 */
export async function buscarParecidos(nombre) {
  const limpio = nombre.trim();
  if (limpio.length < 3) return [];

  // Se buscan las dos palabras mas largas por separado: alcanza para
  // detectar el nombre invertido sin traerse media tabla.
  const palabras = limpio.split(/\s+/)
    .filter((p) => p.length >= 3)
    .sort((a, b) => b.length - a.length)
    .slice(0, 2);

  if (!palabras.length) return [];

  const { data, error } = await supabase
    .from('cliente')
    .select('id, nombre, telefono')
    .or(palabras.map((p) => `nombre.ilike.%${p}%`).join(','))
    .limit(5);

  if (error) throw error;
  return data ?? [];
}

/** Reparaciones de un cliente, con la ficha del motor asociada. */
export async function reparacionesDe(clienteId) {
  const { data, error } = await supabase
    .from('reparacion')
    .select('id, numero, estado, ingreso, egreso, notas, motor:motor_id (id, nro_motor, descripcion, marca)')
    .eq('cliente_id', clienteId)
    .order('ingreso', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
