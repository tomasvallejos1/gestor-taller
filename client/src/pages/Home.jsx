import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      
      {/* 1. HERO SECTION (PORTADA IMPONENTE) */}
      <section className="bg-hero" style={{ height: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 20px', color: 'white' }}>
        <div className="fade-in" style={{ maxWidth: '800px' }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.9rem', fontWeight: '600', color: '#38bdf8', display: 'block', marginBottom: '15px' }}>
            Soluciones Electromecánicas
          </span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', margin: 0, fontWeight: '800', lineHeight: '1.1' }}>
            Expertos en <br />
            <span className="text-gradient">Bobinados y Motores</span>
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#cbd5e1', margin: '20px 0 40px 0', lineHeight: '1.6' }}>
            Reparación integral, mantenimiento preventivo y venta de repuestos. 
            Devolvemos la potencia a tu industria con garantía de calidad.
          </p>
          
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/estado" className="btn btn-primary" style={{ padding: '15px 30px', fontSize: '1.1rem', borderRadius: '50px', background: '#0284c7', border: 'none' }}>
              🔍 Consultar Estado
            </Link>
            <a href="#contacto" className="btn" style={{ padding: '15px 30px', fontSize: '1.1rem', borderRadius: '50px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(5px)' }}>
              Contactar Ahora
            </a>
          </div>
        </div>
      </section>

      {/* 2. SECCIÓN DE SERVICIOS */}
      <section style={{ padding: '80px 20px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <h2 style={{ fontSize: '2.5rem', color: '#0f172a', marginBottom: '10px' }}>Nuestros Servicios</h2>
            <p style={{ color: '#64748b' }}>Soluciones técnicas especializadas para cada necesidad.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
            
            <div className="service-card">
              <div className="icon-box">⚡</div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '10px' }}>Bobinados</h3>
              <p style={{ color: '#64748b', lineHeight: '1.5' }}>
                Rebobinado de motores monofásicos y trifásicos con materiales de clase térmica superior.
              </p>
            </div>

            <div className="service-card">
              <div className="icon-box">🛠️</div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '10px' }}>Reparación Mecánica</h3>
              <p style={{ color: '#64748b', lineHeight: '1.5' }}>
                Cambio de rodamientos, balanceo dinámico, encasquillado de tapas y ejes.
              </p>
            </div>

            <div className="service-card">
              <div className="icon-box">💧</div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '10px' }}>Bombas de Agua</h3>
              <p style={{ color: '#64748b', lineHeight: '1.5' }}>
                Reparación de bombas centrífugas, sumergibles y de vacío. Sellos mecánicos.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 3. SECCIÓN DE CONFIANZA */}
      <section style={{ padding: '60px 20px', background: '#0f172a', color: 'white', textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ color: 'white', marginBottom: '20px' }}>¿Por qué elegirnos?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginTop: '40px' }}>
            <div>
              <h3 style={{ color: '#38bdf8', fontSize: '2.5rem', marginBottom: '5px' }}>+20</h3>
              <p style={{ color: '#94a3b8' }}>Años de experiencia</p>
            </div>
            <div>
              <h3 style={{ color: '#38bdf8', fontSize: '2.5rem', marginBottom: '5px' }}>24h</h3>
              <p style={{ color: '#94a3b8' }}>Atención Urgencias</p>
            </div>
            <div>
              <h3 style={{ color: '#38bdf8', fontSize: '2.5rem', marginBottom: '5px' }}>100%</h3>
              <p style={{ color: '#94a3b8' }}>Garantía escrita</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FOOTER REDISEÑADO (3 Columnas: Info - Mapa - Horarios) */}
      <footer id="contacto" style={{ background: '#1e293b', padding: '60px 20px', color: '#cbd5e1' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px', alignItems: 'start' }}>
          
          {/* COLUMNA 1: CONTACTO (Izquierda) */}
          <div>
            <h3 style={{ color: 'white', marginBottom: '20px', fontSize: '1.2rem', textTransform: 'uppercase' }}>Contacto y Ubicación</h3>
            <p style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>📍</span> 
              Calle Falsa 123, Ciudad
            </p>
            <p style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>📞</span> 
              (3462) 555-000
            </p>
            <p style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>✉️</span> 
              info@bobinadosdavid.com
            </p>
          </div>

          {/* COLUMNA 2: MAPA (Centro) */}
          <div style={{ width: '100%', height: '220px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #475569', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3317.046866290049!2d-61.97949458781704!3d-33.75945477315719!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95c87b6d0c5e5493%3A0xc38d65b99601d57c!2sBobinados%20David!5e0!3m2!1ses-419!2sar!4v1764563836454!5m2!1ses-419!2sar"  
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              allowFullScreen="" 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación del Taller"
            ></iframe>
          </div>

          {/* COLUMNA 3: HORARIOS (Derecha) */}
          <div>
            <h3 style={{ color: 'white', marginBottom: '20px', fontSize: '1.2rem', textTransform: 'uppercase' }}>Horarios de Atención</h3>
            
            <div style={{ marginBottom: '20px', borderLeft: '3px solid #38bdf8', paddingLeft: '15px' }}>
              <p style={{ marginBottom: '5px', fontSize: '0.9rem', color: '#94a3b8' }}>Lunes a Viernes</p>
              <p style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem', letterSpacing: '1px' }}>17:00 - 20:00</p>
            </div>

            <div style={{ borderLeft: '3px solid #38bdf8', paddingLeft: '15px' }}>
              <p style={{ marginBottom: '5px', fontSize: '0.9rem', color: '#94a3b8' }}>Sábados y Domingos</p>
              <p style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem', letterSpacing: '1px' }}>09:00 - 18:00</p>
            </div>
          </div>

        </div>
        
        <div style={{ textAlign: 'center', marginTop: '60px', borderTop: '1px solid #334155', paddingTop: '20px', fontSize: '0.85rem', color: '#64748b' }}>
          © {new Date().getFullYear()} Bobinados David. Todos los derechos reservados.
        </div>
      </footer>

    </div>
  );
};

export default Home;