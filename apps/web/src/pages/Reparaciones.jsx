import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, X, Wrench } from 'lucide-react';
import Modal from '../components/Modal';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useEsMobile } from '../lib/useMediaQuery';
import {
  ESTADOS, ETIQUETA_ESTADO, COLOR_ESTADO,
  listarReparaciones, guardarReparacion, cambiarEstado, eliminarReparacion,
} from '../lib/reparaciones';
import { listarClientes } from '../lib/clientes';
import { listarMotores } from '../lib/motores';

const hoy = () => new Date().toISOString().slice(0, 10);
const VACIA = {
  id: null, motor_id: '', cliente_id: '', estado: 'ingresado', ingreso: hoy(), egreso: '',
  problema: '', diagnostico: '', notas: '',
};

const Reparaciones = () => {
  const { esEditor } = useAuth();
  const esMobile = useEsMobile();

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

  const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-light)' };
  const inputStyle = { width: '100%', padding: '11px 13px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', boxSizing: 'border-box', fontSize: '1rem', fontFamily: 'inherit' };

  return (
    <div>
      <div className="ui-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px', borderColor: 'var(--accent-border)', background: 'var(--gradient-soft)' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', margin: 0 }}>Reparaciones</h2>
          <p style={{ marginTop: '5px', fontSize: '0.92rem', color: 'var(--text-light)' }}>
            Que motor de quien, en que estado y desde cuando
          </p>
        </div>
        {esEditor && (
          <Button variant="primary" onClick={() => abrirFormulario({ ...VACIA })}>
            <Plus size={16} /> Nueva orden
          </Button>
        )}
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

      {editando && (
        <form onSubmit={guardar} className="ui-card" style={{ padding: esMobile ? '18px' : '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
              {editando.id ? `Orden #${editando.numero}` : 'Nueva orden'}
            </h3>
            <button type="button" onClick={() => setEditando(null)} aria-label="Cerrar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: '8px', minHeight: '40px' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle} htmlFor="r-cliente">
                Cliente{!editando.id && ' *'}
              </label>
              <select id="r-cliente" required={!editando.id} style={inputStyle} value={editando.cliente_id ?? ''}
                onChange={(e) => setEditando({ ...editando, cliente_id: e.target.value })}>
                <option value="">{editando.id ? 'Sin asignar' : 'Elegi un cliente'}</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle} htmlFor="r-motor">Ficha del motor</label>
              <select id="r-motor" style={inputStyle} value={editando.motor_id ?? ''}
                onChange={(e) => setEditando({ ...editando, motor_id: e.target.value })}>
                <option value="">Sin ficha — se puede vincular despues</option>
                {motores.map((m) => (
                  <option key={m.id} value={m.id}>#{m.nro_motor} — {m.descripcion}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle} htmlFor="r-estado">Estado</label>
              <select id="r-estado" style={inputStyle} value={editando.estado}
                onChange={(e) => setEditando({ ...editando, estado: e.target.value })}>
                {ESTADOS.map((e2) => <option key={e2} value={e2}>{ETIQUETA_ESTADO[e2]}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle} htmlFor="r-ingreso">Ingreso</label>
              <input id="r-ingreso" type="date" style={inputStyle} value={editando.ingreso ?? ''}
                onChange={(e) => setEditando({ ...editando, ingreso: e.target.value })} />
            </div>
            <div style={{ gridColumn: esMobile ? 'auto' : 'span 2' }}>
              <label style={labelStyle} htmlFor="r-problema">Problema declarado</label>
              <textarea id="r-problema" rows={2} style={{ ...inputStyle, resize: 'vertical' }}
                value={editando.problema ?? ''}
                onChange={(e) => setEditando({ ...editando, problema: e.target.value })}
                placeholder="Ej: Hace ruido y no arranca" />
            </div>
            <div style={{ gridColumn: esMobile ? 'auto' : 'span 2' }}>
              <label style={labelStyle} htmlFor="r-notas">Notas internas</label>
              <textarea id="r-notas" rows={2} style={{ ...inputStyle, resize: 'vertical' }}
                value={editando.notas ?? ''}
                onChange={(e) => setEditando({ ...editando, notas: e.target.value })}
                placeholder="No se muestran en la consulta publica de estado" />
            </div>
          </div>

          <div style={{ marginTop: '18px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setEditando(null)}>Cancelar</button>
            <Button type="submit" variant="primary" isLoading={guardando}>
              {editando.id ? 'Guardar' : 'Crear orden'}
            </Button>
          </div>
        </form>
      )}

      <div className="ui-card" style={{ padding: '18px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr' : '1fr 1fr auto', gap: '14px', alignItems: 'end' }}>
          <div>
            <label style={labelStyle} htmlFor="r-buscar">N° de orden</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input id="r-buscar" style={{ ...inputStyle, paddingLeft: '38px' }} inputMode="numeric"
                value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej: 12" />
            </div>
          </div>
          <div>
            <label style={labelStyle} htmlFor="r-filtro">Estado</label>
            <select id="r-filtro" style={inputStyle} value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos</option>
              {ESTADOS.map((e2) => <option key={e2} value={e2}>{ETIQUETA_ESTADO[e2]}</option>)}
            </select>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '44px', cursor: 'pointer' }}>
            <input type="checkbox" checked={soloAbiertas} disabled={Boolean(filtroEstado)}
              onChange={(e) => setSoloAbiertas(e.target.checked)}
              style={{ width: '18px', height: '18px' }} />
            <span style={{ fontSize: '0.9rem' }}>Solo en el taller</span>
          </label>
        </div>
      </div>

      {cargando ? (
        <div className="ui-card" style={{ padding: '50px' }}><Spinner label="Cargando..." centered /></div>
      ) : reparaciones.length === 0 ? (
        <div className="ui-card" style={{ padding: '50px', textAlign: 'center', color: 'var(--text-light)' }}>
          <Wrench size={26} style={{ opacity: 0.5, marginBottom: '10px' }} />
          <div>No hay reparaciones que coincidan.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {reparaciones.map((r) => (
            <div key={r.id} className="ui-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                    <Link to={`/sistema/reparaciones/${r.id}`} style={{ fontWeight: 800, fontSize: '1.05rem', color: 'inherit', textDecoration: 'none' }}>
                      Orden #{r.numero}
                    </Link>
                    <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700, border: `1px solid ${COLOR_ESTADO[r.estado]}`, color: COLOR_ESTADO[r.estado] }}>
                      {ETIQUETA_ESTADO[r.estado]}
                    </span>
                  </div>

                  <div style={{ marginTop: '7px', fontSize: '0.92rem' }}>
                    {r.motor ? (
                      <Link to={`/sistema/motores/ver/${r.motor.nro_motor}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        #{r.motor.nro_motor} {r.motor.descripcion}
                      </Link>
                    ) : <span style={{ color: 'var(--text-light)' }}>Sin ficha asociada</span>}
                    {r.cliente && <span style={{ color: 'var(--text-light)' }}> · {r.cliente.nombre}</span>}
                  </div>

                  <div style={{ marginTop: '5px', fontSize: '0.82rem', color: 'var(--text-light)' }}>
                    Ingreso {new Date(r.ingreso).toLocaleDateString('es-AR')}
                    {r.egreso ? ` · Egreso ${new Date(r.egreso).toLocaleDateString('es-AR')}` : ''}
                  </div>

                  {r.notas && (
                    <div style={{ marginTop: '7px', fontSize: '0.87rem', color: 'var(--text-light)' }}>{r.notas}</div>
                  )}
                </div>

                {esEditor && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <select value={r.estado} onChange={(e) => cambiar(r.id, e.target.value)}
                      aria-label={`Estado de la orden ${r.numero}`}
                      style={{ ...inputStyle, width: 'auto', minWidth: '160px', padding: '10px 12px' }}>
                      {ESTADOS.map((e2) => <option key={e2} value={e2}>{ETIQUETA_ESTADO[e2]}</option>)}
                    </select>
                    <button type="button" onClick={() => abrirFormulario({
                      ...VACIA, ...r,
                      cliente_id: r.cliente?.id ?? '',
                      motor_id: r.motor?.id ?? '',
                      egreso: r.egreso ?? '',
                    })}
                      className="btn btn-secondary" style={{ minHeight: '44px' }}>
                      Editar
                    </button>
                    <button type="button" onClick={() => setABorrar(r)}
                      aria-label={`Eliminar orden ${r.numero}`}
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--danger)', padding: '10px', minHeight: '44px', minWidth: '44px' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
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
