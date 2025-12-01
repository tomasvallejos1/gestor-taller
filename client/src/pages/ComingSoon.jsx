import React from 'react';
import { Link } from 'react-router-dom';

const ComingSoon = ({ title }) => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '70vh', 
      textAlign: 'center',
      color: '#334155'
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🚧</div>
      <h2 style={{ fontSize: '2rem', color: '#0f172a', marginBottom: '10px' }}>
        {title}
      </h2>
      <p style={{ fontSize: '1.1rem', color: '#64748b', maxWidth: '500px' }}>
        Estamos trabajando duro para traerte esta funcionalidad en la próxima actualización del sistema.
      </p>
      <Link to="/sistema/home" className="btn btn-primary" style={{ marginTop: '30px', textDecoration:'none' }}>
        Volver al Inicio
      </Link>
    </div>
  );
};

export default ComingSoon;