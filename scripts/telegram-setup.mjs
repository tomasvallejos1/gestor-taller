/**
 * Deja el webhook de Telegram listo.
 *
 * El "webhook secret" no lo entrega Telegram: lo elegis vos. Se genera
 * aca, se guarda en Supabase y se le declara a Telegram en la misma
 * corrida, asi que no hace falta que lo veas ni que lo copies.
 *
 * El token sale de @BotFather. Dos formas de pasarlo:
 *
 *   node scripts/telegram-setup.mjs 123456:AAaa...      (mas simple)
 *
 *   # o por entorno, si no querras que quede en el historial del shell:
 *   $env:TELEGRAM_BOT_TOKEN="123456:AAaa..."            (PowerShell)
 *   export TELEGRAM_BOT_TOKEN=123456:AAaa...            (bash)
 *   node scripts/telegram-setup.mjs
 *
 * OJO en PowerShell: `VAR=x comando` es sintaxis de bash y PowerShell la
 * rechaza con un error de parseo. Ahi va `$env:VAR="x"; comando`.
 */

import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const token = (process.argv[2] ?? process.env.TELEGRAM_BOT_TOKEN ?? '').trim();

if (!token) {
  console.error('\nFalta el token del bot.\n');
  console.error('  node scripts/telegram-setup.mjs <token-de-BotFather>\n');
  console.error('Si estas en PowerShell, NO uses "VAR=x node ..." : es sintaxis de bash.');
  process.exit(1);
}
if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token)) {
  console.error('\nEse token no tiene forma de token de Telegram.');
  console.error('Se parece a  123456789:AAH4dxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  console.error(`Recibi ${token.length} caracteres${token.includes(':') ? '' : ' y no tiene ":"'}.`);
  process.exit(1);
}

let ref;
try {
  ref = readFileSync(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8').trim();
} catch {
  console.error('\nNo encontre el proyecto vinculado. Corré antes:  npx supabase link');
  process.exit(1);
}

const url = `https://${ref}.supabase.co/functions/v1/telegram`;
const secreto = randomBytes(24).toString('hex');
const paso = (t) => console.log(`\n→ ${t}`);

// spawnSync de un .cmd sin shell:true tira EINVAL en Windows (bug
// conocido de Node con archivos .cmd/.bat). La alternativa es shell:true,
// que en general no escapa argumentos - pero aca es seguro: el unico
// valor variable es `secreto`, que sale de randomBytes().toString('hex')
// y por lo tanto solo puede tener [0-9a-f]. Nada que inyectar.
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

paso('Guardando el secreto en Supabase');
try {
  // process.noDeprecation en vez de silenciar el warning con un filtro de
  // stderr: la llamada es sincronica y corre en este mismo proceso, asi
  // que alcanza con pedirle a Node que no emita el aviso de DEP0190 (ya
  // documentado arriba por que shell:true es seguro en este caso puntual).
  const previo = process.noDeprecation;
  process.noDeprecation = true;
  try {
    execFileSync(
      npx,
      ['--yes', 'supabase@latest', 'secrets', 'set', `TELEGRAM_WEBHOOK_SECRET=${secreto}`],
      { stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' },
    );
  } finally {
    process.noDeprecation = previo;
  }
} catch (e) {
  console.error('  No pude guardarlo:', e.message.split('\n')[0]);
  console.error('  ¿Estas logueado?  npx supabase login');
  process.exit(1);
}
console.log('  guardado (no se imprime a proposito)');

paso('Registrando el webhook en Telegram');
const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url,
    secret_token: secreto,
    // Solo mensajes: cada tipo de update que no se filtra es trabajo que
    // el bot recibe y descarta, y cuota de invocaciones gastada al pedo.
    allowed_updates: ['message'],
    // Lo encolado mientras el bot no existia no sirve, y podria disparar
    // un aluvion de respuestas viejas apenas se conecta.
    drop_pending_updates: true,
  }),
});

const cuerpo = await r.json().catch(() => ({}));
if (!cuerpo.ok) {
  console.error('  Telegram lo rechazo:', cuerpo.description ?? `HTTP ${r.status}`);
  process.exit(1);
}
console.log(`  apuntando a ${url}`);

paso('Como lo ve Telegram');
const info = await (await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)).json();
const i = info.result ?? {};
console.log('  url          :', i.url || '(ninguna)');
console.log('  con secreto  :', i.has_custom_certificate === false && i.url ? 'si' : '(revisar)');
console.log('  pendientes   :', i.pending_update_count ?? 0);
if (i.last_error_message) {
  console.log('  ultimo error :', i.last_error_message);
  console.log('  (si dice 401, la funcion quedo con verify_jwt activo)');
}

paso('Cargando el menu de comandos');
// El "/" del chat de Telegram muestra esta lista con autocompletar. Sin
// esto el bot funciona igual, pero cada comando hay que recordarlo o
// leerlo de /ayuda en vez de verlo tipeando "/".
const comandos = [
  { command: 'presupuesto', description: 'Armar uno nuevo y recibir el PDF' },
  { command: 'cliente', description: 'Cargar un cliente (avisa si hay uno parecido)' },
  { command: 'ficha', description: 'Ficha tecnica completa: /ficha 12' },
  { command: 'buscar', description: 'Buscar por descripcion, marca o uso' },
  { command: 'foto', description: 'Foto de la ficha de papel: /foto 12' },
  { command: 'cancelar', description: 'Cortar lo que se este armando' },
  { command: 'ayuda', description: 'Ver esta lista' },
];
const rCmd = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ commands: comandos }),
});
const cCmd = await rCmd.json().catch(() => ({}));
if (!cCmd.ok) {
  console.log('  No se pudo cargar (no es grave, el bot funciona igual):', cCmd.description ?? rCmd.status);
} else {
  console.log(`  ${comandos.length} comandos cargados`);
}

console.log('\nListo. Escribile /start al bot.');
