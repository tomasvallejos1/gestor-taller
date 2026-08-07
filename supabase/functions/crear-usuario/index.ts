/**
 * Alta de usuarios.
 *
 * Existe como Edge Function por una razon concreta: crear un usuario en
 * Supabase Auth requiere la clave `service_role`, que saltea todas las
 * policies de RLS. Esa clave no puede estar en el bundle del navegador --
 * cualquiera que abra las devtools tendria control total de la base--,
 * asi que la operacion tiene que ocurrir del lado del servidor.
 *
 * La funcion valida DOS veces:
 *   1. que quien llama tenga una sesion valida
 *   2. que su rol sea `super`
 *
 * El segundo chequeo se hace con el JWT del que llama, no con
 * service_role: si se consultara el rol con la clave privilegiada, la
 * consulta saltearia RLS y bastaria con mandar un id ajeno.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

/** Clave temporal legible: se dicta por telefono o se manda por WhatsApp. */
function claveTemporal(): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin I/L/O/0/1
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

const ROLES = ['super', 'editor', 'lector'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return responder({ error: 'Metodo no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const autorizacion = req.headers.get('Authorization');
  if (!autorizacion) return responder({ error: 'Falta la cabecera de autorizacion.' }, 401);

  // Cliente con la identidad de quien llama.
  const comoUsuario = createClient(url, anon, {
    global: { headers: { Authorization: autorizacion } },
  });

  const { data: { user }, error: errorSesion } = await comoUsuario.auth.getUser();
  if (errorSesion || !user) return responder({ error: 'Sesion invalida o vencida.' }, 401);

  const { data: rol } = await comoUsuario.rpc('rol_actual');
  if (rol !== 'super') {
    return responder({ error: 'Solo un administrador puede crear usuarios.' }, 403);
  }

  let cuerpo: { email?: string; nombre?: string; rol?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: 'Cuerpo invalido.' }, 400);
  }

  const email = cuerpo.email?.trim().toLowerCase();
  const nombre = cuerpo.nombre?.trim();
  const rolNuevo = cuerpo.rol ?? 'lector';

  if (!email || !email.includes('@')) return responder({ error: 'Correo invalido.' }, 400);
  if (!nombre) return responder({ error: 'El nombre es obligatorio.' }, 400);
  if (!ROLES.includes(rolNuevo)) return responder({ error: `Rol invalido: ${rolNuevo}` }, 400);

  const admin = createClient(url, servicio);
  const clave = claveTemporal();

  // Se crea con clave temporal en vez de invitar por correo: el proyecto
  // no tiene SMTP propio y el servicio de mail incluido tiene un limite
  // muy bajo. Con la clave el alta funciona siempre, y la persona la
  // cambia desde "Recuperar acceso" al entrar.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: clave,
    email_confirm: true,
    user_metadata: { nombre, rol: rolNuevo },
  });

  if (error) {
    const yaExiste = error.message?.toLowerCase().includes('already');
    return responder(
      { error: yaExiste ? 'Ya existe un usuario con ese correo.' : error.message },
      yaExiste ? 409 : 400,
    );
  }

  return responder({
    id: data.user.id,
    email,
    nombre,
    rol: rolNuevo,
    claveTemporal: clave,
  }, 201);
});
