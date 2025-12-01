import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      await login(email, password);
      // Si funciona, nos manda al home del sistema
      navigate('/sistema/home');
    } catch (err) {
      // Si falla, mostramos el error
      setError(err.response?.data?.message || 'Credenciales incorrectas');
    } finally {
      setCargando(false);
    }
  };

  const containerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f1f5f9' };
  const cardStyle = { background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', textAlign: 'center' };
  const inputStyle = { width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc' };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{ color: '#0f172a', marginBottom: '10px' }}>Bienvenido</h2>
        <p style={{ marginBottom: '30px', color: '#64748b' }}>Ingresa tus credenciales para acceder</p>

        <form onSubmit={handleSubmit}>
          <input 
            type="email" 
            placeholder="usuario@ejemplo.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
            style={inputStyle}
          />
          <input 
            type="password" 
            placeholder="Contraseña" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
            style={inputStyle}
          />
          
          {error && <div style={{ color: '#ef4444', marginBottom: '15px', fontSize: '0.9rem' }}>{error}</div>}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', opacity: cargando ? 0.7 : 1 }}
            disabled={cargando}
          >
            {cargando ? 'Verificando...' : 'INGRESAR AL SISTEMA'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;