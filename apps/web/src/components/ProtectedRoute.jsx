import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './ui/Spinner';

const JERARQUIA = { lector: 1, editor: 2, super: 3 };

/**
 * Puerta de las rutas internas.
 *
 * `requiere` es el rol MINIMO: 'editor' deja pasar tambien a 'super'.
 * Esto no reemplaza a RLS, es UX: evita mostrar una pantalla que la base
 * va a rechazar igual. El permiso de verdad lo aplica Postgres.
 */
const ProtectedRoute = ({ children, requiere }) => {
  const { user, rol, loading } = useAuth();

  if (loading) {
    return (
      <div className="protected-loading-state">
        <Spinner label="Preparando tu espacio..." size="lg" centered />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiere && (JERARQUIA[rol] ?? 0) < JERARQUIA[requiere]) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '10px' }}>No tenes permiso para esta seccion</h2>
        <p style={{ color: 'var(--text-light)', margin: 0 }}>
          Tu perfil es <strong>{rol}</strong> y esta pantalla necesita <strong>{requiere}</strong>.
          Pedile a un administrador que te cambie el rol.
        </p>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
