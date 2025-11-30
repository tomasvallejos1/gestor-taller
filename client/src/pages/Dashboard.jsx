const Dashboard = () => {
  return (
    <div>
      <h2 style={{ borderBottom: '2px solid #ddd', paddingBottom: '10px' }}>Resumen del Taller</h2>
      
      {/* Tarjetas de Resumen (Simulando Gráficos del PDF) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
        
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', borderLeft: '5px solid #3498db' }}>
          <h3>Reparaciones</h3>
          <p style={{ fontSize: '2rem', margin: 0 }}>12</p>
          <small>En proceso</small>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', borderLeft: '5px solid #e74c3c' }}>
          <h3>Pendientes</h3>
          <p style={{ fontSize: '2rem', margin: 0 }}>5</p>
          <small>Alta prioridad</small>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', borderLeft: '5px solid #2ecc71' }}>
          <h3>Entregados</h3>
          <p style={{ fontSize: '2rem', margin: 0 }}>8</p>
          <small>Este mes</small>
        </div>

      </div>

      <div style={{ marginTop: '40px', padding: '20px', background: 'white', borderRadius: '8px' }}>
        <h3>Actividad Reciente</h3>
        <p>Aquí irá el gráfico de rendimiento...</p>
        <div style={{ height: '200px', background: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
          [Espacio para Gráfico]
        </div>
      </div>
    </div>
  );
};

export default Dashboard;