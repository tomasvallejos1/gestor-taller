import React, { useState } from 'react';
import { Search, PackageCheck, CircleAlert, FileText, Truck } from 'lucide-react';
import { consultarEstadoPublico, ETIQUETA_ESTADO } from '../lib/reparaciones';

/**
 * Consulta publica de estado.
 *
 * Va contra la funcion consultar_estado, que ahora exige numero de
 * orden Y apellido del cliente. El numero solo es un correlativo: sin
 * el segundo factor, cualquiera podia recorrer las ordenes del taller
 * escribiendo 1, 2, 3.
 *
 * Lo que se devuelve es deliberadamente pobre: el estado actual (sin
 * detalles ni observaciones, tal como se pidio) y los links a los
 * documentos publicos que ya existan. Nada del cliente, nada del
 * detalle tecnico, ninguna nota interna.
 */

// El recorrido normal de una orden. El estado actual pinta este hito y
// todos los anteriores.
const HITOS = [
  { estado: 'ingresado', texto: 'Ingreso al taller' },
  { estado: 'en_proceso', texto: 'En reparacion' },
  { estado: 'terminado', texto: 'Listo para retirar' },
  { estado: 'entregado', texto: 'Entregado' },
];

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

  const inputStyle = {
    border: 'none', background: 'transparent', fontSize: '1rem', padding: '12px',
    flex: 1, outline: 'none', color: 'inherit', minWidth: 0,
  };

  return (
    <div style={{ minHeight: '80vh', background: 'var(--bg-app, #f8fafc)', padding: '60px 20px' }}>
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Estado de tu reparacion</h2>
          <p style={{ color: 'var(--text-light, #64748b)', margin: 0 }}>
            Ingresa el numero de orden y el apellido con el que se registro el equipo.
          </p>
        </div>

        <form onSubmit={buscar} style={{ display: 'grid', gap: '10px', background: 'var(--surface, white)', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              inputMode="numeric"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="N° de orden (ej: 12)"
              aria-label="Numero de orden"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border, #e2e8f0)', paddingTop: '10px' }}>
            <input
              type="text"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Apellido del cliente"
              aria-label="Apellido"
              style={inputStyle}
            />
            <button type="submit" className="btn btn-primary" disabled={buscando}
              style={{ borderRadius: '8px', padding: '12px 22px', minHeight: '44px', whiteSpace: 'nowrap' }}>
              <Search size={16} />
              {buscando ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </form>

        {error && (
          <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger, #b91c1c)' }}>
            {error}
          </div>
        )}

        {sinResultado && (
          <div style={{ marginTop: '24px', background: 'var(--surface, white)', padding: '28px', borderRadius: '16px', border: '1px solid var(--border, #e2e8f0)', textAlign: 'center' }}>
            <CircleAlert size={26} style={{ opacity: 0.6, marginBottom: '10px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem' }}>No encontramos esa orden</h3>
            <p style={{ color: 'var(--text-light, #64748b)', margin: 0, fontSize: '0.92rem' }}>
              Revisa el numero de tu comprobante y el apellido. Si el problema sigue, llamanos
              al (3462) 55-3285.
            </p>
          </div>
        )}

        {resultado && (
          <div style={{ marginTop: '24px', background: 'var(--surface, white)', padding: '28px', borderRadius: '16px', border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
            <div style={{ borderBottom: '1px solid var(--border, #f1f5f9)', paddingBottom: '15px', marginBottom: '20px' }}>
              <span style={{
                padding: '5px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700,
                background: cancelada ? 'rgba(239,68,68,0.12)' : 'rgba(2,132,199,0.12)',
                color: cancelada ? 'var(--danger, #b91c1c)' : 'var(--accent, #1e40af)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {ETIQUETA_ESTADO[resultado.estado] ?? resultado.estado}
              </span>
              <h3 style={{ marginTop: '12px', marginBottom: '4px', fontSize: '1.2rem' }}>
                Orden #{resultado.numero}
              </h3>
            </div>

            {cancelada ? (
              <p style={{ color: 'var(--text-light, #64748b)', margin: 0 }}>
                Esta orden fue cancelada. Comunicate con el taller si necesitas mas informacion.
              </p>
            ) : (
              <>
                {esperando && (
                  <div style={{ marginBottom: '18px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(217,119,6,0.1)', fontSize: '0.9rem' }}>
                    El trabajo esta en pausa esperando un repuesto.
                  </div>
                )}

                <div>
                  {HITOS.map((h, i) => {
                    const alcanzado = i <= indiceActual;
                    const actual = i === indiceActual;
                    const ultimo = i === HITOS.length - 1;
                    return (
                      <div key={h.estado} style={{
                        display: 'flex', gap: '15px', paddingLeft: '20px', paddingBottom: ultimo ? 0 : '20px',
                        borderLeft: ultimo ? '2px solid transparent' : `2px solid ${alcanzado ? 'var(--accent, #38bdf8)' : 'var(--border, #e2e8f0)'}`,
                        position: 'relative',
                      }}>
                        <div style={{
                          position: 'absolute', left: '-6px', top: 0, width: '10px', height: '10px',
                          borderRadius: '50%',
                          background: alcanzado ? 'var(--accent, #0284c7)' : 'var(--border, #cbd5e1)',
                        }} />
                        <div style={{ fontSize: '0.88rem', minWidth: '76px', color: 'var(--text-light, #94a3b8)', fontWeight: actual ? 700 : 400 }}>
                          {i === 0 && resultado.ingreso
                            ? new Date(resultado.ingreso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                            : ultimo && resultado.egreso
                              ? new Date(resultado.egreso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                              : ''}
                        </div>
                        <div style={{
                          color: actual ? 'var(--accent, #0284c7)' : alcanzado ? 'inherit' : 'var(--text-light, #94a3b8)',
                          fontWeight: actual ? 700 : 400,
                        }}>
                          {h.texto}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {resultado.estado === 'terminado' && (
                  <div style={{ marginTop: '20px', padding: '14px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <PackageCheck size={20} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.92rem' }}>
                      Tu motor esta listo. Podes pasar a retirarlo en el horario de atencion.
                    </span>
                  </div>
                )}

                {(resultado.presupuesto || resultado.remito) && (
                  <div style={{ marginTop: '20px', display: 'grid', gap: '8px' }}>
                    {resultado.presupuesto && (
                      <a href={`/p/${resultado.presupuesto.token}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border, #e2e8f0)', textDecoration: 'none', color: 'inherit' }}>
                        <FileText size={18} style={{ color: 'var(--accent, #0284c7)' }} />
                        <span>Ver presupuesto {resultado.presupuesto.comprobante}</span>
                      </a>
                    )}
                    {resultado.remito && (
                      <a href={`/r/${resultado.remito.token}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border, #e2e8f0)', textDecoration: 'none', color: 'inherit' }}>
                        <Truck size={18} style={{ color: 'var(--accent, #0284c7)' }} />
                        <span>Ver remito {resultado.remito.comprobante}</span>
                      </a>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Status;
