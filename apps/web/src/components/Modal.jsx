import React from 'react';

const Modal = ({ isOpen, title, message, onClose, onConfirm, type = 'info', isLoading }) => {
  if (!isOpen) return null;

  const isDanger = type === 'danger';
  const confirmColor = isDanger ? '#ef4444' : '#0f172a';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', 
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--surface)', // Adaptable al tema
        color: 'var(--text-main)',    // Adaptable al tema
        padding: '30px',
        borderRadius: '12px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        border: '1px solid var(--border)'
      }}>
        <h3 style={{ marginTop: 0, color: isDanger ? '#ef4444' : 'var(--text-main)', fontSize: '1.25rem' }}>
          {title}
        </h3>
        <p style={{ color: 'var(--text-light)', lineHeight: '1.5', marginBottom: '24px' }}>
          {message}
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            onClick={onClose}
            disabled={isLoading} // Bloquear si está cargando
            style={{
              padding: '10px 20px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-light)',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              opacity: isLoading ? 0.5 : 1
            }}
          >
            Cancelar
          </button>
          
          <button 
            onClick={onConfirm}
            disabled={isLoading} // Bloquear si está cargando
            style={{
              padding: '10px 20px',
              border: 'none',
              background: confirmColor,
              color: 'white',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              opacity: isLoading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isLoading && <span className="loader-spinner">⏳</span>}
            {isLoading ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;