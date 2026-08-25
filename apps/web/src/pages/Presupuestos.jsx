import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, FileText, X } from 'lucide-react';
import Modal from '../components/Modal';
import Alert from '../components/ui/Alert';
import Esqueleto from '../components/Esqueleto';
import MenuAcciones, { ItemMenu } from '../components/ui/MenuAcciones';
import {
  ESTADOS, ETIQUETA_ESTADO, COLOR_ESTADO,
  listarPresupuestos, eliminarPresupuesto, pesos, venceEl, estadoDe,
} from '../lib/presupuestos';

/**
 * Listado de presupuestos.
 *
 * El estado pasa de un <select> a una fila de chips: son cinco
 * opciones fijas y filtrar por "enviado" es un toque en vez de abrir
 * un desplegable, elegir y esperar que cierre.
 *
 * La tarjeta entera abre el presupuesto; eliminar --que borra los
 * renglones-- queda en el menu.
 */

const Presupuestos = () => {
  const [presupuestos, setPresupuestos] = useState([]);
  const [estado, setEstado] = useState('');
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aBorrar, setABorrar] = useState(null);

  const buscar = useCallback(async (e, t) => {
    setCargando(true);
    setError('');
    try {
      const r = await listarPresupuestos({ estado: e, texto: t });
      setPresupuestos(r.presupuestos);
    } catch (err) {
      setError(err.message ?? 'No pudimos cargar los presupuestos.');
    } finally {
      setCargando(false);
    }
  }, []);

  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; buscar(estado, texto); return undefined; }
    const t = setTimeout(() => buscar(estado, texto), 300);
    return () => clearTimeout(t);
  }, [estado, texto, buscar]);

  const numeroDe = (p) => `${String(p.punto_venta ?? 1).padStart(4, '0')}-${String(p.numero).padStart(8, '0')}`;

  return (
    <div>
      <div className="pantalla-header">
        <div>
          <h2 className="pantalla-titulo">Presupuestos</h2>
          <p className="pantalla-sub">Cotizaciones con PDF listo para enviar</p>
        </div>
        <Link to="/sistema/presupuestos/nuevo" className="btn btn-primary">
          <Plus size={16} /> Nuevo
        </Link>
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

      <div className="herramientas">
        <div className="buscador">
          <Search size={16} />
          <input value={texto} onChange={(e) => setTexto(e.target.value)}
            inputMode="numeric" aria-label="Buscar por numero de presupuesto"
            placeholder="Buscar por numero" />
          {texto && (
            <button type="button" className="buscador__limpiar" aria-label="Borrar la busqueda"
              onClick={() => setTexto('')}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="chips" role="group" aria-label="Filtrar por estado">
        <button type="button" onClick={() => setEstado('')}
          aria-pressed={estado === ''}
          className={`chip${estado === '' ? ' activo' : ''}`}>
          Todos
        </button>
        {ESTADOS.map((e) => (
          <button key={e} type="button" onClick={() => setEstado(e)}
            aria-pressed={estado === e}
            className={`chip${estado === e ? ' activo' : ''}`}>
            {ETIQUETA_ESTADO[e]}
          </button>
        ))}
      </div>

      {cargando ? (
        <div style={{ padding: '48px 0' }}>
          <Esqueleto tipo="lista" />
        </div>
      ) : presupuestos.length === 0 ? (
        <div className="vacio">
          <FileText size={26} />
          <div>
            {estado || texto
              ? 'Ningun presupuesto coincide con el filtro.'
              : 'Todavia no hay presupuestos.'}
          </div>
        </div>
      ) : (
        <ul className="lista">
          {presupuestos.map((p) => {
            const estadoVisible = estadoDe(p);
            const vence = venceEl(p);
            const cliente = p.cliente_nombre || p.cliente?.nombre;
            return (
              <li key={p.id} className="fila">
                <Link to={`/sistema/presupuestos/${p.id}`} className="fila-link">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                    <span className="fila-titulo">
                      {cliente || <span style={{ color: 'var(--text-light)' }}>Sin cliente</span>}
                    </span>
                    <span className="importe">{pesos(p.total)}</span>
                  </div>

                  <div className="fila-sub">
                    N° {numeroDe(p)}
                    {p.reparacion ? ` · orden ${p.reparacion.numero}` : ''}
                    {' · '}
                    {new Date(p.creado_en).toLocaleDateString('es-AR')}
                    {vence ? ` · vale hasta ${vence.toLocaleDateString('es-AR')}` : ''}
                  </div>

                  <div className="fila-etiquetas">
                    <span className="etiqueta" style={{ color: COLOR_ESTADO[estadoVisible], borderColor: 'currentColor' }}>
                      {ETIQUETA_ESTADO[estadoVisible]}
                    </span>
                  </div>
                </Link>

                <div className="fila-acciones">
                  <MenuAcciones etiqueta={`Acciones del presupuesto ${numeroDe(p)}`}>
                    <ItemMenu onClick={() => setABorrar(p)} icono={Trash2} peligro>
                      Eliminar
                    </ItemMenu>
                  </MenuAcciones>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {presupuestos.length > 0 && (
        <div className="contador">
          {presupuestos.length} {presupuestos.length === 1 ? 'presupuesto' : 'presupuestos'}
        </div>
      )}

      <Modal
        isOpen={Boolean(aBorrar)}
        type="danger"
        title="Eliminar presupuesto"
        message={`Se elimina el presupuesto N° ${aBorrar ? numeroDe(aBorrar) : ''} con todos sus renglones.`}
        onClose={() => setABorrar(null)}
        onConfirm={async () => {
          try {
            await eliminarPresupuesto(aBorrar.id);
            await buscar(estado, texto);
          } catch (e) { setError(e.message); }
          setABorrar(null);
        }}
      />
    </div>
  );
};

export default Presupuestos;
