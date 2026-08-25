import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, X, Save, FileDown, Share2, Check, Search, Pencil, Trash2, ListPlus,
} from 'lucide-react';
import Alert from '../components/ui/Alert';
import Esqueleto from '../components/Esqueleto';
import Button from '../components/ui/Button';
import { useEsMobile } from '../lib/useMediaQuery';
import { listarCatalogo, calcularTotales, pesos } from '../lib/presupuestos';
import { copiarTexto } from '../lib/navegador';
import {
  obtenerRemito, actualizarRemito, guardarItems, generarPdf, MEDIOS_PAGO,
} from '../lib/remitos';

const RENGLON_VACIO = () => ({
  indice: null, catalogo_item_id: null, descripcion: '', cantidad: '1', precio_unit: '',
});

const RemitoForm = () => {
  const { id } = useParams();
  const esMobile = useEsMobile();

  const [remito, setRemito] = useState(null);
  const [items, setItems] = useState([]);
  const [renglon, setRenglon] = useState(RENGLON_VACIO());
  const [catalogo, setCatalogo] = useState([]);

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
      const [r, cat] = await Promise.all([obtenerRemito(id), listarCatalogo()]);
      if (!r) { setError('No encontramos ese remito.'); return; }
      setRemito(r);
      setItems(r.items ?? []);
      setCatalogo(cat);
    } catch (e) {
      setError(e.message ?? 'No se pudo cargar.');
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const totales = useMemo(() => calcularTotales({
    items, descuento: remito?.descuento, ivaPct: remito?.iva_pct,
  }), [items, remito?.descuento, remito?.iva_pct]);

  const cambiar = (campo, valor) => setRemito((r) => ({ ...r, [campo]: valor }));

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
    setRenglon((r) => {
      if (r.indice === null) return r;
      if (r.indice === i) return RENGLON_VACIO();
      return r.indice > i ? { ...r, indice: r.indice - 1 } : r;
    });
  };

  const elegirDelCatalogo = (item) => {
    setRenglon((r) => ({
      ...r, catalogo_item_id: item.id, descripcion: item.descripcion, precio_unit: String(item.precio),
    }));
    setBuscando(false);
    setAvisoRenglon('');
  };

  const guardar = async () => {
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      await actualizarRemito(remito.id, remito);
      await guardarItems(remito.id, items);
      const completo = await obtenerRemito(remito.id);
      setRemito(completo);
      setItems(completo.items ?? []);
      setAviso('Remito guardado.');
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
      const { url } = await generarPdf(remito.id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const copiarLink = async () => {
    const url = `${window.location.origin}/r/${remito.token_publico}`;
    if (await copiarTexto(url)) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } else {
      setError(`No se pudo copiar automáticamente. El link es: ${url}`);
    }
  };

  if (cargando) {
    return <Esqueleto tipo="formulario" />;
  }
  if (!remito) {
    return (
      <div style={{ padding: '32px' }}>
        <Alert variant="error">{error || 'No encontrado.'}</Alert>
        <Link to="/sistema/reparaciones" className="btn btn-secondary" style={{ marginTop: 16, textDecoration: 'none' }}>
          <ArrowLeft size={15} /> Volver
        </Link>
      </div>
    );
  }

  const editandoRenglon = renglon.indice !== null;
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '9px',
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'inherit', boxSizing: 'border-box', fontSize: 'var(--txt-base)', fontFamily: 'inherit',
  };

  return (
    <div>
      <div className="pantalla-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Link to={`/sistema/reparaciones/${remito.reparacion_id}`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={15} /> Volver a la orden
          </Link>
          <h2 className="pantalla-titulo">
            Remito {String(remito.punto_venta ?? 1).padStart(4, '0')}-{String(remito.numero).padStart(8, '0')}
          </h2>
        </div>
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}
      {aviso ? <Alert variant="success" className="mb-3">{aviso}</Alert> : null}

      <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr' : '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
        <div className="ui-card" style={{ padding: '16px' }}>
          <label className="campo-label" htmlFor="rm-cliente">Cliente</label>
          <div style={{ fontWeight: 700 }}>{remito.cliente?.nombre ?? 'Consumidor final'}</div>
          <div style={{ fontSize: 'var(--txt-sm)', color: 'var(--text-light)', marginTop: '4px' }}>
            El cliente y sus datos fiscales se congelaron al emitir el remito. Se cambian desde la ficha del cliente antes de emitir uno nuevo.
          </div>
        </div>

        <div className="ui-card" style={{ padding: '16px' }}>
          <label className="campo-label" htmlFor="rm-medio">Medio de pago</label>
          <select id="rm-medio" style={inputStyle} value={remito.medio_pago ?? ''}
            onChange={(e) => cambiar('medio_pago', e.target.value)}>
            <option value="">A convenir</option>
            {MEDIOS_PAGO.map((m) => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
          </select>

          <div style={{ marginTop: '12px' }}>
            <label className="campo-label" htmlFor="rm-iva">IVA %</label>
            <select id="rm-iva" style={inputStyle} value={remito.iva_pct ?? 0}
              onChange={(e) => cambiar('iva_pct', e.target.value)}>
              <option value="0">No discrimina</option>
              <option value="10.5">10,5 %</option>
              <option value="21">21 %</option>
            </select>
          </div>
        </div>
      </div>

      <div className="ui-card" style={{ padding: esMobile ? '14px' : '20px', marginBottom: '16px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: 'var(--txt-md)' }}>Detalle</h3>

        {items.length === 0 ? (
          <div className="vacio" style={{ padding: '26px 16px' }}>
            <ListPlus size={22} />
            <div>Todavia no hay renglones cargados.</div>
          </div>
        ) : (
          <ul className="lista" style={{ gap: '8px' }}>
            {items.map((it, i) => (
              <li key={`${it.id ?? 'n'}-${i}`} className="fila"
                style={{ boxShadow: 'none', borderColor: renglon.indice === i ? 'var(--accent)' : 'var(--border)' }}>
                <div className="fila-link" style={{ padding: '12px 92px 12px 13px', cursor: 'default' }}>
                  <div className="fila-encabezado">
                    <span className="fila-titulo" style={{ whiteSpace: 'normal' }}>{it.descripcion}</span>
                  </div>
                  <div className="fila-sub">
                    {Number(it.cantidad)} × {pesos(it.precio_unit)}
                    <strong style={{ color: 'var(--text-main)', marginLeft: '8px' }}>= {pesos(importeDe(it))}</strong>
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

        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
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
                borderRadius: '10px', maxHeight: '230px', overflowY: 'auto', boxShadow: 'var(--shadow-strong)',
              }}>
                {catalogo.length === 0 ? (
                  <div style={{ padding: '14px', fontSize: 'var(--txt-sm)', color: 'var(--text-light)' }}>
                    La lista de precios esta vacia. Cargala desde{' '}
                    <Link to="/sistema/catalogo" style={{ color: 'var(--accent)', fontWeight: 600 }}>Lista de precios</Link>.
                  </div>
                ) : catalogo.map((c) => (
                  <button key={c.id} type="button" onClick={() => elegirDelCatalogo(c)}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', width: '100%', textAlign: 'left', padding: '11px 13px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'inherit', fontSize: 'var(--txt-sm)' }}>
                    <span>{c.descripcion}</span>
                    <strong style={{ whiteSpace: 'nowrap' }}>{pesos(c.precio)}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr 1fr' : '110px 150px 1fr', gap: '9px', alignItems: 'end' }}>
            <div>
              <label className="campo-label" htmlFor="rm-cant">Cantidad</label>
              <input id="rm-cant" style={inputStyle} inputMode="decimal" value={renglon.cantidad}
                onChange={(e) => setRenglon((r) => ({ ...r, cantidad: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmarRenglon(); } }} />
            </div>
            <div>
              <label className="campo-label" htmlFor="rm-precio">Precio unitario</label>
              <input id="rm-precio" style={inputStyle} inputMode="decimal" value={renglon.precio_unit}
                onChange={(e) => setRenglon((r) => ({ ...r, precio_unit: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmarRenglon(); } }}
                placeholder="0" />
            </div>
            <div style={{ gridColumn: esMobile ? 'span 2' : 'auto', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
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
            <div style={{ marginTop: '8px', fontSize: 'var(--txt-sm)', color: 'var(--danger)' }}>{avisoRenglon}</div>
          )}
        </div>

        <div style={{ marginTop: '18px', borderTop: '1px solid var(--border)', paddingTop: '14px', display: 'grid', gap: '8px', maxWidth: '340px', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal</span><strong>{pesos(totales.subtotal)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <span>Descuento</span>
            <input style={{ ...inputStyle, width: '130px', textAlign: 'right' }} inputMode="decimal"
              aria-label="Descuento" value={remito.descuento ?? 0}
              onChange={(e) => cambiar('descuento', e.target.value)} />
          </div>
          {Number(remito.iva_pct) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>IVA {remito.iva_pct}%</span><strong>{pesos(totales.iva)}</strong>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--txt-lg)', fontWeight: 800, borderTop: '1px solid var(--border)', paddingTop: '9px' }}>
            <span>Total</span><span>{pesos(totales.total)}</span>
          </div>
        </div>
      </div>

      <div className="ui-card" style={{ padding: '16px', marginBottom: '16px' }}>
        <label className="campo-label" htmlFor="rm-notas">Notas</label>
        <textarea id="rm-notas" rows={3} style={{ ...inputStyle, resize: 'vertical' }}
          value={remito.notas ?? ''} onChange={(e) => cambiar('notas', e.target.value)}
          placeholder="Ej: Se entrego con garantia de 90 dias sobre el rebobinado." />
      </div>

      {/* Compartir y descargar son acciones de despues de guardar, no
          del momento de editar: quedan en el flujo. La barra fija de
          abajo carga solo con lo que se toca a cada rato. */}
      <div className="seccion">
        <div className="seccion__cab">
          <Share2 size={17} />
          <div>
            <h3 className="seccion__titulo">Entregar al cliente</h3>
            <p className="seccion__ayuda">El PDF sale con lo ultimo que guardaste.</p>
          </div>
        </div>
        <div className="acciones" style={{ marginTop: 0 }}>
          <button type="button" onClick={copiarLink} className="btn btn-secondary">
            {copiado ? <Check size={15} /> : <Share2 size={15} />}
            {copiado ? 'Link copiado' : 'Copiar link'}
          </button>
          <Button variant="secondary" onClick={descargarPdf} isLoading={generandoPdf}>
            <FileDown size={15} /> Ver PDF
          </Button>
        </div>
      </div>

      <div className="barra-guardar">
        <Button variant="primary" size="lg" onClick={guardar} isLoading={guardando}
          className="barra-guardar__principal">
          <Save size={16} /> Guardar
        </Button>
      </div>
    </div>
  );
};

export default RemitoForm;
