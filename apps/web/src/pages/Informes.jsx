import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowLeft } from 'lucide-react';
import Alert from '../components/ui/Alert';
import Esqueleto from '../components/Esqueleto';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { pesos } from '../lib/presupuestos';
import { ETIQUETA_ESTADO, COLOR_ESTADO } from '../lib/reparaciones';

/**
 * Informes.
 *
 * Los numeros que estaban en el panel y que nadie mira a la mañana con
 * el motor adelante: cuanto tarda una reparacion, donde se acumula el
 * trabajo, como viene el mes. Son numeros de mirar sentado y cada tanto,
 * y ese es exactamente el motivo por el que salieron del panel: ocupaban
 * las dos primeras pantallas del telefono todos los dias.
 *
 * No es una pantalla de graficos: es la misma media docena de datos que
 * el sistema ya calculaba, puestos donde se buscan cuando se buscan.
 */

const Informes = () => {
  const { esEditor } = useAuth();
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

  const porEstado = Object.entries(datos?.por_estado ?? {});
  const maximo = Math.max(1, ...porEstado.map(([, n]) => n));

  // Lo cobrado solo lo ve un editor: un lector no ve precios en ningun
  // lado, y el panel no puede ser la excepcion.
  const numeros = datos ? [
    { titulo: 'Ingresaron este mes', valor: datos.ingresos_mes, pista: 'motores recibidos' },
    { titulo: 'Se entregaron', valor: datos.entregas_mes, pista: 'en el mes en curso' },
    {
      titulo: 'Demora promedio',
      valor: datos.dias_promedio ?? '—',
      pista: datos.dias_promedio ? 'días entre ingreso y entrega' : 'sin entregas todavía',
    },
    ...(esEditor ? [{
      titulo: 'Cobrado este mes',
      valor: pesos(datos.cobrado_mes),
      pista: 'incluye recargos de tarjeta',
      ancho: true,
    }] : []),
  ] : [];

  return (
    <div>
      <div className="pantalla-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <Link to="/sistema/home" className="icono-btn" aria-label="Volver al panel">
            <ArrowLeft size={18} />
          </Link>
          <div style={{ minWidth: 0 }}>
            <h2 className="pantalla-titulo">Informes</h2>
            <p className="pantalla-sub">Cómo viene el taller, más allá de hoy</p>
          </div>
        </div>
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

      {!datos && !error ? (
        <Esqueleto tipo="pagina" />
      ) : datos && (
        <>
          <section className="informe__numeros">
            {numeros.map((n) => (
              <article key={n.titulo} className={`informe__numero${n.ancho ? ' informe__numero--ancho' : ''}`}>
                <span className="informe__titulo">{n.titulo}</span>
                <span className="informe__valor">{n.valor}</span>
                <span className="informe__pista">{n.pista}</span>
              </article>
            ))}
          </section>

          <div className="seccion">
            <div className="seccion__cab">
              <div>
                <h3 className="seccion__titulo">Órdenes por estado</h3>
                <p className="seccion__ayuda">Dónde está parado el trabajo ahora mismo.</p>
              </div>
            </div>

            {porEstado.length === 0 ? (
              <p style={{ color: 'var(--text-light)', margin: 0 }}>
                Todavía no hay órdenes cargadas.{' '}
                <Link to="/sistema/reparaciones" style={{ color: 'var(--accent)' }}>Crear la primera</Link>.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '4px' }}>
                {/* Cada renglon abre su propia lista. Ver donde se
                    acumula el trabajo y no poder ir ahi obligaba a
                    cruzar la pantalla hasta el filtro y repetir a mano
                    el estado que uno acababa de senalar con el dedo. */}
                {porEstado.map(([estado, cantidad]) => (
                  <Link key={estado} to={`/sistema/reparaciones?estado=${estado}`} className="barra-estado">
                    <div className="barra-estado__fila">
                      <span>{ETIQUETA_ESTADO[estado] ?? estado}</span>
                      <strong>{cantidad}</strong>
                    </div>
                    {/* Barra proporcional al estado mas cargado: es una
                        lectura relativa, para ver de un vistazo donde se
                        junta el trabajo. */}
                    <div className="barra-estado__riel">
                      <div style={{
                        width: `${(cantidad / maximo) * 100}%`,
                        height: '100%',
                        borderRadius: '999px',
                        background: COLOR_ESTADO[estado] ?? 'var(--accent)',
                      }} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="seccion">
            <div className="seccion__cab">
              <div>
                <h3 className="seccion__titulo">Últimas fichas</h3>
                <p className="seccion__ayuda">Lo más reciente que se cargó.</p>
              </div>
            </div>

            {(datos.ultimas_fichas ?? []).length === 0 ? (
              <p style={{ color: 'var(--text-light)', margin: 0 }}>
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
          </div>
        </>
      )}
    </div>
  );
};

export default Informes;
