import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Pencil, X } from 'lucide-react';
import Modal from '../components/Modal';
import Alert from '../components/ui/Alert';
import Esqueleto from '../components/Esqueleto';
import Button from '../components/ui/Button';
import { useEsMobile } from '../lib/useMediaQuery';
import {
  listarCatalogo, guardarItemCatalogo, eliminarItemCatalogo, pesos,
} from '../lib/presupuestos';

const VACIO = { id: null, codigo: '', descripcion: '', precio: '', unidad: 'u', activo: true };

const Catalogo = () => {
  const esMobile = useEsMobile();
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setItems(await listarCatalogo({ soloActivos: false }));
    } catch (e) {
      setError(e.message ?? 'No pudimos cargar la lista.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await guardarItemCatalogo(editando);
      setEditando(null);
      await cargar();
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', boxSizing: 'border-box', fontSize: 'var(--txt-base)', fontFamily: 'inherit' };
  const labelStyle = { display: 'block', fontSize: 'var(--txt-xs)', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-light)' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <Link to="/sistema/presupuestos" className="btn btn-secondary" style={{ textDecoration: 'none', fontWeight: 600 }}>
          <ArrowLeft size={15} /> Volver
        </Link>
        <h2 style={{ margin: 0, fontSize: 'var(--txt-xl)' }}>Lista de precios</h2>
      </div>

      <p style={{ color: 'var(--text-light)', fontSize: 'var(--txt-sm)', marginTop: 0, marginBottom: '18px' }}>
        Lo que cargues aca aparece como sugerencia al armar un presupuesto. El precio se
        copia al renglon: cambiar un precio de esta lista no altera presupuestos ya hechos.
      </p>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

      {editando ? (
        <form onSubmit={guardar} className="ui-card" style={{ padding: '20px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--txt-md)' }}>
              {editando.id ? 'Editar item' : 'Nuevo item'}
            </h3>
            <button type="button" onClick={() => setEditando(null)} aria-label="Cerrar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: '8px' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr' : '110px 1fr 130px 90px', gap: '12px' }}>
            <div>
              <label style={labelStyle} htmlFor="ct-cod">Codigo</label>
              <input id="ct-cod" style={inputStyle} value={editando.codigo ?? ''}
                onChange={(e) => setEditando({ ...editando, codigo: e.target.value })} placeholder="Opcional" />
            </div>
            <div>
              <label style={labelStyle} htmlFor="ct-desc">Descripcion</label>
              <input id="ct-desc" style={inputStyle} required value={editando.descripcion}
                onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })}
                placeholder="Ej: Rebobinado de motor monofasico hasta 2 HP" />
            </div>
            <div>
              <label style={labelStyle} htmlFor="ct-precio">Precio</label>
              <input id="ct-precio" style={inputStyle} inputMode="decimal" value={editando.precio}
                onChange={(e) => setEditando({ ...editando, precio: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="ct-uni">Unidad</label>
              <input id="ct-uni" style={inputStyle} value={editando.unidad ?? 'u'}
                onChange={(e) => setEditando({ ...editando, unidad: e.target.value })} />
            </div>
          </div>

          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', minHeight: '44px' }}>
              <input type="checkbox" checked={editando.activo !== false} style={{ width: 18, height: 18 }}
                onChange={(e) => setEditando({ ...editando, activo: e.target.checked })} />
              <span style={{ fontSize: 'var(--txt-sm)' }}>Disponible para usar</span>
            </label>
            <Button type="submit" variant="primary" isLoading={guardando}>Guardar</Button>
          </div>
        </form>
      ) : (
        <Button variant="primary" onClick={() => setEditando({ ...VACIO })} style={{ marginBottom: '18px' }}>
          <Plus size={16} /> Agregar item
        </Button>
      )}

      {cargando ? (
        <Esqueleto tipo="lista" />
      ) : items.length === 0 ? (
        <div className="ui-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>
          La lista esta vacia. Cargá los trabajos que hacés seguido y sus precios.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {items.map((it) => (
            <div key={it.id} className="ui-card" style={{
              padding: '14px', display: 'flex', justifyContent: 'space-between',
              gap: '12px', alignItems: 'center', flexWrap: 'wrap',
              opacity: it.activo ? 1 : 0.5,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700 }}>
                  {it.codigo && <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>{it.codigo} · </span>}
                  {it.descripcion}
                </div>
                <div style={{ fontSize: 'var(--txt-xs)', color: 'var(--text-light)' }}>
                  por {it.unidad}{!it.activo ? ' · no disponible' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <strong style={{ fontSize: 'var(--txt-md)', whiteSpace: 'nowrap' }}>{pesos(it.precio)}</strong>
                <button type="button" onClick={() => setEditando({ ...VACIO, ...it })}
                  aria-label={`Editar ${it.descripcion}`}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'inherit', padding: '10px', minHeight: '44px', minWidth: '44px' }}>
                  <Pencil size={15} />
                </button>
                <button type="button" onClick={() => setABorrar(it)}
                  aria-label={`Eliminar ${it.descripcion}`}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--danger)', padding: '10px', minHeight: '44px', minWidth: '44px' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(aBorrar)}
        type="danger"
        title="Eliminar de la lista"
        message={`Se elimina "${aBorrar?.descripcion}". Los presupuestos que ya lo usan no cambian.`}
        onClose={() => setABorrar(null)}
        onConfirm={async () => {
          try { await eliminarItemCatalogo(aBorrar.id); await cargar(); }
          catch (e) { setError(e.message); }
          setABorrar(null);
        }}
      />
    </div>
  );
};

export default Catalogo;
