const Status = () => {
  return (
    <div className="container">
      <h2 style={{ textAlign: 'center', marginTop: '40px' }}>Seguimiento de Reparación</h2>

      {/* Buscador */}
      <div style={{ maxWidth: '500px', margin: '20px auto 40px', display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          placeholder="Ingresá tu número de orden..." 
          style={{ flex: 1 }}
        />
        <button className="btn">Buscar</button>
      </div>

      {/* Ejemplo Visual de Resultado (Hardcodeado por ahora) */}
      <div style={{ background: 'white', padding: '30px', borderRadius: '10px', maxWidth: '800px', margin: '0 auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        
        <div style={{ borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>Orden #12345</h3>
          <p style={{ margin: '5px 0', color: '#666' }}>Motor Siemens 5HP - Trifásico</p>
        </div>

        {/* Línea de Tiempo */}
        <div className="timeline">
          {/* Paso 1 */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', opacity: 0.6 }}>
            <div style={{ fontWeight: 'bold', minWidth: '90px' }}>18/10/25</div>
            <div>📦 Ingreso al taller</div>
          </div>

          {/* Paso 2 */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', opacity: 0.6 }}>
            <div style={{ fontWeight: 'bold', minWidth: '90px' }}>22/10/25</div>
            <div>📋 Diagnóstico completado</div>
          </div>

          {/* Paso 3 (Actual) */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', color: '#d4a373', fontWeight: 'bold' }}>
            <div style={{ minWidth: '90px' }}>23/10/25</div>
            <div>🛠️ En proceso de reparación</div>
          </div>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: '#fff3cd', borderRadius: '5px', color: '#856404' }}>
          <strong>Nota del técnico:</strong> Se están cambiando los rulemanes y barnizando.
        </div>
      </div>
    </div>
  );
};

export default Status;