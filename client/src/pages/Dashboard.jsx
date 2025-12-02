import React from 'react';

const Dashboard = () => {
  // Estilos de texto (se adaptan al tema gracias al CSS global, no ponemos color fijo)
  const numberStyle = { fontSize: '2.5rem', margin: 0, fontWeight: '700' };
  const labelStyle = { fontSize: '0.9rem', opacity: 0.8, marginTop: '5px' };

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '20px' }}>
        Resumen del Taller
      </h2>
      
      {/* Tarjetas de Resumen */}
      <div className="grid-responsive">
        
        <div className="card" style={{ borderLeft: '5px solid #38bdf8' }}>
          <h3>Reparaciones</h3>
          <p style={numberStyle}>12</p>
          <p style={labelStyle}>En proceso</p>
        </div>

        <div className="card" style={{ borderLeft: '5px solid #ef4444' }}>
          <h3>Pendientes</h3>
          <p style={numberStyle}>5</p>
          <p style={labelStyle}>Alta prioridad</p>
        </div>

        <div className="card" style={{ borderLeft: '5px solid #10b981' }}>
          <h3>Entregados</h3>
          <p style={numberStyle}>8</p>
          <p style={labelStyle}>Este mes</p>
        </div>

      </div>

      {/* Sección Gráfico (Simulado) */}
      <div className="card" style={{ marginTop: '30px', padding: '30px' }}>
        <h3>Actividad Reciente</h3>
        <p style={{ opacity: 0.7, marginBottom: '20px' }}>Rendimiento del último semestre</p>
        
        <div style={{ 
          height: '250px', 
          background: 'rgba(100, 116, 139, 0.1)', // Fondo semitransparente para que se vea bien en ambos modos
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          borderRadius: '8px',
          border: '1px dashed var(--border)'
        }}>
          <span style={{ opacity: 0.5, fontWeight: '600' }}>[Gráfico de Barras Aquí]</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;