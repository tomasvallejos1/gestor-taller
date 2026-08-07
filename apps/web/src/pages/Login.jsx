import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Alert from '../components/ui/Alert';

// Supabase devuelve estos mensajes en ingles y bastante cripticos.
const MENSAJES = {
  'Invalid login credentials': 'Correo o contrasena incorrectos.',
  'Email not confirmed': 'Todavia no confirmaste tu correo. Revisa tu bandeja de entrada.',
};

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate('/sistema/home');
    } catch (err) {
      setError(MENSAJES[err.message] ?? err.message ?? 'No pudimos validar tus credenciales.');
    } finally {
      setIsSubmitting(false);
    }
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
          maxWidth: '460px',
          borderTop: '4px solid var(--accent)',
          background: 'var(--surface)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
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
            <ShieldCheck size={30} />
          </div>

          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Acceso al Sistema</h2>
          <p style={{ color: 'var(--text-light)', margin: 0 }}>
            Gestion interna de Bobinados David
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
          <Input
            label="Correo corporativo"
            type="email"
            placeholder="tu@bobinados.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="ui-field__label">Contrasena</span>
              <Link to="/forgot-password" style={{ fontSize: '0.84rem', color: 'var(--purple-dark)', fontWeight: 600 }}>
                Recuperar acceso
              </Link>
            </div>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error ? <Alert variant="error">{error}</Alert> : null}

          <Button type="submit" variant="primary" size="lg" className="btn-bloque" isLoading={isSubmitting}>
            {isSubmitting ? 'Validando...' : 'Entrar al panel'}
          </Button>
        </form>

        <div
          style={{
            marginTop: '24px',
            borderTop: '1px solid var(--border)',
            paddingTop: '16px',
            textAlign: 'center'
          }}
        >
          <Link to="/" style={{ color: 'var(--text-light)', fontWeight: 500 }}>
            Volver al inicio publico
          </Link>
        </div>
      </Card>
    </section>
  );
};

export default Login;
