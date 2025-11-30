import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const navigate = useNavigate();
  // Estos estados guardarán lo que escriba el usuario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // ACA IRÁ LA LÓGICA DE CONEXIÓN CON EL BACKEND MÁS ADELANTE
    console.log('Intentando ingresar con:', email, password);
    
    // Por ahora, simulamos que entra exitosamente y va al panel
    navigate('/sistema/home');
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '80vh', 
      background: '#f4f4f4' 
    }}>
      <div style={{ 
        background: 'white', 
        padding: '40px', 
        borderRadius: '10px', 
        boxShadow: '0 4px 10px rgba(0,0,0,0.1)', 
        width: '100%', 
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#0056b3', marginBottom: '20px' }}>Acceso al Sistema</h2>
        <p style={{ marginBottom: '30px', color: '#666' }}>Ingresá tus credenciales</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="text" 
            placeholder="Usuario" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
          <input 
            type="password" 
            placeholder="Contraseña" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
          
          <button type="submit" className="btn" style={{ marginTop: '10px', width: '100%' }}>
            INGRESAR
          </button>
        </form>

        <div style={{ marginTop: '20px', fontSize: '0.9rem' }}>
          <a href="#" style={{ color: '#666' }}>¿Olvidaste tu contraseña?</a>
        </div>
      </div>
    </div>
  );
};

export default Login;