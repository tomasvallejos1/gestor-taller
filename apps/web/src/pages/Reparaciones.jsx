import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Trash2, X, Wrench, Pencil, ArrowRight, Check,
} from 'lucide-react';
import Modal from '../components/Modal';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import MenuAcciones, { ItemMenu } from '../components/ui/MenuAcciones';
import { useAuth } from '../context/AuthContext';
import {
  ESTADOS, ETIQUETA_ESTADO, COLOR_ESTADO, SIGUIENTE_ESTADO,
  listarReparaciones, guardarReparacion, cambiarEstado, eliminarReparacion,
} from '../lib/reparaciones';
import { listarClientes } from '../lib/clientes';
import { listarMotores } from '../lib/motores';

/**
 * Listado de ordenes de reparacion.
 *
 * Mismo criterio que Motores y Presupuestos: la tarjeta entera abre la
 * orden --que es lo que se hace todo el dia-- y lo ocasional queda en
 * el menu de la esquina. Antes el unico blanco tactil era el texto
 * "Orden #3", de 74x24 px: para abrir una orden con el celular en el
 * taller habia que apuntar.
 *
 * El filtro de estado pasa de un <select> a chips porque son seis
 * opciones fijas y filtrar es un toque en vez de abrir, elegir y
 * esperar que cierre.
 */

const hoy = () => new Date().toISOString().slice(0, 10);
const VACIA = {
  id: null, motor_id: '', cliente_id: '', estado: 'ingresado', ingreso: hoy(), egreso: '',
  problema: '', diagnostico: '', notas: '',
};

