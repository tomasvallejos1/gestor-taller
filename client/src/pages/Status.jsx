import React from 'react';

const Status = () => {
  return (
    <div style={{ minHeight: '80vh', background: '#f8fafc', padding: '60px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '2rem', color: '#0f172a' }}>Seguimiento en Tiempo Real</h2>
          <p style={{ color: '#64748b' }}>Ingresá tu número de orden para ver el avance.</p>
        </div>

        {/* Buscador Moderno */}
        <div style={{ display: 'flex', gap: '10px', background: 'white', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <input 
            type="text" 
            placeholder="N° de Orden (Ej: 12345)" 
            style={{ border: 'none', background: 'transparent', fontSize: '1rem', padding: '10px', flex: 1, outline: 'none' }}
          />
          <button className="btn btn-primary" style={{ borderRadius: '8px', padding: '10px 25px' }}>
            Buscar
          </button>
        </div>

        {/* Ejemplo de Resultado (Simulado) */}
        <div style={{ marginTop: '40px', background: 'white', padding: '30px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '15px', marginBottom: '20px' }}>
            <span style={{ background: '#dbeafe', color: '#1e40af', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>EN PROCESO</span>
            <h3 style={{ marginTop: '10px', fontSize: '1.2rem' }}>Orden #12345</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Motor Siemens 5HP</p>
          </div>

          <div className="timeline">
            {/* Item 1 */}
            <div style={{ display: 'flex', gap: '15px', paddingBottom: '20px', borderLeft: '2px solid #e2e8f0', paddingLeft: '20px', position: 'relative' }}>
              <div style={{ position: 'absolute', left: '-6px', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: '#cbd5e1' }}></div>
              <div style={{ fontSize: '0.9rem', color: '#94a3b8', minWidth: '80px' }}>18/10</div>
              <div>Ingreso al taller</div>
            </div>
            
            {/* Item 2 (Activo) */}
            <div style={{ display: 'flex', gap: '15px', paddingBottom: '0', borderLeft: '2px solid #38bdf8', paddingLeft: '20px', position: 'relative' }}>
              <div style={{ position: 'absolute', left: '-6px', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: '#0284c7' }}></div>
              <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 'bold', minWidth: '80px' }}>22/10</div>
              <div style={{ color: '#0284c7', fontWeight: 'bold' }}>En reparación (Bobinado)</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Status;