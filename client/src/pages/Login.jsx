import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  
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
      setError(err.response?.data?.message || 'Credenciales incorrectas');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)', // Fondo oscuro moderno
      padding: '20px'
    }}>
      
      <div style={{ 
        background: 'white', 
        padding: '50px 40px', 
        borderRadius: '16px', 
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)', 
        width: '100%', 
        maxWidth: '420px' 
      }}>
        
        {/* Encabezado */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ 
            width: '60px', height: '60px', background: '#0f172a', borderRadius: '12px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto',
            color: '#38bdf8', fontSize: '1.8rem'
          }}>
            ⚡
          </div>
          <h2 style={{ fontSize: '1.8rem', color: '#0f172a', fontWeight: '800', marginBottom: '10px' }}>
            Acceso Negocio
          </h2>
          <p style={{ color: '#64748b' }}>Gestión Interna Bobinados David</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#334155', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>
              Correo Electrónico
            </label>
            <input 
              type="email" 
              placeholder="admin@bobinados.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
              style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '1rem' }}
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ color: '#334155', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>
                Contraseña
              </label>
              <Link to="/forgot-password" style={{ color: '#0284c7', fontSize: '0.85rem', textDecoration: 'none', fontWeight: '500' }}>
                ¿Olvidaste tu clave?
              </Link>
            </div>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '1rem' }}
            />
          </div>
          
          {error && (
            <div style={{ 
              background: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '8px', 
              marginBottom: '20px', fontSize: '0.9rem', textAlign: 'center', border: '1px solid #fecaca' 
            }}>
              ⚠️ {error}
            </div>
          )}

          <button 
            type="submit" 
            className="btn" 
            style={{ 
              width: '100%', 
              background: '#0f172a', 
              color: 'white', 
              padding: '14px', 
              borderRadius: '8px', 
              fontSize: '1rem', 
              fontWeight: '600',
              opacity: isSubmitting ? 0.7 : 1,
              transition: 'transform 0.2s',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => e.target.style.transform = 'scale(1.02)'}
            onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Verificando...' : 'INGRESAR'}
          </button>
        </form>

        <div style={{ marginTop: '30px', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <Link to="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            ← Volver al sitio público
          </Link>
        </div>

      </div>
    </div>
  );
};

export default Login;