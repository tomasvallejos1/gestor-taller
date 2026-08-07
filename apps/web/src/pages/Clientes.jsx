import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Pencil, Trash2, Phone, Mail, MapPin, X, AlertTriangle,
  ChevronDown, StickyNote, UsersRound,
} from 'lucide-react';
import Modal from '../components/Modal';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import MenuAcciones, { ItemMenu } from '../components/ui/MenuAcciones';
import { useAuth } from '../context/AuthContext';
import { useEsMobile } from '../lib/useMediaQuery';
import {
  listarClientes, guardarCliente, eliminarCliente, buscarParecidos, reparacionesDe,
} from '../lib/clientes';
import { ETIQUETA_ESTADO } from '../lib/reparaciones';
import {
  TIPOS_PERSONA, CONDICIONES_FISCALES, TIPOS_DOCUMENTO,
  revisarDocumento, formatearDocumento, etiquetaCondicion, documentoSugerido,
} from '@shared/fiscal.js';

/**
 * Listado de clientes.
 *
 * La tarjeta mostraba de una vez nombre, telefono, correo, direccion,
 * documento, condicion frente al IVA, notas y dos botones. Con diez
 * clientes en pantalla no se distinguia donde terminaba uno y empezaba
 * el otro. Ahora al frente va lo que se busca --el nombre y el
 * telefono-- y el resto aparece al desplegar.
 */

const VACIO = {
  id: null, nombre: '', telefono: '', email: '', direccion: '', notas: '',
  tipo_persona: 'fisica', condicion_fiscal: 'consumidor_final',
  documento_tipo: 'dni', documento: '',
};

