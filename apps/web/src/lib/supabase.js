import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fallar al arrancar y no en el primer login. Sin esto, la app carga
// bien y despues tira "Failed to fetch" en la primera consulta, que no
// dice nada sobre cual es el problema real.
if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. '
    + 'Copiar .env.example a apps/web/.env y completar.',
  );
}

// Solo la clave anonima llega al navegador. La service_role saltea todas
// las policies de RLS: si entra al bundle de Vite, cualquiera que abra
// las devtools puede leer y borrar la base entera.
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // necesario para el link de reseteo de clave
  },
});
