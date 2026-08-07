import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';

/**
 * Segundo paso del reseteo de clave: aca cae el link del correo.
 *
 * Supabase pone el token en el fragmento de la URL y el cliente lo
 * convierte en sesion automaticamente (detectSessionInUrl). Por eso al
 * llegar ya hay sesion, y basta con updateUser({ password }).
 */
const MINIMO = 8;

const NuevaClave = () => {
  const navigate = useNavigate();
  const { cambiarPassword } = useAuth();

  const [verificando, setVerificando] = useState(true);
  const [haySesion, setHaySesion] = useState(false);
  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    // El token del hash se procesa de forma asincronica al montar, asi
    // que no alcanza con mirar la sesion una sola vez: hay que esperar
    // el evento. Sin esto, un link valido muestra "link vencido".
    let vigente = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, sesion) => {
      if (!vigente) return;
      setHaySesion(Boolean(sesion));
      setVerificando(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!vigente) return;
      if (data.session) {
        setHaySesion(true);
        setVerificando(false);
      } else {
        // Margen para que termine de leerse el hash antes de dar por
        // invalido el link.
        setTimeout(() => { if (vigente) setVerificando(false); }, 1200);
      }
    });

    return () => { vigente = false; subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < MINIMO) {
      setError(`La clave tiene que tener al menos ${MINIMO} caracteres.`);
      return;
    }
    if (password !== repetir) {
      setError('Las claves no coinciden.');
      return;
    }

    setLoading(true);
    try {
      await cambiarPassword(password);
      setListo(true);
      setTimeout(() => navigate('/sistema/home'), 1800);
    } catch (err) {
      setError(err.message ?? 'No pudimos actualizar la clave.');
    } finally {
      setLoading(false);
    }
  };

  const contenido = () => {
    if (verificando) {
      return <Spinner label="Validando el link..." size="lg" centered />;
    }

    if (!haySesion) {
      return (
        <div style={{ display: 'grid', gap: '14px' }}>
          <Alert variant="error">
            El link no es valido o ya vencio. Pedi uno nuevo desde &quot;Recuperar acceso&quot;.
          </Alert>
          <Link to="/forgot-password">
            <Button variant="primary" size="lg" style={{ width: '100%' }}>
              Pedir un link nuevo
            </Button>
          </Link>
        </div>
      );
    }

    if (listo) {
      return <Alert variant="success">Clave actualizada. Entrando al sistema...</Alert>;
    }

    return (
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
        <Input
          label="Nueva clave"
          type="password"
          required
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Repetir la clave"
          type="password"
          required
          autoComplete="new-password"
          placeholder="••••••••"
          value={repetir}
          onChange={(e) => setRepetir(e.target.value)}
        />
        <Button type="submit" variant="primary" size="lg" className="btn-bloque" isLoading={loading}>
          {loading ? 'Guardando...' : 'Guardar clave'}
        </Button>
      </form>
    );
  };

  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--gradient-dark)',
        padding: '20px'
      }}
    >
      <Card
        className="ui-card--elevated"
        style={{
          width: '100%',
          maxWidth: '470px',
          borderTop: '4px solid var(--accent)',
          background: 'var(--surface)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div
            style={{
              width: '62px',
              height: '62px',
              borderRadius: '16px',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 14px',
              color: '#fff',
              background: 'var(--gradient-primary)',
              boxShadow: '0 14px 26px var(--accent-tint-strong)'
            }}
            aria-hidden="true"
          >
            <KeyRound size={28} />
          </div>

          <h2 style={{ fontSize: '1.85rem', marginBottom: '8px' }}>Definir nueva clave</h2>
          <p style={{ color: 'var(--text-light)', margin: 0 }}>
            Elegi una clave de al menos {MINIMO} caracteres.
          </p>
        </div>

        {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

        {contenido()}
      </Card>
    </section>
  );
};

export default NuevaClave;
