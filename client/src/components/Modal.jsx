import React from 'react';

const Modal = ({ isOpen, title, message, onClose, onConfirm, type = 'info' }) => {
  if (!isOpen) return null;

  // Colores según el tipo de alerta
  const isDanger = type === 'danger';
  const confirmColor = isDanger ? '#ef4444' : '#0f172a'; // Rojo o Azul Noche

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fondo oscuro semitransparente
      backdropFilter: 'blur(4px)', // Efecto borroso moderno
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <h3 style={{ marginTop: 0, color: isDanger ? '#dc2626' : '#1e293b', fontSize: '1.25rem' }}>
          {title}
        </h3>
        <p style={{ color: '#64748b', lineHeight: '1.5', marginBottom: '24px' }}>
          {message}
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #cbd5e1',
              background: 'white',
              color: '#475569',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: confirmColor,
              color: 'white',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;