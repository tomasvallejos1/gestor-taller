import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Alert from '../components/ui/Alert';

/**
 * Recuperacion de clave.
 *
 * Antes era un asistente de dos pasos con un codigo de 6 digitos que
 * generaba el backend y mandaba por Gmail. Se elimino entero: el codigo
 * se guardaba en texto plano, no tenia limite de intentos (6 digitos se
 * prueban a fuerza bruta sin esfuerzo), y en la practica nunca funciono
 * porque dependia de una app-password de Gmail que no estaba configurada.
 *
 * Ahora Supabase manda un link firmado con vencimiento, y el segundo
 * paso ocurre en /nueva-clave con la sesion ya validada.
 *
 * La respuesta es siempre la misma exista o no la cuenta: decir "ese
 * correo no esta registrado" le confirma a cualquiera quien tiene acceso
 * al sistema.
 */
const ForgotPassword = () => {
  const { pedirResetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await pedirResetPassword(email);
      setEnviado(true);
    } catch (err) {
      setError(err.message ?? 'No pudimos enviar el correo.');
    } finally {
      setLoading(false);
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
            {enviado ? <MailCheck size={28} /> : <KeyRound size={28} />}
          </div>

          <h2 style={{ fontSize: '1.85rem', marginBottom: '8px' }}>
            {enviado ? 'Revisa tu correo' : 'Recuperar acceso'}
          </h2>

          <p style={{ color: 'var(--text-light)', margin: 0 }}>
            {enviado
              ? `Si ${email} corresponde a una cuenta, te llego un link para definir una clave nueva.`
              : 'Te enviamos un link para definir una clave nueva.'}
          </p>
        </div>

        {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

        {enviado ? (
          <div style={{ display: 'grid', gap: '14px' }}>
            <Alert variant="info">
              El link vence en una hora. Si no aparece, fijate en spam.
            </Alert>
            <Button variant="secondary" size="lg" onClick={() => setEnviado(false)}>
              Usar otro correo
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
            <Input
              label="Correo registrado"
              type="email"
              required
              placeholder="tu@bobinados.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Button type="submit" variant="primary" size="lg" className="btn-bloque" isLoading={loading}>
              {loading ? 'Enviando...' : 'Enviar link'}
            </Button>
          </form>
        )}

        <div
          style={{
            marginTop: '24px',
            borderTop: '1px solid var(--border)',
            paddingTop: '16px',
            textAlign: 'center'
          }}
        >
          <Link to="/login" style={{ color: 'var(--text-light)', fontWeight: 500 }}>
            Volver al login
          </Link>
        </div>
      </Card>
    </section>
  );
};

export default ForgotPassword;
