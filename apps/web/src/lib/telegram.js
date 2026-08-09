import { supabase } from './supabase';

/**
 * Genera el codigo de 6 digitos para vincular la cuenta.
 * Vence a los 10 minutos; despues hay que pedir uno nuevo.
 */
export async function generarCodigoTelegram() {
  const { data, error } = await supabase.rpc('generar_codigo_telegram');
  if (error) throw error;
  return data; // string de 6 digitos
}

/** Si la sesion actual ya tiene un chat de Telegram vinculado. */
export async function obtenerEstadoTelegram() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesion vencida.');
  const { data, error } = await supabase
    .from('perfil').select('telegram_id').eq('id', user.id).maybeSingle();
  if (error) throw error;
  return Boolean(data?.telegram_id);
}

/**
 * Saca el vinculo. Esto SI se puede hacer con un update directo: la
 * base solo bloquea ASIGNAR un telegram_id por este camino, no
 * limpiarlo. Desvincularse no prueba nada --no hace falta el chat--,
 * asi que no necesita pasar por el bot.
 */
export async function desvincularTelegram() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesion vencida.');
  const { error } = await supabase
    .from('perfil').update({ telegram_id: null }).eq('id', user.id);
  if (error) throw error;
}
