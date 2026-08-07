import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, X, Save, FileDown, Share2, Check, Search,
  Pencil, Trash2, ListPlus,
} from 'lucide-react';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { useEsMobile } from '../lib/useMediaQuery';
import { listarClientes } from '../lib/clientes';
import { listarReparaciones } from '../lib/reparaciones';
import {
  obtenerPresupuesto, crearPresupuesto, actualizarPresupuesto, guardarItems,
  listarCatalogo, obtenerConfiguracion, calcularTotales, pesos, venceEl,
  generarPdf, estadoDe, ETIQUETA_ESTADO, COLOR_ESTADO,
} from '../lib/presupuestos';
import { formatearDocumento, etiquetaCondicion } from '@shared/fiscal.js';

/**
 * Alta y edicion de un presupuesto.
 *
 * Los renglones no son un formulario permanente. Antes cada item era una
 * fila de inputs siempre abierta, asi que un presupuesto de seis
 * trabajos eran veinticuatro campos en pantalla y no habia forma de leer
 * de un vistazo que se estaba cotizando. Ahora lo cargado se ve como
 * informacion --descripcion, cantidad, precio, importe-- y se edita uno
 * por vez.
 */

const RENGLON_VACIO = () => ({
  indice: null, catalogo_item_id: null, descripcion: '', cantidad: '1', precio_unit: '',
});

const PresupuestoForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const esMobile = useEsMobile();

  const [presupuesto, setPresupuesto] = useState(null);
  const [items, setItems] = useState([]);
  const [renglon, setRenglon] = useState(RENGLON_VACIO());
  const [clientes, setClientes] = useState([]);
  const [reparaciones, setReparaciones] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [config, setConfig] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [error, setError] = useState('');
  const [avisoRenglon, setAvisoRenglon] = useState('');
  const [aviso, setAviso] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const campoDescripcion = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const [cs, rs, cat, cfg] = await Promise.all([
        listarClientes({ porPagina: 300 }),
        listarReparaciones({ soloAbiertas: false }),
        listarCatalogo(),
        obtenerConfiguracion(),
      ]);
      setClientes(cs.clientes);
      setReparaciones(rs.reparaciones);
      setCatalogo(cat);
      setConfig(cfg);

      if (id) {
        const p = await obtenerPresupuesto(id);
        if (!p) { setError('No encontramos ese presupuesto.'); return; }
        setPresupuesto(p);
        setItems(p.items ?? []);
      } else {
        setPresupuesto({
          cliente_id: '', reparacion_id: '',
          iva_pct: cfg?.iva_por_defecto ?? 0, descuento: 0,
          vigencia_dias: cfg?.vigencia_dias ?? 15, notas: '',
        });
      }
    } catch (e) {
      setError(e.message ?? 'No se pudo cargar.');
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const totales = useMemo(() => calcularTotales({
    items,
    descuento: presupuesto?.descuento,
    ivaPct: presupuesto?.iva_pct,
  }), [items, presupuesto?.descuento, presupuesto?.iva_pct]);

  const cambiar = (campo, valor) => setPresupuesto((p) => ({ ...p, [campo]: valor }));

  // ---------- Renglones ----------

  const importeDe = (it) => (Number(it.cantidad) || 0) * (Number(it.precio_unit) || 0);

  const confirmarRenglon = () => {
    const descripcion = renglon.descripcion.trim();
    if (!descripcion) {
      setAvisoRenglon('Poné una descripcion.');
      campoDescripcion.current?.focus();
      return;
    }
    if (!(Number(renglon.cantidad) > 0)) {
      setAvisoRenglon('La cantidad tiene que ser mayor que cero.');
      return;
    }

    const nuevo = {
      catalogo_item_id: renglon.catalogo_item_id,
      descripcion,
      cantidad: Number(renglon.cantidad),
      precio_unit: Number(renglon.precio_unit) || 0,
    };

    setItems((is) => (renglon.indice === null
      ? [...is, nuevo]
      : is.map((it, i) => (i === renglon.indice ? { ...it, ...nuevo } : it))));

    setRenglon(RENGLON_VACIO());
    setAvisoRenglon('');
    setBuscando(false);
    campoDescripcion.current?.focus();
  };

  const editarRenglon = (i) => {
    const it = items[i];
    setRenglon({
      indice: i,
      catalogo_item_id: it.catalogo_item_id ?? null,
      descripcion: it.descripcion,
      cantidad: String(it.cantidad),
      precio_unit: String(it.precio_unit),
    });
    setAvisoRenglon('');
    setBuscando(false);
    campoDescripcion.current?.focus();
  };

  const quitarRenglon = (i) => {
    setItems((is) => is.filter((_, j) => j !== i));
    // Si se estaba editando justo ese, el formulario tiene que soltarlo:
    // si no, al guardar escribiria sobre el renglon equivocado.
    setRenglon((r) => {
      if (r.indice === null) return r;
      if (r.indice === i) return RENGLON_VACIO();
      return r.indice > i ? { ...r, indice: r.indice - 1 } : r;
    });
  };

  const elegirDelCatalogo = (item) => {
    setRenglon((r) => ({
      ...r,
      catalogo_item_id: item.id,
      descripcion: item.descripcion,
      precio_unit: String(item.precio),
    }));
    setBuscando(false);
    setAvisoRenglon('');
  };

  // ---------- Guardado ----------

  const guardar = async () => {
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      let p = presupuesto;
      p = p.id
        ? await actualizarPresupuesto(p.id, presupuesto)
        : await crearPresupuesto(presupuesto);

      await guardarItems(p.id, items);

      const completo = await obtenerPresupuesto(p.id);
      setPresupuesto(completo);
      setItems(completo.items ?? []);
      setAviso('Presupuesto guardado.');

      if (!id) navigate(`/sistema/presupuestos/${p.id}`, { replace: true });
    } catch (e) {
      setError(e.message ?? 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const descargarPdf = async () => {
    setGenerandoPdf(true);
    setError('');
    try {
      const { url } = await generarPdf(presupuesto.id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const copiarLink = async () => {
    const url = `${window.location.origin}/p/${presupuesto.token_publico}`;
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2200);
  };

  if (cargando) {
    return <div style={{ padding: '48px' }}><Spinner label="Cargando..." size="lg" centered /></div>;
  }
  if (!presupuesto) {
    return (
      <div style={{ padding: '32px' }}>
        <Alert variant="error">{error || 'No encontrado.'}</Alert>
        <Link to="/sistema/presupuestos" className="btn btn-secondary" style={{ marginTop: 16, textDecoration: 'none' }}>
          <ArrowLeft size={15} /> Volver
        </Link>
      </div>
    );
  }

  const cliente = clientes.find((c) => c.id === presupuesto.cliente_id) ?? presupuesto.cliente;
  const vence = venceEl(presupuesto);
  const estado = presupuesto.id ? estadoDe(presupuesto) : null;
  const editandoRenglon = renglon.indice !== null;

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '9px',
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'inherit', boxSizing: 'border-box', fontSize: '16px', fontFamily: 'inherit',
  };

  return (
    <div>
      <div className="pantalla-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/sistema/presupuestos" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={15} /> Volver
          </Link>
          <div>
            <h2 className="pantalla-titulo">
              {presupuesto.numero ? `Presupuesto N° ${presupuesto.numero}` : 'Nuevo presupuesto'}
            </h2>
            {estado && (
              <span className="etiqueta" style={{ marginTop: '5px', color: COLOR_ESTADO[estado], borderColor: 'currentColor' }}>
                {ETIQUETA_ESTADO[estado]}
              </span>
            )}
          </div>
        </div>
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}
      {aviso ? <Alert variant="success" className="mb-3">{aviso}</Alert> : null}

      <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr' : '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
        <div className="ui-card" style={{ padding: '16px' }}>
          <label className="campo-label" htmlFor="p-cliente">Cliente</label>
          <select id="p-cliente" style={inputStyle} value={presupuesto.cliente_id ?? ''}
            onChange={(e) => cambiar('cliente_id', e.target.value)}>
            <option value="">Sin cliente (a nombre de nadie)</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>

          {/* Un presupuesto sin cliente es valido --el mostrador pide
              precio antes de dar el nombre-- pero conviene que se vea de
              antemano que va a imprimir el PDF, y no descubrirlo despues. */}
          {!presupuesto.cliente_id && (
            <div style={{ marginTop: '9px', fontSize: '0.84rem', color: 'var(--text-light)' }}>
              En el PDF va a figurar <strong>Consumidor final</strong>.
            </div>
          )}

          {cliente && (
            <div style={{ marginTop: '9px', fontSize: '0.84rem', color: 'var(--text-light)', display: 'grid', gap: '3px' }}>
              {cliente.documento && (
                <span>{(cliente.documento_tipo ?? '').toUpperCase()} {formatearDocumento(cliente.documento_tipo, cliente.documento)}</span>
              )}
              {cliente.condicion_fiscal && <span>{etiquetaCondicion(cliente.condicion_fiscal)}</span>}
              {cliente.direccion && <span>{cliente.direccion}</span>}
              {!cliente.documento && (
                <span style={{ color: 'var(--warning)' }}>
                  Sin documento cargado. Podes agregarlo en la ficha del cliente.
                </span>
              )}
            </div>
          )}
        </div>

        <div className="ui-card" style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="campo-label" htmlFor="p-vig">Validez (dias)</label>
              <input id="p-vig" style={inputStyle} inputMode="numeric"
                value={presupuesto.vigencia_dias ?? 15}
                onChange={(e) => cambiar('vigencia_dias', e.target.value)} />
            </div>
            <div>
              <label className="campo-label" htmlFor="p-iva">IVA %</label>
              <select id="p-iva" style={inputStyle} value={presupuesto.iva_pct ?? 0}
                onChange={(e) => cambiar('iva_pct', e.target.value)}>
                <option value="0">No discrimina</option>
                <option value="10.5">10,5 %</option>
                <option value="21">21 %</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="campo-label" htmlFor="p-rep">Reparacion</label>
              <select id="p-rep" style={inputStyle} value={presupuesto.reparacion_id ?? presupuesto.reparacion?.id ?? ''}
                onChange={(e) => cambiar('reparacion_id', e.target.value)}>
                <option value="">Ninguna</option>
                {reparaciones.map((r) => <option key={r.id} value={r.id}>Orden N° {r.numero}</option>)}
              </select>
            </div>
          </div>
          {vence && (
            <div style={{ marginTop: '9px', fontSize: '0.82rem', color: 'var(--text-light)' }}>
              Vale hasta el {vence.toLocaleDateString('es-AR')}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Renglones ya cargados ---------------- */}
      <div className="ui-card" style={{ padding: esMobile ? '14px' : '20px', marginBottom: '16px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '1.05rem' }}>Detalle</h3>

        {items.length === 0 ? (
          <div className="vacio" style={{ padding: '26px 16px' }}>
            <ListPlus size={22} />
            <div>Todavia no cargaste ningun trabajo.</div>
          </div>
        ) : (
          <ul className="lista" style={{ gap: '8px' }}>
            {items.map((it, i) => (
              <li key={`${it.id ?? 'n'}-${i}`} className="fila"
                style={{
                  boxShadow: 'none',
                  borderColor: renglon.indice === i ? 'var(--accent)' : 'var(--border)',
                }}>
                <div className="fila-link" style={{ padding: '12px 92px 12px 13px', cursor: 'default' }}>
                  <div className="fila-encabezado">
                    <span className="fila-titulo" style={{ whiteSpace: 'normal' }}>{it.descripcion}</span>
                  </div>
                  <div className="fila-sub">
                    {Number(it.cantidad)} × {pesos(it.precio_unit)}
                    <strong style={{ color: 'var(--text-main)', marginLeft: '8px' }}>
                      = {pesos(importeDe(it))}
                    </strong>
                  </div>
                </div>

                <div className="fila-acciones">
                  <button type="button" className="menu-acciones__boton"
                    aria-label={`Editar ${it.descripcion}`} onClick={() => editarRenglon(i)}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" className="menu-acciones__boton"
                    aria-label={`Quitar ${it.descripcion}`} onClick={() => quitarRenglon(i)}
                    style={{ color: 'var(--danger)' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* ---------------- Alta de un renglon ---------------- */}
        <div style={{
          marginTop: '14px', paddingTop: '14px',
          borderTop: '1px solid var(--border)',
        }}>
          <div className="campo-label">
            {editandoRenglon ? `Editando el renglon ${renglon.indice + 1}` : 'Agregar un trabajo'}
          </div>

          <div style={{ position: 'relative', marginBottom: '9px' }}>
            <div style={{ display: 'flex', gap: '7px' }}>
              <input ref={campoDescripcion} style={inputStyle} value={renglon.descripcion}
                aria-label="Descripcion del trabajo"
                onChange={(e) => setRenglon((r) => ({ ...r, descripcion: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmarRenglon(); } }}
                placeholder="Ej: Rebobinado de motor monofasico" />
              <button type="button" onClick={() => setBuscando((v) => !v)}
                className={`icono-btn${buscando ? ' icono-btn--activo' : ''}`}
                aria-label="Buscar en la lista de precios" aria-expanded={buscando}>
                <Search size={16} />
              </button>
            </div>

            {buscando && (
              <div style={{
                position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0,
                marginTop: '4px', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '10px', maxHeight: '230px', overflowY: 'auto',
                boxShadow: 'var(--shadow-strong)',
              }}>
                {catalogo.length === 0 ? (
                  <div style={{ padding: '14px', fontSize: '0.86rem', color: 'var(--text-light)' }}>
                    La lista de precios esta vacia. Cargala desde{' '}
                    <Link to="/sistema/catalogo" style={{ color: 'var(--accent)', fontWeight: 600 }}>Lista de precios</Link>.
                  </div>
                ) : catalogo.map((c) => (
                  <button key={c.id} type="button" onClick={() => elegirDelCatalogo(c)}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', width: '100%', textAlign: 'left', padding: '11px 13px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'inherit', fontSize: '0.9rem' }}>
                    <span>{c.descripcion}</span>
                    <strong style={{ whiteSpace: 'nowrap' }}>{pesos(c.precio)}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr 1fr' : '110px 150px 1fr', gap: '9px', alignItems: 'end' }}>
            <div>
              <label className="campo-label" htmlFor="r-cant">Cantidad</label>
              <input id="r-cant" style={inputStyle} inputMode="decimal" value={renglon.cantidad}
                onChange={(e) => setRenglon((r) => ({ ...r, cantidad: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmarRenglon(); } }} />
            </div>
            <div>
              <label className="campo-label" htmlFor="r-precio">Precio unitario</label>
              <input id="r-precio" style={inputStyle} inputMode="decimal" value={renglon.precio_unit}
                onChange={(e) => setRenglon((r) => ({ ...r, precio_unit: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmarRenglon(); } }}
                placeholder="0" />
            </div>
            <div style={{
              gridColumn: esMobile ? 'span 2' : 'auto',
              display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center',
            }}>
              {(Number(renglon.cantidad) > 0 && Number(renglon.precio_unit) > 0) && (
                <span className="importe" style={{ marginRight: 'auto', color: 'var(--text-light)' }}>
                  {pesos(importeDe(renglon))}
                </span>
              )}
              {editandoRenglon && (
                <button type="button" className="btn btn-secondary"
                  onClick={() => { setRenglon(RENGLON_VACIO()); setAvisoRenglon(''); }}>
                  <X size={15} /> Cancelar
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={confirmarRenglon}>
                {editandoRenglon ? <><Check size={15} /> Guardar</> : <><Plus size={15} /> Agregar</>}
              </button>
            </div>
          </div>

          {avisoRenglon && (
            <div style={{ marginTop: '8px', fontSize: '0.84rem', color: 'var(--danger)' }}>
              {avisoRenglon}
            </div>
          )}
        </div>

        {/* ---------------- Totales ---------------- */}
        <div style={{ marginTop: '18px', borderTop: '1px solid var(--border)', paddingTop: '14px', display: 'grid', gap: '8px', maxWidth: '340px', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal</span><strong>{pesos(totales.subtotal)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <span>Descuento</span>
            <input style={{ ...inputStyle, width: '130px', textAlign: 'right' }} inputMode="decimal"
              aria-label="Descuento"
              value={presupuesto.descuento ?? 0}
              onChange={(e) => cambiar('descuento', e.target.value)} />
          </div>
          {Number(presupuesto.iva_pct) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>IVA {presupuesto.iva_pct}%</span><strong>{pesos(totales.iva)}</strong>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 800, borderTop: '1px solid var(--border)', paddingTop: '9px' }}>
            <span>Total</span><span>{pesos(totales.total)}</span>
          </div>
        </div>
      </div>

      <div className="ui-card" style={{ padding: '16px', marginBottom: '16px' }}>
        <label className="campo-label" htmlFor="p-notas">Notas para el cliente</label>
        <textarea id="p-notas" rows={3} style={{ ...inputStyle, resize: 'vertical' }}
          value={presupuesto.notas ?? ''}
          onChange={(e) => cambiar('notas', e.target.value)}
          placeholder="Ej: No incluye traslado. Plazo de entrega estimado 5 dias habiles." />
      </div>

      {config && !config.cuit && (
        <Alert variant="warning" className="mb-3">
          Todavia no cargaste el CUIT del taller. Va en el encabezado del PDF:
          completalo en <Link to="/sistema/ajustes" style={{ color: 'inherit', fontWeight: 700 }}>Ajustes</Link>.
        </Alert>
      )}

      <div style={{ display: 'flex', gap: '9px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {presupuesto.id && (
          <>
            <button type="button" onClick={copiarLink} className="btn btn-secondary">
              {copiado ? <Check size={15} /> : <Share2 size={15} />}
              {copiado ? 'Link copiado' : 'Copiar link'}
            </button>
            <Button variant="secondary" onClick={descargarPdf} isLoading={generandoPdf}>
              <FileDown size={15} /> PDF
            </Button>
          </>
        )}
        <Button variant="primary" size="lg" onClick={guardar} isLoading={guardando}>
          <Save size={16} /> Guardar
        </Button>
      </div>
    </div>
  );
};

export default PresupuestoForm;
