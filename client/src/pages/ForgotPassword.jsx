import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

const ForgotPassword = () => {
  const navigate = useNavigate();
  
  // ESTADOS
  const [step, setStep] = useState(1); // 1 = Pedir Email, 2 = Pedir Código
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Datos del formulario
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // PASO 1: ENVIAR EMAIL
  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.post('/auth/forgot-password', { email });
      setStep(2); // Avanzamos al siguiente paso
    } catch (err) {
      setError(err.response?.data?.message || 'Error al enviar solicitud');
    } finally {
      setLoading(false);
    }
  };

  // PASO 2: CAMBIAR CONTRASEÑA
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return setError('Las contraseñas no coinciden');
    }
    
    setLoading(true);
    setError(null);

    try {
      await api.post('/auth/reset-password', { email, code, newPassword });
      alert('¡Contraseña actualizada! Ahora puedes ingresar.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al restablecer');
    } finally {
      setLoading(false);
    }
  };

  // --- ESTILOS ---
  const containerStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)', padding: '20px' };
  const cardStyle = { background: 'white', padding: '50px 40px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', width: '100%', maxWidth: '450px', textAlign: 'center' };
  const inputStyle = { width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '1rem', boxSizing: 'border-box', marginBottom: '15px' };
  const labelStyle = { display: 'block', marginBottom: '8px', color: '#334155', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' };
  const btnStyle = { width: '100%', background: '#0f172a', color: 'white', padding: '14px', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', border: 'none', transition: 'transform 0.2s' };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        
        <h2 style={{ fontSize: '1.8rem', color: '#0f172a', fontWeight: '800', marginBottom: '10px' }}>
          {step === 1 ? 'Recuperar Acceso' : 'Crear Nueva Clave'}
        </h2>
        
        <p style={{ color: '#64748b', marginBottom: '30px', lineHeight: '1.5' }}>
          {step === 1 
            ? 'Ingresa tu correo para recibir el código de seguridad.' 
            : `Hemos enviado un código a ${email}. Introdúcelo abajo.`}
        </p>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', border: '1px solid #fecaca' }}>
            ⚠️ {error}
          </div>
        )}

        {step === 1 ? (
          // --- FORMULARIO PASO 1 (Email) ---
          <form onSubmit={handleSendCode}>
            <label style={labelStyle}>Email Registrado</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ejemplo@bobinados.com" style={inputStyle} />
            
            <button type="submit" style={{...btnStyle, opacity: loading ? 0.7 : 1}} disabled={loading}>
              {loading ? 'Enviando...' : 'ENVIAR CÓDIGO'}
            </button>
          </form>
        ) : (
          // --- FORMULARIO PASO 2 (Código + Nueva Clave) ---
          <form onSubmit={handleResetPassword}>
            <label style={labelStyle}>Código de 6 dígitos</label>
            <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" style={{...inputStyle, textAlign:'center', letterSpacing:'5px', fontSize:'1.2rem'}} maxLength="6" />
            
            <label style={labelStyle}>Nueva Contraseña</label>
            <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="********" style={inputStyle} />
            
            <label style={labelStyle}>Confirmar Contraseña</label>
            <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="********" style={inputStyle} />

            <button type="submit" style={{...btnStyle, opacity: loading ? 0.7 : 1}} disabled={loading}>
              {loading ? 'Procesando...' : 'CAMBIAR CONTRASEÑA'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '30px', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <Link to="/login" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontWeight: '500' }}>
            ← Cancelar y volver
          </Link>
        </div>

      </div>
    </div>
  );
};

export default ForgotPassword;