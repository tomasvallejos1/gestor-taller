import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { supabase } from '../lib/supabase';

export const AuthContext = createContext(null);

/**
 * Sesion + perfil del usuario.
 *
 * Son dos cosas distintas y por eso se manejan por separado:
 *   - la SESION la administra Supabase (token, refresco, persistencia)
 *   - el PERFIL es nuestro (nombre, rol), y vive en la tabla `perfil`
 *
 * El rol nunca sale del token: sale de la base en cada carga. Asi, si un
 * super le baja el rol a alguien, el cambio aplica cuando esa persona
 * recarga, sin esperar a que le venza un JWT de 30 dias como pasaba antes.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  // De que usuario es el `perfil` que tenemos cargado. No alcanza con un
  // booleano "cargando": entre que se resuelve la sesion y que arranca la
  // busqueda del perfil hay un render onde habria sesion pero rol nulo, y
  // ProtectedRoute lo lee como "no logueado" y redirige al login. Pasaba
  // en cada recarga con sesion activa.
  const [perfilDe, setPerfilDe] = useState(null);

  useEffect(() => {
    let vigente = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!vigente) return;
      setSession(data.session ?? null);
      setCargandoSesion(false);
    });

    // OJO: este callback no debe hacer awaits contra supabase. Llamar a
    // la API desde adentro puede trabar el cliente. El perfil se busca en
    // el efecto de abajo, que reacciona al cambio de usuario.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_evento, nuevaSesion) => {
        if (!vigente) return;
        setSession(nuevaSesion);
        setCargandoSesion(false);
      },
    );

    return () => {
      vigente = false;
      subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setPerfil(null);
      setPerfilDe(null);
      return undefined;
    }

    let vigente = true;

    supabase
      .from('perfil')
      .select('id, nombre, rol, telegram_id, activo')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) {
          console.error('No se pudo cargar el perfil:', error.message);
          setPerfil(null);
        } else {
          setPerfil(data);
        }
        // Se marca resuelto incluso si fallo, si no `loading` no baja
        // nunca y la app queda colgada en el spinner.
        setPerfilDe(userId);
      });

    return () => { vigente = false; };
  }, [userId]);

  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setPerfil(null);
  }, []);

  const pedirResetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nueva-clave`,
    });
    if (error) throw error;
  }, []);

  const cambiarPassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const valor = useMemo(() => {
    // Un usuario desactivado tiene sesion valida pero no debe operar.
    const activo = perfil?.activo === true;

    return {
      session,
      user: session?.user && activo
        ? { ...session.user, nombre: perfil.nombre, rol: perfil.rol,
            telegramId: perfil.telegram_id }
        : null,
      perfil,
      rol: activo ? perfil.rol : null,
      esSuper: activo && perfil.rol === 'super',
      esEditor: activo && (perfil.rol === 'super' || perfil.rol === 'editor'),
      // Sigue cargando mientras haya sesion pero todavia no sepamos el rol.
      loading: cargandoSesion || (Boolean(userId) && perfilDe !== userId),
      login,
      logout,
      pedirResetPassword,
      cambiarPassword,
    };
  }, [session, perfil, cargandoSesion, userId, perfilDe,
      login, logout, pedirResetPassword, cambiarPassword]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
