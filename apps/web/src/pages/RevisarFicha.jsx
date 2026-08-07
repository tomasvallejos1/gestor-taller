import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Check, Trash2, ZoomIn, AlertTriangle, Plus, X, Info,
} from 'lucide-react';
import Modal from '../components/Modal';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { useEsMobile } from '../lib/useMediaQuery';
import {
  obtenerExtraccion, confirmarExtraccion, descartarExtraccion,
  urlDeExtraccion, aFormulario, COLOR_CONFIANZA, ETIQUETA_CONFIANZA,
} from '../lib/extraccion';
import { revisarPlausibilidad } from '@shared/parseo.js';

const ETIQUETA_CIRCUITO = { arranque: 'Arranque', trabajo: 'Trabajo' };

/**
 * Revision de una ficha leida por IA.
 *
 * Se usa embebida dentro del alta de motor: el `id` puede venir por
 * prop (flujo nuevo) o por la ruta. `alSalir` es lo que se hace al
 * descartar o al volver; por defecto se vuelve al listado de motores.
 */
const RevisarFicha = ({ id: idProp, alSalir }) => {
  const { id: idRuta } = useParams();
  const id = idProp ?? idRuta;
  const navigate = useNavigate();
  const esMobile = useEsMobile();

  const [extraccion, setExtraccion] = useState(null);
  const [urlImagen, setUrlImagen] = useState(null);
  const [form, setForm] = useState(null);
  const [circuitos, setCircuitos] = useState([]);
  const [aislaciones, setAislaciones] = useState([]);
  const [confianza, setConfianza] = useState({});
  const [fuente, setFuente] = useState({});
  const [tocados, setTocados] = useState({});

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [modalGuardar, setModalGuardar] = useState(false);
  const [modalDescartar, setModalDescartar] = useState(false);
  const [ampliada, setAmpliada] = useState(false);

  useEffect(() => {
    let vigente = true;
    obtenerExtraccion(id)
      .then(async (e) => {
        if (!vigente) return;
        if (!e) { setError('No encontramos esa carga.'); return; }
        setExtraccion(e);

        const mapeado = aFormulario(e.datos_json);
        setForm(mapeado.form);
        setCircuitos(mapeado.circuitos);
        setAislaciones(mapeado.aislaciones ?? []);
        setConfianza(mapeado.confianza);
        setFuente(mapeado.fuente);

        try {
          setUrlImagen(await urlDeExtraccion(e.storage_path));
        } catch { /* la ficha se puede revisar sin la vista previa */ }
      })
      .catch((e) => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [id]);

  const cambiar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setTocados((t) => ({ ...t, [campo]: true }));
  };

  const cambiarAislacion = (i, campo, valor) => {
    setAislaciones((as) => as.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)));
    // Editado a mano: se apaga el borde de confianza, ya lo miro alguien.
    setTocados((t) => ({ ...t, [`aislacion_${i}`]: true }));
  };

  const agregarAislacion = () => setAislaciones((as) => [
    ...as, { descripcion: '', largo_mm: '', ancho_mm: '', cantidad: '' },
  ]);

  const quitarAislacion = (i) => setAislaciones((as) => (as.length > 1
    ? as.filter((_, j) => j !== i)
    : [{ descripcion: '', largo_mm: '', ancho_mm: '', cantidad: '' }]));

  const cambiarCircuito = (tipo, campo, valor) => {
    setCircuitos((cs) => cs.map((c) => (c.tipo === tipo ? { ...c, [campo]: valor } : c)));
    setTocados((t) => ({ ...t, [`circuito_${tipo}`]: true }));
  };

  const cambiarSeccion = (tipo, i, campo, valor) => {
    setCircuitos((cs) => cs.map((c) => (c.tipo !== tipo ? c : {
      ...c,
      secciones: c.secciones.map((s, j) => (j === i ? { ...s, [campo]: valor } : s)),
    })));
    setTocados((t) => ({ ...t, [`circuito_${tipo}`]: true }));
  };

  const agregarSeccion = (tipo) => setCircuitos((cs) => cs.map((c) => (c.tipo !== tipo ? c : {
    ...c, secciones: [...c.secciones, { paso: '', vueltas: '', vueltas_tachadas: '' }],
  })));

  const quitarSeccion = (tipo, i) => setCircuitos((cs) => cs.map((c) => (c.tipo !== tipo ? c : {
    ...c,
    secciones: c.secciones.length > 1 ? c.secciones.filter((_, j) => j !== i) : c.secciones,
  })));

  const avisos = useMemo(() => (form ? revisarPlausibilidad({
    ranuras: form.ranuras ? Number(form.ranuras) : null,
    rpm: form.rpm ? Number(form.rpm) : null,
    alambreMm: circuitos[0]?.alambre_mm ? Number(circuitos[0].alambre_mm) : null,
    secciones: circuitos.flatMap((c) => c.secciones.map((s) => ({
      paso: s.paso ? Number(s.paso) : null,
      vueltas: s.vueltas ? Number(s.vueltas) : null,
    }))),
  }) : []), [form, circuitos]);

  const dudosos = useMemo(
    () => Object.entries(confianza).filter(([k, v]) => v === 'baja' && !tocados[k]),
    [confianza, tocados],
  );

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      const limpios = circuitos
        .filter((c) => c.alambre_mm || c.alambre_kg || c.abertura_mm
          || c.secciones.some((s) => s.paso || s.vueltas))
        .map((c) => ({ ...c, secciones: c.secciones.filter((s) => s.paso !== '' || s.vueltas !== '') }));

      const aislLimpias = aislaciones.filter(
        (a) => a.largo_mm || a.ancho_mm || a.cantidad || a.descripcion.trim(),
      );

      const motorId = await confirmarExtraccion(id, {
        ...form, circuitos: limpios, aislaciones: aislLimpias,
      });
      navigate(`/sistema/motores/ver/${motorId}`);
    } catch (e) {
      setError(e.message ?? 'No se pudo guardar la ficha.');
      setModalGuardar(false);
    } finally {
      setGuardando(false);
    }
  };

  const volver = () => (alSalir ? alSalir() : navigate('/sistema/motores'));

  const descartar = async () => {
    try {
      await descartarExtraccion(id, extraccion.storage_path);
      volver();
    } catch (e) {
      setError(e.message ?? 'No se pudo descartar.');
      setModalDescartar(false);
    }
  };

  if (cargando) {
    return <div style={{ padding: '48px' }}><Spinner label="Cargando la lectura..." size="lg" centered /></div>;
  }

  if (error && !form) {
    return (
      <div style={{ padding: '32px' }}>
        <Alert variant="error">{error}</Alert>
        <button type="button" onClick={volver} className="btn btn-secondary" style={{ marginTop: '16px' }}>
          <ArrowLeft size={15} /> Volver
        </button>
      </div>
    );
  }

  const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-light)' };
  const baseInput = { width: '100%', padding: '10px 12px', borderRadius: '9px', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '0.98rem', color: 'inherit', background: 'var(--surface)' };

  // El borde de color es lo que dirige la mirada: rojo primero.
  const inputCon = (campo) => {
    const c = tocados[campo] ? null : confianza[campo];
    return {
      ...baseInput,
      border: c ? `2px solid ${COLOR_CONFIANZA[c]}` : '1px solid var(--border)',
    };
  };

  const Campo = ({ etiqueta, campo, ancho, ...props }) => (
    <div style={ancho ? { gridColumn: `span ${ancho}` } : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '6px' }}>
        <label style={labelStyle} htmlFor={`r-${campo}`}>{etiqueta}</label>
        {confianza[campo] && !tocados[campo] && (
          <span style={{ fontSize: '0.64rem', fontWeight: 700, color: COLOR_CONFIANZA[confianza[campo]], textTransform: 'uppercase' }}>
            {ETIQUETA_CONFIANZA[confianza[campo]]}
          </span>
        )}
      </div>
      <input
        id={`r-${campo}`}
        style={inputCon(campo)}
        value={form[campo] ?? ''}
        onChange={(e) => cambiar(campo, e.target.value)}
        {...props}
      />
      {/* Lo que el modelo dice haber LEIDO. Sin esto, verificar un campo
          dudoso obliga a buscarlo a ojo en la foto. */}
      {fuente[campo] && (
        <div style={{ fontSize: '0.74rem', color: 'var(--text-light)', marginTop: '4px', fontStyle: 'italic' }}>
          leyo: “{fuente[campo]}”
        </div>
      )}
    </div>
  );

  const grilla = (min = '150px') => ({
    display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`, gap: '14px',
  });

  const panelImagen = (
    <div style={{ position: esMobile ? 'static' : 'sticky', top: '16px' }}>
      <div className="ui-card" style={{ padding: '12px' }}>
        {urlImagen ? (
          <>
            <button type="button" onClick={() => setAmpliada(true)}
              style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', borderRadius: '10px', overflow: 'hidden' }}>
              <img src={urlImagen} alt="Ficha de papel"
                style={{ width: '100%', display: 'block', borderRadius: '10px' }} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-light)' }}>
              <ZoomIn size={14} /> Tocar para ampliar
            </div>
          </>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>
            No se pudo cargar la vista previa.
          </div>
        )}
      </div>

      {extraccion?.datos_json?._modelo && (
        <div style={{ marginTop: '10px', fontSize: '0.76rem', color: 'var(--text-light)', textAlign: 'center' }}>
          Leido por {extraccion.datos_json._proveedor} · {extraccion.datos_json._modelo}
        </div>
      )}
    </div>
  );

  const panelDatos = (
    <div>
      <Alert variant="info" className="mb-3">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <Info size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            Esto es una <strong>lectura automatica sin confirmar</strong>. Compara cada
            dato contra la foto antes de guardar. Los campos con borde de color son los
            que el sistema no leyo con seguridad.
          </div>
        </div>
      </Alert>

      {dudosos.length > 0 && (
        <Alert variant="warning" className="mb-3">
          Hay <strong>{dudosos.length}</strong> dato(s) que el sistema marco como dudosos y
          todavia no revisaste.
        </Alert>
      )}

      {avisos.length > 0 && (
        <Alert variant="warning" className="mb-3">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{avisos.map((a) => <div key={a}>{a}</div>)}</div>
          </div>
        </Alert>
      )}

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

      <div className="ui-card" style={{ padding: esMobile ? '16px' : '22px' }}>
        <h3 style={{ marginTop: 0, fontSize: '1.05rem' }}>Identificacion</h3>
        <div style={grilla()}>
          <Campo etiqueta="Descripcion *" campo="descripcion" ancho={esMobile ? undefined : 2} />
          <Campo etiqueta="Cliente (de la ficha)" campo="cliente" />
          <Campo etiqueta="Marca" campo="marca" />
          <Campo etiqueta="Modelo" campo="modelo" />
          <Campo etiqueta="Aplicacion" campo="aplicacion" />
        </div>

        <h3 style={{ fontSize: '1.05rem', marginTop: '24px' }}>Datos electricos</h3>
        <div style={grilla('130px')}>
          <Campo etiqueta="Potencia" campo="hp_texto" />
          <Campo etiqueta="Amperaje" campo="amperaje_texto" />
          <Campo etiqueta="Capacitor" campo="capacitor_texto" />
          <Campo etiqueta="Ranuras" campo="ranuras" inputMode="numeric" />
          <Campo etiqueta="RPM" campo="rpm" inputMode="numeric" />
        </div>

        <h3 style={{ fontSize: '1.05rem', marginTop: '24px' }}>Medidas (mm)</h3>
        <div style={grilla('130px')}>
          <Campo etiqueta="Largo" campo="largo_mm" inputMode="decimal" />
          <Campo etiqueta="Ø interior" campo="diam_int_mm" inputMode="decimal" />
          <Campo etiqueta="Ø exterior" campo="diam_ext_mm" inputMode="decimal" />
        </div>

        <h3 style={{ fontSize: '1.05rem', marginTop: '24px' }}>Aislaciones</h3>
        <div style={{ display: 'grid', gap: '8px' }}>
          {aislaciones.map((a, i) => {
            const conf = tocados[`aislacion_${i}`] ? null : confianza[`aislacion_${i}`];
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1.3fr 90px 90px 90px 34px',
                gap: '7px', alignItems: 'center',
                border: conf ? `2px solid ${COLOR_CONFIANZA[conf]}` : '1px solid var(--border)',
                borderRadius: '10px', padding: '8px',
              }}>
                <input style={{ ...baseInput, padding: '9px 10px', border: '1px solid var(--border)' }} placeholder="Que aisla" value={a.descripcion}
                  aria-label={`Aislacion ${i + 1}: que aisla`}
                  onChange={(e) => cambiarAislacion(i, 'descripcion', e.target.value)} />
                <input style={{ ...baseInput, padding: '9px 10px', border: '1px solid var(--border)' }} inputMode="decimal" placeholder="Largo" value={a.largo_mm}
                  aria-label={`Aislacion ${i + 1}: largo`}
                  onChange={(e) => cambiarAislacion(i, 'largo_mm', e.target.value)} />
                <input style={{ ...baseInput, padding: '9px 10px', border: '1px solid var(--border)' }} inputMode="decimal" placeholder="Ancho" value={a.ancho_mm}
                  aria-label={`Aislacion ${i + 1}: ancho`}
                  onChange={(e) => cambiarAislacion(i, 'ancho_mm', e.target.value)} />
                <input style={{ ...baseInput, padding: '9px 10px', border: '1px solid var(--border)' }} inputMode="numeric" placeholder="Cant." value={a.cantidad}
                  aria-label={`Aislacion ${i + 1}: cantidad`}
                  onChange={(e) => cambiarAislacion(i, 'cantidad', e.target.value)} />
                <button type="button" onClick={() => quitarAislacion(i)}
                  aria-label={`Quitar aislacion ${i + 1}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '6px' }}>
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={agregarAislacion} className="btn btn-secondary"
          style={{ marginTop: '9px', fontSize: '0.84rem', fontWeight: 600 }}>
          <Plus size={14} /> Agregar aislacion
        </button>

        <h3 style={{ fontSize: '1.05rem', marginTop: '24px' }}>Bobinado</h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          {circuitos.map((c) => {
            const conf = tocados[`circuito_${c.tipo}`] ? null : confianza[`circuito_${c.tipo}`];
            return (
              <div key={c.tipo} style={{
                border: conf ? `2px solid ${COLOR_CONFIANZA[conf]}` : '1px solid var(--border)',
                borderRadius: '12px', padding: '14px', background: 'var(--surface-soft)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
                    {ETIQUETA_CIRCUITO[c.tipo]}
                  </h4>
                  {conf && (
                    <span style={{ fontSize: '0.64rem', fontWeight: 700, color: COLOR_CONFIANZA[conf], textTransform: 'uppercase' }}>
                      {ETIQUETA_CONFIANZA[conf]}
                    </span>
                  )}
                </div>

                {fuente[`circuito_${c.tipo}`] && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--danger)', marginBottom: '10px' }}>
                    {fuente[`circuito_${c.tipo}`]}
                  </div>
                )}

                <div style={{ ...grilla('100px'), marginBottom: '12px' }}>
                  <div><label style={labelStyle}>Alambre ⌀</label>
                    <input style={baseInput} inputMode="decimal" value={c.alambre_mm}
                      onChange={(e) => cambiarCircuito(c.tipo, 'alambre_mm', e.target.value)} /></div>
                  <div><label style={labelStyle}>Hilos</label>
                    <input style={baseInput} inputMode="numeric" value={c.alambre_hilos}
                      onChange={(e) => cambiarCircuito(c.tipo, 'alambre_hilos', e.target.value)} /></div>
                  <div><label style={labelStyle}>Peso kg</label>
                    <input style={baseInput} inputMode="decimal" value={c.alambre_kg}
                      onChange={(e) => cambiarCircuito(c.tipo, 'alambre_kg', e.target.value)} /></div>
                  <div><label style={labelStyle}>Abertura</label>
                    <input style={baseInput} inputMode="decimal" value={c.abertura_mm}
                      onChange={(e) => cambiarCircuito(c.tipo, 'abertura_mm', e.target.value)} /></div>
                  <div><label style={labelStyle}>Relacion</label>
                    <input style={baseInput} value={c.abertura_fraccion}
                      onChange={(e) => cambiarCircuito(c.tipo, 'abertura_fraccion', e.target.value)} /></div>
                </div>

                <label style={labelStyle}>Secciones (paso / vueltas / tachado)</label>
                <div style={{ display: 'grid', gap: '7px' }}>
                  {c.secciones.map((s, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 1fr 34px', gap: '7px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-light)', fontWeight: 700 }}>{i + 1}</span>
                      <input style={{ ...baseInput, padding: '8px 9px' }} inputMode="numeric" value={s.paso}
                        onChange={(e) => cambiarSeccion(c.tipo, i, 'paso', e.target.value)} />
                      <input style={{ ...baseInput, padding: '8px 9px' }} inputMode="numeric" value={s.vueltas}
                        onChange={(e) => cambiarSeccion(c.tipo, i, 'vueltas', e.target.value)} />
                      <input style={{ ...baseInput, padding: '8px 9px', opacity: 0.7 }} inputMode="numeric" value={s.vueltas_tachadas}
                        onChange={(e) => cambiarSeccion(c.tipo, i, 'vueltas_tachadas', e.target.value)} />
                      {c.secciones.length > 1 ? (
                        <button type="button" onClick={() => quitarSeccion(c.tipo, i)}
                          aria-label={`Quitar seccion ${i + 1}`}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '7px' }}>
                          <X size={14} />
                        </button>
                      ) : <span />}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => agregarSeccion(c.tipo)}
                  className="btn btn-secondary" style={{ marginTop: '9px', fontSize: '0.82rem' }}>
                  <Plus size={13} /> Seccion
                </button>
              </div>
            );
          })}
        </div>

        <h3 style={{ fontSize: '1.05rem', marginTop: '24px' }}>Observaciones</h3>
        <textarea rows={3} style={{ ...baseInput, resize: 'vertical' }}
          value={form.observaciones ?? ''}
          onChange={(e) => cambiar('observaciones', e.target.value)} />
        {fuente.observaciones && (
          <div style={{ fontSize: '0.74rem', color: 'var(--text-light)', marginTop: '4px', fontStyle: 'italic' }}>
            leyo: “{fuente.observaciones}”
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary"
          onClick={() => setModalDescartar(true)}
          style={{ color: 'var(--danger)' }}>
          <Trash2 size={15} /> Descartar
        </button>
        <Button variant="primary" size="lg" isLoading={guardando}
          onClick={() => setModalGuardar(true)}>
          <Check size={16} /> Guardar ficha
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button type="button" onClick={volver} className="btn btn-secondary" style={{ fontWeight: 600 }}>
          <ArrowLeft size={15} /> Volver
        </button>
        <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Revisar lectura</h2>
      </div>

      {esMobile ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {panelImagen}
          {panelDatos}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: '20px', alignItems: 'start' }}>
          {panelImagen}
          {panelDatos}
        </div>
      )}

      {ampliada && urlImagen && (
        <button
          type="button"
          onClick={() => setAmpliada(false)}
          aria-label="Cerrar imagen"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, border: 'none',
            background: 'rgba(0,0,0,0.92)', cursor: 'zoom-out', padding: '16px',
            display: 'grid', placeItems: 'center', overflow: 'auto',
          }}
        >
          <img src={urlImagen} alt="Ficha ampliada"
            style={{ maxWidth: 'none', width: 'auto', minWidth: '100%', display: 'block' }} />
        </button>
      )}

      <Modal
        isOpen={modalGuardar}
        type="info"
        title="Guardar la ficha"
        message={
          dudosos.length > 0
            ? `Quedan ${dudosos.length} dato(s) marcados como dudosos que no revisaste. `
              + 'Se guarda igual, pero conviene compararlos con la foto primero. ¿Continuar?'
            : 'Se crea la ficha con estos datos y se guarda la foto original junto a ella.'
        }
        onClose={() => setModalGuardar(false)}
        onConfirm={guardar}
        isLoading={guardando}
      />

      <Modal
        isOpen={modalDescartar}
        type="danger"
        title="Descartar la lectura"
        message="Se elimina la lectura y la foto. No se crea ninguna ficha."
        onClose={() => setModalDescartar(false)}
        onConfirm={descartar}
      />
    </div>
  );
};

export default RevisarFicha;
