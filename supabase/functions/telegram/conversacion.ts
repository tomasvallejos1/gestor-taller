/**
 * Estado de una charla a medio terminar.
 *
 * Una fila por telegram_id (ver la migracion de telegram_conversacion):
 * una persona atiende un flujo por vez, sea /presupuesto o /cliente. Este
 * modulo es genereico a proposito -- no sabe de presupuestos ni de
 * clientes-- para que los dos lo compartan sin que uno importe del otro.
 */

export async function guardarPaso(
  admin: any, telegramId: number, flujo: string, paso: string, datos: any,
) {
  await admin.from('telegram_conversacion').upsert({
    telegram_id: telegramId,
    flujo,
    paso,
    datos,
    actualizado_en: new Date().toISOString(),
  });
}

export async function olvidar(admin: any, telegramId: number) {
  await admin.from('telegram_conversacion').delete().eq('telegram_id', telegramId);
}

export async function conversacionDe(admin: any, telegramId: number) {
  const { data } = await admin
    .from('telegram_conversacion')
    .select('flujo, paso, datos')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  return data;
}
