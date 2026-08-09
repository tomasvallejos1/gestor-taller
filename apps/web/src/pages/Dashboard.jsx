import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, PackageCheck, Clock, FileText, ArrowUpRight,
} from 'lucide-react';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import AccesosDirectos from '../components/AccesosDirectos';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ETIQUETA_ESTADO, COLOR_ESTADO } from '../lib/reparaciones';

/**
 * Panel.
 *
 * Se saco el encabezado "Centro de Operaciones": ocupaba la primera
 * pantalla entera del celular para decir el nombre de la pantalla en la
 * que uno ya esta. Lo primero que se ve ahora son los atajos y los
 * numeros, que es a lo que se entra.
 *
 * Las tarjetas van en dos columnas incluso en el telefono. Una sola
 * columna dejaba los cuatro numeros repartidos en dos pantallas, y el
 * sentido de esto es verlos de un vistazo.
 */

const saludo = () => {
  const h = new Date().getHours();
  if (h < 13) return 'Buen día';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

const Dashboard = () => {
  const { perfil } = useAuth();
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
      color: 'var(--accent)',
      icono: Activity,
      a: '/sistema/reparaciones',
    },
    {
      titulo: 'Para retirar',
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
      color: 'var(--warning)',
      icono: Clock,
      a: '/sistema/reparaciones',
    },
    {
      titulo: 'Fichas técnicas',
      valor: datos.fichas,
      pista: `${datos.clientes} cliente${datos.clientes === 1 ? '' : 's'}`,
      color: 'var(--text-light)',
      icono: FileText,
      a: '/sistema/motores',
    },
  ] : [];

  const porEstado = Object.entries(datos?.por_estado ?? {});
  const maximo = Math.max(1, ...porEstado.map(([, n]) => n));

  return (
    <div className="panel">
      <div className="panel__saludo">
        <h2>{saludo()}{perfil?.nombre ? `, ${perfil.nombre.split(' ')[0]}` : ''}</h2>
        {datos?.dias_promedio != null && (
          <p>{datos.dias_promedio} días promedio por reparación</p>
        )}
      </div>

      <AccesosDirectos />

      {error ? <Alert variant="error">{error}</Alert> : null}

      {!datos && !error ? (
        <div className="ui-card" style={{ padding: '50px' }}>
          <Spinner label="Cargando métricas..." centered />
        </div>
      ) : datos && (
        <>
          <section className="panel__numeros">
            {tarjetas.map((t) => {
              const Icono = t.icono;
              return (
                <Link key={t.titulo} to={t.a} className="numero"
                  style={{ borderTopColor: t.color }}>
                  <div className="numero__cab">
                    <span className="numero__titulo">{t.titulo}</span>
                    <Icono size={15} style={{ color: t.color, flexShrink: 0 }} />
                  </div>
                  <span className="numero__valor">{t.valor}</span>
                  <span className="numero__pista">{t.pista}</span>
                </Link>
              );
            })}
          </section>

          <section className="panel__dos">
            <article className="ui-card">
              <h3 style={{ marginTop: 0, marginBottom: '4px', fontSize: '1.05rem' }}>Órdenes por estado</h3>
              <p style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-light)', fontSize: '0.88rem' }}>
                Dónde está parado el trabajo ahora mismo.
              </p>

              {porEstado.length === 0 ? (
                <p style={{ color: 'var(--text-light)', margin: 0, fontSize: '0.9rem' }}>
                  Todavía no hay órdenes cargadas.{' '}
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
                          background: COLOR_ESTADO[estado] ?? 'var(--accent)',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="ui-card">
              <h3 style={{ marginTop: 0, marginBottom: '4px', fontSize: '1.05rem' }}>Últimas fichas</h3>
              <p style={{ marginTop: 0, marginBottom: '14px', color: 'var(--text-light)', fontSize: '0.88rem' }}>
                Lo más reciente que se cargó.
              </p>

              {(datos.ultimas_fichas ?? []).length === 0 ? (
                <p style={{ color: 'var(--text-light)', margin: 0, fontSize: '0.9rem' }}>
                  Sin fichas todavía.{' '}
                  <Link to="/sistema/motores/nuevo" style={{ color: 'var(--accent)' }}>Cargar una</Link>.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {datos.ultimas_fichas.map((f) => (
                    <Link key={f.id} to={`/sistema/motores/ver/${f.nro_motor}`} className="ficha-reciente">
                      <span className="ficha-reciente__n">#{f.nro_motor}</span>
                      <span className="ficha-reciente__desc">{f.descripcion}</span>
                      <ArrowUpRight size={15} style={{ flexShrink: 0, opacity: 0.55 }} />
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
