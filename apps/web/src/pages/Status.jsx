import React, { useState } from 'react';
import {
  Search, PackageCheck, CircleAlert, FileText, Truck, ChevronRight, Clock,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { consultarEstadoPublico, ETIQUETA_ESTADO } from '../lib/reparaciones';

/**
 * Consulta publica de estado.
 *
 * Va contra consultar_estado, que exige numero de orden Y apellido del
 * cliente. El numero solo es un correlativo: sin el segundo factor,
 * cualquiera podia recorrer las ordenes del taller escribiendo 1, 2, 3.
 *
 * Lo que se muestra es a proposito poco: el estado actual y los links a
 * los documentos que ya son publicos de por si. Ni el detalle tecnico,
 * ni el problema, ni las notas internas del taller.
 */

// El recorrido normal de una orden. El estado actual pinta este hito y
// todos los anteriores.
const HITOS = [
  { estado: 'ingresado', texto: 'Ingreso al taller' },
  { estado: 'en_proceso', texto: 'En reparacion' },
  { estado: 'terminado', texto: 'Listo para retirar' },
  { estado: 'entregado', texto: 'Entregado' },
];

const diaMes = (d) => (d
  ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
  : '');

const Status = () => {
  const [numero, setNumero] = useState('');
  const [apellido, setApellido] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [sinResultado, setSinResultado] = useState(false);
  const [error, setError] = useState('');

  const buscar = async (e) => {
    e.preventDefault();
    setError('');
    setResultado(null);
    setSinResultado(false);

    if (!numero.trim() || !apellido.trim()) return;

    setBuscando(true);
    try {
      const r = await consultarEstadoPublico(numero, apellido);
      if (r) setResultado(r);
      else setSinResultado(true);
    } catch {
      setError('No pudimos consultar el estado. Intenta de nuevo en un momento.');
    } finally {
      setBuscando(false);
    }
  };

  const indiceActual = resultado ? HITOS.findIndex((h) => h.estado === resultado.estado) : -1;
  const cancelada = resultado?.estado === 'cancelado';
  const esperando = resultado?.estado === 'esperando_repuesto';
  const completo = numero.trim() && apellido.trim();

  return (
    <div className="estado-caja">
      <div className="estado-intro">
        <h2>Estado de tu reparacion</h2>
        <p>Ingresa el numero de orden y el apellido con el que dejaste el equipo.</p>
      </div>

      <form onSubmit={buscar} className="estado-form">
        <div>
          <label className="campo-label" htmlFor="e-numero">N° de orden</label>
          <input id="e-numero" className="ui-input" type="text" inputMode="numeric"
            value={numero} onChange={(e) => setNumero(e.target.value)}
            placeholder="Ej: 12" autoComplete="off" />
        </div>
        <div>
          <label className="campo-label" htmlFor="e-apellido">Apellido</label>
          <input id="e-apellido" className="ui-input" type="text"
            value={apellido} onChange={(e) => setApellido(e.target.value)}
            placeholder="Como figura en el comprobante" autoComplete="family-name" />
        </div>
        <Button type="submit" variant="primary" size="lg" isLoading={buscando}
          disabled={!completo}>
          <Search size={16} /> Consultar
        </Button>
      </form>

      {error && (
        <div className="estado-tarjeta" style={{ textAlign: 'center' }}>
          <CircleAlert size={24} style={{ color: 'var(--danger)', marginBottom: '8px' }} />
          <div>{error}</div>
        </div>
      )}

      {sinResultado && (
        <div className="estado-tarjeta" style={{ textAlign: 'center' }}>
          <CircleAlert size={26} style={{ opacity: 0.5, marginBottom: '10px' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem' }}>No encontramos esa orden</h3>
          <p style={{ color: 'var(--text-light)', margin: 0, fontSize: '0.92rem' }}>
            Revisa el numero y el apellido de tu comprobante. Si el problema sigue,
            llamanos al <a href="tel:+543462553285">(3462) 55-3285</a>.
          </p>
        </div>
      )}

      {resultado && (
        <div className="estado-tarjeta">
          <div className="estado-tarjeta__cab">
            <span className={`estado-badge${cancelada ? ' estado-badge--cancelado' : ''}`}>
              {ETIQUETA_ESTADO[resultado.estado] ?? resultado.estado}
            </span>
            <h3 className="estado-orden">Orden #{resultado.numero}</h3>
          </div>

          {cancelada ? (
            <p style={{ color: 'var(--text-light)', margin: 0 }}>
              Esta orden fue cancelada. Comunicate con el taller si necesitas mas informacion.
            </p>
          ) : (
            <>
              {esperando && (
                <div className="estado-nota estado-nota--espera" style={{ marginTop: 0, marginBottom: '20px' }}>
                  <Clock size={19} />
                  <span>El trabajo esta en pausa esperando un repuesto.</span>
                </div>
              )}

              <div>
                {HITOS.map((h, i) => {
                  const hecho = i <= indiceActual;
                  const actual = i === indiceActual;
                  const ultimo = i === HITOS.length - 1;
                  const fecha = i === 0 ? resultado.ingreso : ultimo ? resultado.egreso : null;
                  return (
                    <div key={h.estado}
                      className={`hito${hecho ? ' hito--hecho' : ''}${actual ? ' hito--actual' : ''}`}>
                      <span className="hito__punto" />
                      <span className="hito__fecha">{diaMes(fecha)}</span>
                      <span className="hito__texto">{h.texto}</span>
                    </div>
                  );
                })}
              </div>

              {resultado.estado === 'terminado' && (
                <div className="estado-nota estado-nota--listo">
                  <PackageCheck size={20} />
                  <span>Tu motor esta listo. Podes pasar a retirarlo en el horario de atencion.</span>
                </div>
              )}

              {(resultado.presupuesto || resultado.remito) && (
                <div style={{ marginTop: '22px', display: 'grid', gap: '9px' }}>
                  {resultado.presupuesto && (
                    <a className="estado-doc" href={`/p/${resultado.presupuesto.token}`}
                      target="_blank" rel="noopener noreferrer">
                      <FileText size={19} />
                      <span>Ver presupuesto</span>
                      <ChevronRight size={17} className="estado-doc__flecha" />
                    </a>
                  )}
                  {resultado.remito && (
                    <a className="estado-doc" href={`/r/${resultado.remito.token}`}
                      target="_blank" rel="noopener noreferrer">
                      <Truck size={19} />
                      <span>Ver remito de entrega</span>
                      <ChevronRight size={17} className="estado-doc__flecha" />
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Status;