const Clientes = () => {
  const { esEditor } = useAuth();
  const esMobile = useEsMobile();

  const [clientes, setClientes] = useState([]);
  const [total, setTotal] = useState(0);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [editando, setEditando] = useState(null);
  const [verFiscal, setVerFiscal] = useState(false);
  const [parecidos, setParecidos] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const [aBorrar, setABorrar] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [reparaciones, setReparaciones] = useState({});

  const buscar = useCallback(async (t) => {
    setCargando(true);
    setError('');
    try {
      const r = await listarClientes({ texto: t });
      setClientes(r.clientes);
      setTotal(r.total);
    } catch (e) {
      setError(e.message ?? 'No pudimos cargar los clientes.');
    } finally {
      setCargando(false);
    }
  }, []);

  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; buscar(texto); return undefined; }
    const t = setTimeout(() => buscar(texto), 350);
    return () => clearTimeout(t);
  }, [texto, buscar]);

  // Aviso de posible duplicado mientras se escribe el nombre en un alta.
  useEffect(() => {
    if (!editando || editando.id || editando.nombre.trim().length < 3) {
      setParecidos([]);
      return undefined;
    }
    const t = setTimeout(() => {
      buscarParecidos(editando.nombre).then(setParecidos).catch(() => setParecidos([]));
    }, 400);
    return () => clearTimeout(t);
  }, [editando]);

  // Se revisa mientras se escribe: un error que aparece recien al
  // guardar hace perder el formulario entero.
  const problemaDoc = editando ? revisarDocumento({
    tipoPersona: editando.tipo_persona,
    tipoDocumento: editando.documento_tipo,
    documento: editando.documento,
  }) : null;

  const abrirFormulario = (cliente) => {
    setEditando(cliente ? { ...VACIO, ...cliente } : { ...VACIO });
    // Los datos fiscales se abren solos si el cliente ya tiene alguno
    // cargado: si no, editar a alguien con CUIT lo escondia.
    setVerFiscal(Boolean(cliente?.documento));
    setError('');
  };

  const cerrarFormulario = () => {
    setEditando(null);
    setParecidos([]);
    setVerFiscal(false);
  };

  const cambiarTipoPersona = (tipo) => setEditando((c) => ({
    ...c,
    tipo_persona: tipo,
    // Una empresa no tiene DNI; se corrige el tipo de documento solo en
    // vez de dejar que la base rechace el alta despues.
    documento_tipo: tipo === 'juridica' && c.documento_tipo !== 'cuit'
      ? 'cuit'
      : c.documento_tipo || documentoSugerido(tipo),
    // A una empresa no se le pregunta la condicion frente al IVA: se
    // asume responsable inscripto, que es lo que es casi siempre. Ojo:
    // una fundacion o mutual es EXENTA y aca quedaria mal.
    condicion_fiscal: tipo === 'juridica'
      ? 'responsable_inscripto'
      : (c.condicion_fiscal === 'responsable_inscripto' ? '' : c.condicion_fiscal),
  }));

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    if (problemaDoc) { setVerFiscal(true); setError(problemaDoc); return; }
    setGuardando(true);
    try {
      await guardarCliente(editando);
      cerrarFormulario();
      await buscar(texto);
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar el cliente.');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBorrado = async () => {
    try {
      await eliminarCliente(aBorrar.id);
      setClientes((cs) => cs.filter((c) => c.id !== aBorrar.id));
      setTotal((t) => t - 1);
    } catch (e) {
      setError(e.message ?? 'No se pudo eliminar.');
    } finally {
      setABorrar(null);
    }
  };

  const alternarDetalle = async (cliente) => {
    if (expandido === cliente.id) { setExpandido(null); return; }
    setExpandido(cliente.id);
    if (!reparaciones[cliente.id]) {
      try {
        const r = await reparacionesDe(cliente.id);
        setReparaciones((prev) => ({ ...prev, [cliente.id]: r }));
      } catch {
        setReparaciones((prev) => ({ ...prev, [cliente.id]: [] }));
      }
    }
  };

  const inputStyle = {
    width: '100%', padding: '11px 13px', borderRadius: '9px',
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'inherit', boxSizing: 'border-box', fontSize: '16px', fontFamily: 'inherit',
  };

  return (
    <div>
      <div className="pantalla-header">
        <div>
          <h2 className="pantalla-titulo">Clientes</h2>
          <p className="pantalla-sub">Quien trajo cada motor y como ubicarlo</p>
        </div>
        {esEditor && (
          <button type="button" className="btn btn-primary" onClick={() => abrirFormulario(null)}>
            <Plus size={16} /> Nuevo
          </button>
        )}
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

      {editando && (
        <form onSubmit={guardar} className="ui-card" style={{ padding: esMobile ? '16px' : '22px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
              {editando.id ? 'Editar cliente' : 'Nuevo cliente'}
            </h3>
            <button type="button" onClick={cerrarFormulario} className="icono-btn"
              aria-label="Cerrar el formulario"
              style={{ border: 'none', width: '38px', height: '38px' }}>
              <X size={18} />
            </button>
          </div>

          {parecidos.length > 0 && (
            <Alert variant="warning" className="mb-3">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Puede que ya exista.</strong> Hay clientes con nombre parecido:{' '}
                  {parecidos.map((p) => p.nombre).join(', ')}. Si es el mismo, edita el
                  existente en vez de crear otro: si no, el historial le queda partido.
                </div>
              </div>
            </Alert>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr' : '1fr 1fr', gap: '13px' }}>
            <div>
              <label className="campo-label" htmlFor="cl-nombre">Nombre *</label>
              <input id="cl-nombre" style={inputStyle} required autoFocus
                value={editando.nombre}
                onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                placeholder="Pablo Magoneri" />
            </div>
            <div>
              <label className="campo-label" htmlFor="cl-tel">Telefono</label>
              <input id="cl-tel" style={inputStyle} type="tel" inputMode="tel"
                value={editando.telefono ?? ''}
                onChange={(e) => setEditando({ ...editando, telefono: e.target.value })}
                placeholder="3462 55-3285" />
            </div>
            <div>
              <label className="campo-label" htmlFor="cl-mail">Correo</label>
              <input id="cl-mail" style={inputStyle} type="email"
                value={editando.email ?? ''}
                onChange={(e) => setEditando({ ...editando, email: e.target.value })} />
            </div>
            <div>
              <label className="campo-label" htmlFor="cl-dir">Direccion</label>
              <input id="cl-dir" style={inputStyle}
                value={editando.direccion ?? ''}
                onChange={(e) => setEditando({ ...editando, direccion: e.target.value })} />
            </div>
            <div style={{ gridColumn: esMobile ? 'auto' : 'span 2' }}>
              <label className="campo-label" htmlFor="cl-notas">Notas</label>
              <textarea id="cl-notas" rows={2} style={{ ...inputStyle, resize: 'vertical' }}
                value={editando.notas ?? ''}
                onChange={(e) => setEditando({ ...editando, notas: e.target.value })} />
            </div>
          </div>

          {/* Los datos fiscales son opcionales y casi nadie los carga:
              plegados, el formulario entra de una en una pantalla de
              celular en vez de pedir tres scrolls. */}
          <button type="button" onClick={() => setVerFiscal((v) => !v)}
            aria-expanded={verFiscal}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px', width: '100%',
              margin: '16px 0 0', padding: '11px 0', minHeight: '44px',
              background: 'none', border: 'none', cursor: 'pointer',
              font: 'inherit', fontWeight: 600, fontSize: '0.9rem',
              color: 'var(--accent)', textAlign: 'left',
            }}>
            <ChevronDown size={16} style={{ transform: verFiscal ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease' }} />
            Datos fiscales (para el presupuesto)
          </button>

          {verFiscal && (
            <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr' : 'repeat(2, 1fr)', gap: '13px', marginTop: '4px' }}>
              <div>
                <label className="campo-label" htmlFor="cl-tipo">Tipo</label>
                <select id="cl-tipo" style={inputStyle} value={editando.tipo_persona ?? 'fisica'}
                  onChange={(e) => cambiarTipoPersona(e.target.value)}>
                  {TIPOS_PERSONA.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                  ))}
                </select>
              </div>

              {/* Solo se pregunta a personas fisicas: una empresa se toma
                  como responsable inscripto y no se la molesta con esto. */}
              {editando.tipo_persona !== 'juridica' && (
                <div>
                  <label className="campo-label" htmlFor="cl-cond">Condicion frente al IVA</label>
                  <select id="cl-cond" style={inputStyle} value={editando.condicion_fiscal ?? ''}
                    onChange={(e) => setEditando({ ...editando, condicion_fiscal: e.target.value })}>
                    <option value="">Sin especificar</option>
                    {CONDICIONES_FISCALES.map((c) => (
                      <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="campo-label" htmlFor="cl-doctipo">Documento</label>
                <select id="cl-doctipo" style={inputStyle} value={editando.documento_tipo ?? 'dni'}
                  onChange={(e) => setEditando({ ...editando, documento_tipo: e.target.value })}>
                  {TIPOS_DOCUMENTO
                    // Una empresa solo puede tener CUIT.
                    .filter((t) => editando.tipo_persona !== 'juridica' || t.valor === 'cuit')
                    .map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                </select>
              </div>

              <div>
                <label className="campo-label" htmlFor="cl-doc">Numero</label>
                <input
                  id="cl-doc"
                  style={{ ...inputStyle, borderColor: problemaDoc ? 'var(--danger)' : 'var(--border)' }}
                  inputMode="numeric"
                  value={editando.documento ?? ''}
                  onChange={(e) => setEditando({ ...editando, documento: e.target.value })}
                  placeholder={editando.documento_tipo === 'dni' ? '12.345.678' : '20-12345678-6'}
                  aria-invalid={Boolean(problemaDoc)}
                />
                {problemaDoc && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '5px' }}>
                    {problemaDoc}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: '18px', display: 'flex', gap: '9px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={cerrarFormulario}>
              Cancelar
            </button>
            <Button type="submit" variant="primary" isLoading={guardando}>
              {editando.id ? 'Guardar' : 'Crear cliente'}
            </Button>
          </div>
        </form>
      )}

      <div className="herramientas">
        <div className="buscador">
          <Search size={16} />
          <input value={texto} onChange={(e) => setTexto(e.target.value)}
            aria-label="Buscar clientes"
            placeholder="Buscar por nombre, telefono o correo" />
          {texto && (
            <button type="button" className="buscador__limpiar" aria-label="Borrar la busqueda"
              onClick={() => setTexto('')}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {cargando ? (
        <div style={{ padding: '48px 0' }}>
          <Spinner label="Cargando clientes..." centered />
        </div>
      ) : clientes.length === 0 ? (
        <div className="vacio">
          <UsersRound size={26} />
          <div>{texto ? 'Ningun cliente coincide con la busqueda.' : 'Todavia no hay clientes cargados.'}</div>
        </div>
      ) : (
        <ul className="lista">
          {clientes.map((c) => {
            const abierto = expandido === c.id;
            const reps = reparaciones[c.id];
            const tel = c.telefono ? c.telefono.replace(/[^\d+]/g, '') : null;
            return (
              <li key={c.id} className="fila">
                <button type="button" onClick={() => alternarDetalle(c)}
                  aria-expanded={abierto}
                  className={`fila-link${tel ? ' fila-link--doble' : ''}`}>
                  <div className="fila-encabezado">
                    <span className="fila-titulo">{c.nombre}</span>
                  </div>
                  <div className="fila-sub">
                    {c.telefono || c.email || c.direccion || 'Sin datos de contacto'}
                  </div>
                </button>

                <div className="fila-acciones">
                  {/* Llamar es lo que mas se hace con un cliente y es lo
                      unico que el telefono resuelve mejor que la web. */}
                  {tel && (
                    <a href={`tel:${tel}`} className="menu-acciones__boton"
                      aria-label={`Llamar a ${c.nombre}`}>
                      <Phone size={17} />
                    </a>
                  )}
                  {esEditor && (
                    <MenuAcciones etiqueta={`Acciones de ${c.nombre}`}>
                      <ItemMenu onClick={() => abrirFormulario(c)} icono={Pencil}>
                        Editar cliente
                      </ItemMenu>
                      <ItemMenu onClick={() => setABorrar(c)} icono={Trash2} peligro>
                        Eliminar
                      </ItemMenu>
                    </MenuAcciones>
                  )}
                </div>

                {abierto && (
                  <div className="fila-detalle">
                    {c.email && (
                      <div className="fila-dato"><Mail size={14} /> {c.email}</div>
                    )}
                    {c.direccion && (
                      <div className="fila-dato"><MapPin size={14} /> {c.direccion}</div>
                    )}
                    {c.notas && (
                      <div className="fila-dato"><StickyNote size={14} /> {c.notas}</div>
                    )}

                    {(c.documento || c.condicion_fiscal) && (
                      <div className="fila-etiquetas" style={{ marginTop: '8px' }}>
                        {c.documento && (
                          <span className="etiqueta">
                            {(c.documento_tipo ?? 'doc').toUpperCase()}{' '}
                            {formatearDocumento(c.documento_tipo, c.documento)}
                          </span>
                        )}
                        {c.condicion_fiscal && (
                          <span className="etiqueta">{etiquetaCondicion(c.condicion_fiscal)}</span>
                        )}
                        {c.tipo_persona === 'juridica' && <span className="etiqueta">Empresa</span>}
                      </div>
                    )}

                    <div style={{ marginTop: '13px' }}>
                      <div className="campo-label">Reparaciones</div>
                      {!reps ? (
                        <Spinner label="Cargando..." size="sm" />
                      ) : reps.length === 0 ? (
                        <div style={{ color: 'var(--text-light)' }}>Sin reparaciones registradas.</div>
                      ) : (
                        <div style={{ display: 'grid', gap: '7px' }}>
                          {reps.map((r) => (
                            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                              <span>
                                <strong>N° {r.numero}</strong>
                                {r.motor ? (
                                  <Link to={`/sistema/motores/ver/${r.motor.nro_motor}`}
                                    style={{ marginLeft: '8px', color: 'var(--accent)', fontWeight: 600 }}>
                                    {r.motor.descripcion}
                                  </Link>
                                ) : <span style={{ marginLeft: '8px', color: 'var(--text-light)' }}>sin ficha</span>}
                              </span>
                              <span style={{ color: 'var(--text-light)' }}>
                                {ETIQUETA_ESTADO[r.estado] ?? r.estado} · {new Date(r.ingreso).toLocaleDateString('es-AR')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {clientes.length > 0 && (
        <div className="contador">
          {clientes.length === total
            ? `${total} ${total === 1 ? 'cliente' : 'clientes'}`
            : `${clientes.length} de ${total} clientes`}
        </div>
      )}

      <Modal
        isOpen={Boolean(aBorrar)}
        type="danger"
        title="Eliminar cliente"
        message={`Se elimina "${aBorrar?.nombre}". Las reparaciones asociadas se conservan pero quedan sin cliente.`}
        onClose={() => setABorrar(null)}
        onConfirm={confirmarBorrado}
      />
    </div>
  );
};

export default Clientes;
