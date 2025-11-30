import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="container">
      {/* Hero Section */}
      <header style={{ textAlign: 'center', padding: '60px 0' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Expertos en Motores Eléctricos</h1>
        <p style={{ fontSize: '1.2rem', color: '#666' }}>Bobinados, reparaciones y mantenimiento industrial.</p>
        
        <div style={{ margin: '40px 0', padding: '40px', background: 'rgba(255,255,255,0.5)', borderRadius: '10px' }}>
          <h3>¿Tenés un equipo en reparación?</h3>
          <p>Consultá el estado de tu orden en tiempo real sin llamar.</p>
          <br />
          <Link to="/estado" className="btn">🔍 Consultar Estado</Link>
        </div>
      </header>

      {/* Sección Info Rápida */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <h3>📍 Ubicación</h3>
          <p>Calle Industrial 1234, Tu Ciudad.</p>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} id="contacto">
          <h3>📞 Contacto</h3>
          <p>Tel: (3462) 555-000</p>
          <p>Email: taller@ejemplo.com</p>
        </div>
      </section>
    </div>
  );
};

export default Home;