import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, PackageCheck, Clock, FileText, Timer, ArrowUpRight,
} from 'lucide-react';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import { supabase } from '../lib/supabase';
import { ETIQUETA_ESTADO, COLOR_ESTADO } from '../lib/reparaciones';

const Dashboard = () => {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    supabase.rpc('metricas_panel')
      .then(({ data, error: e }) => {
        if (!vigente) return;
        if (e) setError(e.message);
        else setDatos(data);
      });
    return () => { vigente = false; };
  }, []);

  const tarjetas = datos ? [
    {
      titulo: 'En el taller',
      valor: datos.reparaciones_abiertas,
      pista: datos.ingresos_mes === 1 ? '1 ingreso este mes' : `${datos.ingresos_mes} ingresos este mes`,
      color: 'var(--purple)',
      icono: Activity,
      a: '/sistema/reparaciones',
    },
    {
      titulo: 'Listas para retirar',
      valor: datos.listas_para_retirar,
      pista: datos.listas_para_retirar > 0 ? 'Avisar a los clientes' : 'Nada pendiente de aviso',
      color: 'var(--success)',
      icono: PackageCheck,
      a: '/sistema/reparaciones',
    },
    {
      titulo: 'Esperando repuesto',
      valor: datos.esperando_repuesto,
      pista: datos.esperando_repuesto > 0 ? 'Trabajo en pausa' : 'Sin bloqueos',
      color: 'var(--warning, #d97706)',
      icono: Clock,
      a: '/sistema/reparaciones',
    },
    {
      titulo: 'Fichas tecnicas',
      valor: datos.fichas,
      pista: `${datos.clientes} cliente${datos.clientes === 1 ? '' : 's'} registrado${datos.clientes === 1 ? '' : 's'}`,
      color: 'var(--accent)',
      icono: FileText,
      a: '/sistema/motores',
    },
  ] : [];

  const porEstado = Object.entries(datos?.por_estado ?? {});
  const maximo = Math.max(1, ...porEstado.map(([, n]) => n));

  return (
    <div style={{ display: 'grid', gap: '22px' }}>
      <header
        className="ui-card"
        style={{
          background: 'var(--gradient-soft)',
          borderColor: 'var(--accent-tint-strong)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '6px' }}>Centro de Operaciones</h2>
          <p style={{ margin: 0, color: 'var(--text-light)' }}>
            Vista general del estado operativo del taller.
          </p>
        </div>

        {datos?.dias_promedio != null && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '999px',
              background: 'var(--accent-tint-strong)',
              border: '1px solid var(--accent-tint-strong)',
              color: 'var(--purple-dark)',
              fontWeight: 600,
            }}
          >
            <Timer size={16} />
            {datos.dias_promedio} dias promedio por reparacion
          </div>
        )}
      </header>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {!datos && !error ? (
        <div className="ui-card" style={{ padding: '50px' }}>
          <Spinner label="Cargando metricas..." centered />
        </div>
      ) : datos && (
        <>
          <section className="grid-responsive" style={{ marginBottom: 0 }}>
            {tarjetas.map((t) => {
              const Icono = t.icono;
              return (
                <Link
                  key={t.titulo}
                  to={t.a}
                  className="ui-card ui-card--elevated"
                  style={{ borderTop: `4px solid ${t.color}`, textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-light)' }}>{t.titulo}</p>
                    <span style={{ width: '34px', height: '34px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'var(--accent-tint-strong)', color: 'var(--purple)' }}>
                      <Icono size={17} />
                    </span>
                  </div>
                  <p style={{ fontSize: '2rem', margin: 0, fontWeight: 800 }}>{t.valor}</p>
                  <small style={{ color: 'var(--text-light)' }}>{t.pista}</small>
                </Link>
              );
            })}
          </section>

          <section className="grid-responsive-2" style={{ alignItems: 'start' }}>
            <article className="ui-card">
              <h3 style={{ marginBottom: '8px' }}>Ordenes por estado</h3>
              <p style={{ marginTop: 0, marginBottom: '18px', color: 'var(--text-light)' }}>
                Donde esta parado el trabajo ahora mismo.
              </p>

              {porEstado.length === 0 ? (
                <p style={{ color: 'var(--text-light)', margin: 0 }}>
                  Todavia no hay ordenes cargadas.{' '}
                  <Link to="/sistema/reparaciones" style={{ color: 'var(--accent)' }}>Crear la primera</Link>.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {porEstado.map(([estado, cantidad]) => (
                    <div key={estado} style={{ display: 'grid', gap: '5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                        <span>{ETIQUETA_ESTADO[estado] ?? estado}</span>
                        <strong>{cantidad}</strong>
                      </div>
                      {/* Barra proporcional al estado mas cargado. Es una
                          lectura relativa, no absoluta: sirve para ver de
                          un vistazo donde se acumula el trabajo. */}
                      <div style={{ height: '9px', borderRadius: '999px', background: 'var(--surface-soft)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${(cantidad / maximo) * 100}%`,
                          height: '100%',
                          borderRadius: '999px',
                          background: COLOR_ESTADO[estado] ?? 'var(--purple)',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="ui-card">
              <h3 style={{ marginBottom: '8px' }}>Ultimas fichas</h3>
              <p style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-light)' }}>
                Lo mas reciente que se cargo.
              </p>

              {(datos.ultimas_fichas ?? []).length === 0 ? (
                <p style={{ color: 'var(--text-light)', margin: 0 }}>
                  Sin fichas todavia.{' '}
                  <Link to="/sistema/motores/nuevo" style={{ color: 'var(--accent)' }}>Cargar una</Link>.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {datos.ultimas_fichas.map((f) => (
                    <Link
                      key={f.id}
                      to={`/sistema/motores/ver/${f.nro_motor}`}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-soft)',
                        fontWeight: 500,
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <span>#{f.nro_motor} · {f.descripcion}</span>
                      <ArrowUpRight size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
                    </Link>
                  ))}
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </div>
  );
};

export default Dashboard;
