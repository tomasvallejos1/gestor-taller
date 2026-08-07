import React from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  Cog,
  Droplets,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Clock3,
  Sparkles
} from 'lucide-react';

const services = [
  {
    icon: <Wrench size={24} />,
    title: 'Bobinados industriales',
    description: 'Rebobinado monofasico y trifasico con materiales clase H para mayor vida util.'
  },
  {
    icon: <Cog size={24} />,
    title: 'Mecanica de precision',
    description: 'Balanceo, alineacion, rodamientos y recuperacion de ejes para operacion estable.'
  },
  {
    icon: <Droplets size={24} />,
    title: 'Bombas y sistemas hidraulicos',
    description: 'Servicio integral para bombas centrifugas, sumergibles y de vacio.'
  }
];

const Home = () => {
  return (
    <div>
      <section
        className="bg-hero"
        style={{
          minHeight: '86vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 20px',
          color: 'white'
        }}
      >
        <div className="fade-in" style={{ maxWidth: '860px' }}>
          <span
            style={{
              display: 'inline-flex',
              gap: '8px',
              alignItems: 'center',
              padding: '8px 14px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'var(--accent-tint-strong)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontSize: '0.8rem',
              fontWeight: '700'
            }}
          >
            <Sparkles size={14} />
            Taller Electromecanico Profesional
          </span>

          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.4rem)', marginTop: '18px', lineHeight: '1.05' }}>
            Potenciamos tus motores
            <br />
            <span className="text-gradient">con diagnostico preciso y respuesta rapida</span>
          </h1>

          <p
            style={{
              fontSize: '1.16rem',
              color: '#dbe0ff',
              margin: '22px auto 34px',
              lineHeight: '1.65',
              maxWidth: '710px'
            }}
          >
            Centraliza el seguimiento de reparaciones, reduce tiempos de parada y obten visibilidad en
            cada etapa del servicio.
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/estado"
              className="btn btn-primary"
              style={{ padding: '14px 30px', fontSize: '1rem', minWidth: '220px' }}
            >
              Consultar estado de equipo
            </Link>
            <a
              href="#contacto"
              className="btn"
              style={{
                padding: '14px 30px',
                fontSize: '1rem',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.08)',
                color: '#ffffff',
                minWidth: '220px'
              }}
            >
              Hablar con un tecnico
            </a>
          </div>
        </div>
      </section>

      <section style={{ padding: '84px 20px 72px', background: 'var(--bg-muted)' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '46px' }}>
            <h2 style={{ fontSize: '2.2rem', marginBottom: '10px' }}>Servicios que priorizan continuidad operativa</h2>
            <p style={{ color: 'var(--text-light)', maxWidth: '670px', margin: '0 auto' }}>
              Organizamos cada orden con trazabilidad real para que sepas que se hizo, cuando y con que resultado.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {services.map((service) => (
              <article key={service.title} className="service-card">
                <div className="icon-box" aria-hidden="true">
                  {service.icon}
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>{service.title}</h3>
                <p style={{ margin: 0, color: 'var(--text-light)', lineHeight: '1.6' }}>{service.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '70px 20px', background: '#0b0b12', color: '#fff' }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ color: '#fff', marginBottom: '12px', fontSize: '2rem' }}>Resultados que sostienen tu produccion</h2>
          <p style={{ color: '#c6cbef', marginBottom: '34px' }}>
            Combinamos experiencia tecnica y gestion digital para acelerar decisiones.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
            <div className="ui-card" style={{ background: 'var(--accent-tint-strong)', borderColor: 'var(--accent-border)' }}>
              <h3 style={{ color: 'var(--purple-light)', fontSize: '2rem' }}>+20</h3>
              <p style={{ margin: 0, color: '#dbe0ff' }}>anos en el rubro</p>
            </div>
            <div className="ui-card" style={{ background: 'var(--accent-tint-strong)', borderColor: 'var(--accent-border)' }}>
              <h3 style={{ color: 'var(--purple-light)', fontSize: '2rem' }}>24h</h3>
              <p style={{ margin: 0, color: '#dbe0ff' }}>prioridad urgencias</p>
            </div>
            <div className="ui-card" style={{ background: 'var(--accent-tint-strong)', borderColor: 'var(--accent-border)' }}>
              <h3 style={{ color: 'var(--purple-light)', fontSize: '2rem' }}>100%</h3>
              <p style={{ margin: 0, color: '#dbe0ff' }}>garantia escrita</p>
            </div>
          </div>
        </div>
      </section>

      <footer id="contacto" style={{ background: 'var(--primary-soft)', color: '#d8dcf8', padding: '62px 20px' }}>
        <div
          style={{
            maxWidth: '1240px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '28px'
          }}
        >
          <div>
            <h3 style={{ color: '#fff', marginBottom: '16px', fontSize: '1.1rem' }}>Contacto directo</h3>
            <p style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}>
              <MapPin size={17} /> 26 de Abril 97, Venado Tuerto, Santa Fe
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Phone size={17} /> (3462) 55-3285
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Mail size={17} /> jdavid39val@yahoo.com.ar
            </p>
          </div>

          <div
            style={{
              width: '100%',
              minHeight: '220px',
              borderRadius: '14px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
          >
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3317.046866290049!2d-61.97949458781704!3d-33.75945477315719!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95c87b6d0c5e5493%3A0xc38d65b99601d57c!2sBobinados%20David!5e0!3m2!1ses-419!2sar!4v1764563836454!5m2!1ses-419!2sar"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicacion del Taller"
            />
          </div>

          <div>
            <h3 style={{ color: '#fff', marginBottom: '16px', fontSize: '1.1rem' }}>Horario de atencion</h3>
            <div style={{ display: 'grid', gap: '14px' }}>
              <div className="ui-card" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}>
                <p style={{ margin: 0, color: '#bac0e9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock3 size={16} /> Lunes a Viernes
                </p>
                <strong style={{ color: '#fff', letterSpacing: '0.03em' }}>17:00 - 20:00</strong>
              </div>

              <div className="ui-card" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}>
                <p style={{ margin: 0, color: '#bac0e9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} /> Guardia de fin de semana
                </p>
                <strong style={{ color: '#fff', letterSpacing: '0.03em' }}>09:00 - 18:00</strong>
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '34px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <small style={{ color: '#97a0d0' }}>© {new Date().getFullYear()} Bobinados David. Gestion moderna para servicios tecnicos.</small>
        </div>
      </footer>
    </div>
  );
};

export default Home;
