import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import Alert from '../components/ui/Alert';
import Esqueleto from '../components/Esqueleto';
import { pesos } from '../lib/presupuestos';
import {
  listarFacturas, ETIQUETA_ESTADO_FACTURA, COLOR_ESTADO_FACTURA, letraFactura,
} from '../lib/facturas';

const ESTADOS = ['pendiente', 'autorizada', 'rechazada', 'anulada'];

const numeroDe = (f) => (f.numero
  ? `${String(f.punto_venta ?? 1).padStart(4, '0')}-${String(f.numero).padStart(8, '0')}`
  : 'sin numero');

const Facturas = () => {
  const [facturas, setFacturas] = useState([]);
  const [estado, setEstado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const buscar = useCallback(async (e) => {
    setCargando(true);
    setError('');
    try {
      const r = await listarFacturas({ estado: e });
      setFacturas(r.facturas);
    } catch (err) {
      setError(err.message ?? 'No pudimos cargar las facturas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { buscar(estado); }, [estado, buscar]);

  return (
    <div>
      <div className="pantalla-header">
        <div>
          <h2 className="pantalla-titulo">Facturas</h2>
          <p className="pantalla-sub">Comprobantes autorizados por ARCA</p>
        </div>
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

      <div className="chips" role="group" aria-label="Filtrar por estado">
        <button type="button" onClick={() => setEstado('')}
          aria-pressed={estado === ''} className={`chip${estado === '' ? ' activo' : ''}`}>
          Todas
        </button>
        {ESTADOS.map((e) => (
          <button key={e} type="button" onClick={() => setEstado(e)}
            aria-pressed={estado === e} className={`chip${estado === e ? ' activo' : ''}`}>
            {ETIQUETA_ESTADO_FACTURA[e]}
          </button>
        ))}
      </div>

      {cargando ? (
        <Esqueleto tipo="lista" />
      ) : facturas.length === 0 ? (
        <div className="vacio">
          <Receipt size={26} />
          <div>{estado ? 'Ninguna factura coincide con el filtro.' : 'Todavia no hay facturas emitidas.'}</div>
        </div>
      ) : (
        <ul className="lista">
          {facturas.map((f) => (
            <li key={f.id} className="fila">
              <Link
                to={f.reparacion_id ? `/sistema/reparaciones/${f.reparacion_id}` : '#'}
                className="fila-link"
                style={!f.reparacion_id ? { cursor: 'default', pointerEvents: 'none' } : undefined}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                  <span className="fila-titulo">
                    {f.cliente?.nombre ?? f.cliente_nombre ?? 'Consumidor final'}
                  </span>
                  <span className="importe">{pesos(f.total)}</span>
                </div>

                <div className="fila-sub">
                  Factura {letraFactura(f.cbte_tipo)} {numeroDe(f)}
                  {' · '}
                  {new Date(f.creado_en).toLocaleDateString('es-AR')}
                  {f.cae ? ` · CAE ${f.cae}` : ''}
                </div>

                <div className="fila-etiquetas">
                  <span className="etiqueta" style={{ color: COLOR_ESTADO_FACTURA[f.estado], borderColor: 'currentColor' }}>
                    {ETIQUETA_ESTADO_FACTURA[f.estado]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {facturas.length > 0 && (
        <div className="contador">
          {facturas.length} {facturas.length === 1 ? 'factura' : 'facturas'}
        </div>
      )}
    </div>
  );
};

export default Facturas;