const Reparaciones = () => {
  const { esEditor } = useAuth();

  const [reparaciones, setReparaciones] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [soloAbiertas, setSoloAbiertas] = useState(true);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);

  const [clientes, setClientes] = useState([]);
  const [motores, setMotores] = useState([]);

  const buscar = useCallback(async (estado, abiertas, t) => {
    setCargando(true);
    setError('');
    try {
      const r = await listarReparaciones({ estado, soloAbiertas: abiertas, texto: t });
      setReparaciones(r.reparaciones);
    } catch (e) {
      setError(e.message ?? 'No pudimos cargar las reparaciones.');
    } finally {
      setCargando(false);
    }
  }, []);

  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      buscar(filtroEstado, soloAbiertas, texto);
      return undefined;
    }
    const t = setTimeout(() => buscar(filtroEstado, soloAbiertas, texto), 300);
    return () => clearTimeout(t);
  }, [filtroEstado, soloAbiertas, texto, buscar]);

  // Se cargan solo al abrir el formulario, no al entrar a la pantalla.
  const abrirFormulario = async (base) => {
    setEditando(base);
    setError('');
    if (!clientes.length) {
      try {
        const [c, m] = await Promise.all([
          listarClientes({ porPagina: 300 }),
          listarMotores({ porPagina: 300, orden: 'nro_desc' }),
        ]);
        setClientes(c.clientes);
        setMotores(m.motores);
      } catch (e) {
        setError(e.message ?? 'No se pudieron cargar clientes o fichas.');
      }
    }
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    // El cliente es obligatorio para una orden nueva: sin cliente no hay
    // con quien verificar el seguimiento publico ni a nombre de quien
    // emitir el remito o la factura despues. Una orden ya cargada sin
    // cliente se puede seguir editando: no se le exige retroactivamente.
    if (!editando.id && !editando.cliente_id) {
      setError('Elegi un cliente para la orden.');
      return;
    }
    setGuardando(true);
    try {
      await guardarReparacion(editando);
      setEditando(null);
      await buscar(filtroEstado, soloAbiertas, texto);
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const cambiar = async (id, estado) => {
    setError('');
    try {
      await cambiarEstado(id, estado);
      await buscar(filtroEstado, soloAbiertas, texto);
    } catch (e) {
      setError(e.message ?? 'No se pudo cambiar el estado.');
    }
  };

  const filtrando = Boolean(filtroEstado || texto.trim());

  return (
    <div>
      <div className="pantalla-header">
        <div>
          <h2 className="pantalla-titulo">Reparaciones</h2>
          <p className="pantalla-sub">Que motor de quien, en que estado y desde cuando</p>
        </div>
        {esEditor && (
          <button type="button" className="btn btn-primary"
            onClick={() => abrirFormulario({ ...VACIA })}>
            <Plus size={16} /> Nueva orden
          </button>
        )}
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

      <div className="herramientas">
        <div className="buscador">
          <Search size={16} />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="N° de orden o apellido"
            aria-label="Buscar por numero de orden o cliente"
          />
          {texto && (
            <button type="button" className="buscador__limpiar" aria-label="Borrar la busqueda"
              onClick={() => setTexto('')}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="chips" role="group" aria-label="Filtrar por estado">
        {/* "En el taller" es el filtro por defecto y el que se usa: son
            las ordenes que tienen un motor fisico esperando. */}
        <button type="button" aria-pressed={soloAbiertas && !filtroEstado}
          className={`chip${soloAbiertas && !filtroEstado ? ' activo' : ''}`}
          onClick={() => { setSoloAbiertas(true); setFiltroEstado(''); }}>
          En el taller
        </button>
        <button type="button" aria-pressed={!soloAbiertas && !filtroEstado}
          className={`chip${!soloAbiertas && !filtroEstado ? ' activo' : ''}`}
          onClick={() => { setSoloAbiertas(false); setFiltroEstado(''); }}>
          Todas
        </button>
        {ESTADOS.map((e) => (
          <button key={e} type="button" aria-pressed={filtroEstado === e}
            className={`chip${filtroEstado === e ? ' activo' : ''}`}
            onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}>
            {ETIQUETA_ESTADO[e]}
          </button>
        ))}
      </div>

      {editando && (
        <form onSubmit={guardar} className="seccion" style={{ marginBottom: '16px' }}>
          <div className="seccion__cab">
            <div style={{ flex: 1 }}>
              <h3 className="seccion__titulo">
                {editando.id ? `Orden #${editando.numero}` : 'Nueva orden'}
              </h3>
            </div>
            <button type="button" onClick={() => setEditando(null)} aria-label="Cerrar"
              className="icono-btn">
              <X size={18} />
            </button>
          </div>

          <div className="datos">
            <div>
              <label className="campo-label" htmlFor="r-cliente">
                Cliente{!editando.id && ' *'}
              </label>
              <select id="r-cliente" className="ui-input" required={!editando.id}
                value={editando.cliente_id ?? ''}
                onChange={(e) => setEditando({ ...editando, cliente_id: e.target.value })}>
                <option value="">{editando.id ? 'Sin asignar' : 'Elegi un cliente'}</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="campo-label" htmlFor="r-motor">Ficha del motor</label>
              <select id="r-motor" className="ui-input" value={editando.motor_id ?? ''}
                onChange={(e) => setEditando({ ...editando, motor_id: e.target.value })}>
                <option value="">Sin ficha — se vincula despues</option>
                {motores.map((m) => (
                  <option key={m.id} value={m.id}>#{m.nro_motor} — {m.descripcion}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="campo-label" htmlFor="r-estado">Estado</label>
              <select id="r-estado" className="ui-input" value={editando.estado}
                onChange={(e) => setEditando({ ...editando, estado: e.target.value })}>
                {ESTADOS.map((e2) => <option key={e2} value={e2}>{ETIQUETA_ESTADO[e2]}</option>)}
              </select>
            </div>
            <div>
              <label className="campo-label" htmlFor="r-ingreso">Ingreso</label>
              <input id="r-ingreso" type="date" className="ui-input" value={editando.ingreso ?? ''}
                onChange={(e) => setEditando({ ...editando, ingreso: e.target.value })} />
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <label className="campo-label" htmlFor="r-problema">Problema declarado</label>
            <textarea id="r-problema" rows={2} className="ui-input"
              style={{ resize: 'vertical' }}
              value={editando.problema ?? ''}
              onChange={(e) => setEditando({ ...editando, problema: e.target.value })}
              placeholder="Ej: Hace ruido y no arranca" />
          </div>

          <div style={{ marginTop: '12px' }}>
            <label className="campo-label" htmlFor="r-notas">Notas internas</label>
            <textarea id="r-notas" rows={2} className="ui-input"
              style={{ resize: 'vertical' }}
              value={editando.notas ?? ''}
              onChange={(e) => setEditando({ ...editando, notas: e.target.value })}
              placeholder="No se muestran en la consulta publica de estado" />
          </div>

          <div className="acciones">
            <button type="button" className="btn btn-secondary" onClick={() => setEditando(null)}>
              Cancelar
            </button>
            <Button type="submit" variant="primary" isLoading={guardando}>
              {editando.id ? 'Guardar' : 'Crear orden'}
            </Button>
          </div>
        </form>
      )}

      {cargando ? (
        <div style={{ padding: '48px 0' }}><Spinner label="Cargando..." centered /></div>
      ) : reparaciones.length === 0 ? (
        <div className="vacio">
          <Wrench size={26} />
          <div>
            {filtrando
              ? 'Ninguna orden coincide con la busqueda.'
              : 'Todavia no hay ordenes cargadas.'}
          </div>
        </div>
      ) : (
        <ul className="lista">
          {reparaciones.map((r) => {
            const siguiente = SIGUIENTE_ESTADO[r.estado];
            return (
              <li key={r.id} className="fila">
                <Link to={`/sistema/reparaciones/${r.id}`} className="fila-link">
                  <div className="fila-encabezado">
                    <span className="fila-titulo">
                      {r.cliente?.nombre ?? <span style={{ color: 'var(--text-light)' }}>Sin cliente</span>}
                    </span>
                    <span className="fila-nro">N° {r.numero}</span>
                  </div>

                  <div className="fila-sub">
                    {r.motor
                      ? `#${r.motor.nro_motor} ${r.motor.descripcion}`
                      : 'Sin ficha asociada'}
                    {' · '}
                    {new Date(r.ingreso).toLocaleDateString('es-AR')}
                  </div>

                  <div className="fila-etiquetas">
                    <span className="etiqueta"
                      style={{ color: COLOR_ESTADO[r.estado], borderColor: 'currentColor' }}>
                      {ETIQUETA_ESTADO[r.estado]}
                    </span>
                  </div>
                </Link>

                {esEditor && (
                  <div className="fila-acciones">
                    <MenuAcciones etiqueta={`Acciones de la orden ${r.numero}`}>
                      {/* El salto al estado que sigue es lo que mas se
                          toca; va primero y con su nombre, no como una
                          lista de seis donde hay que buscar cual sigue. */}
                      {siguiente && (
                        <ItemMenu onClick={() => cambiar(r.id, siguiente)} icono={ArrowRight}>
                          Marcar {ETIQUETA_ESTADO[siguiente].toLowerCase()}
                        </ItemMenu>
                      )}
                      <ItemMenu onClick={() => abrirFormulario({
                        ...VACIA, ...r,
                        cliente_id: r.cliente?.id ?? '',
                        motor_id: r.motor?.id ?? '',
                        egreso: r.egreso ?? '',
                      })} icono={Pencil}>
                        Editar orden
                      </ItemMenu>
                      <ItemMenu onClick={() => setABorrar(r)} icono={Trash2} peligro>
                        Eliminar
                      </ItemMenu>
                    </MenuAcciones>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {reparaciones.length > 0 && (
        <div className="contador">
          {reparaciones.length} {reparaciones.length === 1 ? 'orden' : 'ordenes'}
        </div>
      )}

      <Modal
        isOpen={Boolean(aBorrar)}
        type="danger"
        title="Eliminar orden"
        message={`Se elimina la orden #${aBorrar?.numero}. La ficha del motor y el cliente se conservan.`}
        onClose={() => setABorrar(null)}
        onConfirm={async () => {
          try {
            await eliminarReparacion(aBorrar.id);
            await buscar(filtroEstado, soloAbiertas, texto);
          } catch (e) { setError(e.message); }
          setABorrar(null);
        }}
      />
    </div>
  );
};

export default Reparaciones;
