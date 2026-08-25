import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, Trash2, AlertTriangle, Plus, X, Info, Image as ImagenIcono,
} from 'lucide-react';
import Modal from '../components/Modal';
import Alert from '../components/ui/Alert';
import Esqueleto from '../components/Esqueleto';
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
 *
 * SOBRE EL CELULAR
 *
 * Esta pantalla se usa parado al lado del banco de trabajo, con la ficha
 * de papel en una mano. Por eso la foto no ocupa media pantalla arriba
 * --se abre a pantalla completa cuando hace falta comparar-- y los dos
 * botones que cierran el flujo viven fijos abajo, al alcance del pulgar,
 * en vez de al final de un formulario de tres pantallas de largo.
 */

/**
 * Un campo con su borde de confianza y lo que el modelo dice haber leido.
 *
 * Vive afuera del componente a proposito. Definido adentro, React lo
 * trataba como un tipo nuevo en cada render y desmontaba el input en cada
 * tecla: se escribia una letra y el foco se perdia. En el celular eso
 * hacia la pantalla directamente inusable.
 */
const Campo = ({
  etiqueta, campo, valor, confianza, fuente, tocado, alCambiar, ancho, ...props
}) => {
  const c = tocado ? null : confianza;
  return (
    <div style={ancho ? { gridColumn: `span ${ancho}` } : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '6px' }}>
        <label className="rev-label" htmlFor={`r-${campo}`}>{etiqueta}</label>
        {c && (
          <span style={{ fontSize: 'var(--txt-xs)', fontWeight: 700, color: COLOR_CONFIANZA[c], textTransform: 'uppercase' }}>
            {ETIQUETA_CONFIANZA[c]}
          </span>
        )}
      </div>
      <input
        id={`r-${campo}`}
        className="rev-input"
        style={c ? { borderColor: COLOR_CONFIANZA[c], borderWidth: '2px' } : undefined}
        value={valor ?? ''}
        onChange={(e) => alCambiar(campo, e.target.value)}
        {...props}
      />
      {fuente && (
        <div className="rev-fuente">leyó: “{fuente}”</div>
      )}
    </div>
  );
};

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

  // Con la imagen a pantalla completa, el fondo no se scrollea.
  useEffect(() => {
    if (!ampliada) return undefined;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previo; };
  }, [ampliada]);

  const cambiar = useCallback((campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setTocados((t) => ({ ...t, [campo]: true }));
  }, []);

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

  // Cual de los dudosos toca mirar. No es un indice fijo: la lista se
  // achica sola a medida que se corrigen, asi que se usa con modulo.
  const [nDudoso, setNDudoso] = useState(0);

  const dudosos = useMemo(
    () => Object.entries(confianza).filter(([k, v]) => v === 'baja' && !tocados[k]),
    [confianza, tocados],
  );

  /**
   * Lleva al proximo campo dudoso: lo centra y le pone el foco.
   *
   * `preventScroll` en el focus porque ya scrolleo el centrado: sin eso
   * el navegador vuelve a mover la pagina para dejarlo pegado al borde,
   * justo debajo del teclado del telefono.
   */
  const irAlDudoso = () => {
    if (!dudosos.length) return;
    const [campo] = dudosos[nDudoso % dudosos.length];
    const el = document.getElementById(`r-${campo}`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.focus({ preventScroll: true });
    }
    setNDudoso((n) => n + 1);
  };

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
    return <Esqueleto tipo="formulario" />;
  }

  if (error && !form) {
    return (
      <div style={{ padding: '24px 0' }}>
        <Alert variant="error">{error}</Alert>
        <button type="button" onClick={volver} className="btn btn-secondary" style={{ marginTop: '16px' }}>
          <ArrowLeft size={15} /> Volver
        </button>
      </div>
    );
  }

  // Props comunes de cada Campo: evita repetir seis lineas por campo.
  const campoProps = (campo) => ({
    campo,
    valor: form[campo],
    confianza: confianza[campo],
    fuente: fuente[campo],
    tocado: tocados[campo],
    alCambiar: cambiar,
  });

  const verFoto = urlImagen && (
    <button type="button" onClick={() => setAmpliada(true)} className="rev-verfoto">
      <img src={urlImagen} alt="" aria-hidden="true" />
      <span>
        <strong>Ver la ficha de papel</strong>
        <small>Tocá para ampliar y comparar</small>
      </span>
      <ImagenIcono size={18} />
    </button>
  );

  const panelImagen = !esMobile && (
    <div style={{ position: 'sticky', top: '16px' }}>
      <div className="ui-card" style={{ padding: '12px' }}>
        {urlImagen ? (
          <button type="button" onClick={() => setAmpliada(true)}
            style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', borderRadius: '10px', overflow: 'hidden' }}>
            <img src={urlImagen} alt="Ficha de papel"
              style={{ width: '100%', display: 'block', borderRadius: '10px' }} />
          </button>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>
            No se pudo cargar la vista previa.
          </div>
        )}
      </div>
      {extraccion?.datos_json?._modelo && (
        <div style={{ marginTop: '10px', fontSize: 'var(--txt-xs)', color: 'var(--text-light)', textAlign: 'center' }}>
          Leído por {extraccion.datos_json._proveedor} · {extraccion.datos_json._modelo}
        </div>
      )}
    </div>
  );

  const panelDatos = (
    <div>
      {esMobile && verFoto}

      <Alert variant="info" className="mb-3">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <Info size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            Esto es una <strong>lectura automática sin confirmar</strong>. Compará cada
            dato contra la foto antes de guardar. Los campos con borde de color son los
            que el sistema no leyó con seguridad.
          </div>
        </div>
      </Alert>

      {/* El aviso lleva al campo, no solo avisa. En el celular esta
          ficha mide tres pantallas: saber que hay cuatro datos dudosos
          sin poder ir a ellos obliga a barrer el formulario entero
          buscando bordes de color. */}
      {dudosos.length > 0 && (
        <Alert variant="warning" className="mb-3">
          <div className="rev-dudosos">
            <span>
              {dudosos.length === 1
                ? 'Hay 1 dato que el sistema leyó con dudas y todavía no revisaste.'
                : `Hay ${dudosos.length} datos que el sistema leyó con dudas y todavía no revisaste.`}
            </span>
            <button type="button" className="btn btn-secondary" onClick={irAlDudoso}>
              {dudosos.length === 1 ? 'Ir al dato' : `Ir al ${(nDudoso % dudosos.length) + 1}° de ${dudosos.length}`}
            </button>
          </div>
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

      <div className="ui-card rev-card">
        <h3 className="rev-h3" style={{ marginTop: 0 }}>Identificación</h3>
        <div className="rev-grilla">
          <Campo etiqueta="Descripción *" {...campoProps('descripcion')} ancho={esMobile ? undefined : 2} />
          <Campo etiqueta="Cliente (de la ficha)" {...campoProps('cliente')} />
          <Campo etiqueta="Marca" {...campoProps('marca')} />
          <Campo etiqueta="Modelo" {...campoProps('modelo')} />
          <Campo etiqueta="Aplicación" {...campoProps('aplicacion')} />
        </div>

        <h3 className="rev-h3">Datos eléctricos</h3>
        <div className="rev-grilla rev-grilla--chica">
          <Campo etiqueta="Potencia" {...campoProps('hp_texto')} />
          <Campo etiqueta="Amperaje" {...campoProps('amperaje_texto')} />
          <Campo etiqueta="Capacitor" {...campoProps('capacitor_texto')} />
          <Campo etiqueta="Ranuras" {...campoProps('ranuras')} inputMode="numeric" />
          <Campo etiqueta="RPM" {...campoProps('rpm')} inputMode="numeric" />
        </div>

        <h3 className="rev-h3">Medidas (mm)</h3>
        <div className="rev-grilla rev-grilla--chica">
          <Campo etiqueta="Largo" {...campoProps('largo_mm')} inputMode="decimal" />
          <Campo etiqueta="Ø interior" {...campoProps('diam_int_mm')} inputMode="decimal" />
          <Campo etiqueta="Ø exterior" {...campoProps('diam_ext_mm')} inputMode="decimal" />
        </div>

        <h3 className="rev-h3">Aislaciones</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          {aislaciones.map((a, i) => {
            const conf = tocados[`aislacion_${i}`] ? null : confianza[`aislacion_${i}`];
            return (
              <div key={i} className="rev-bloque"
                style={conf ? { borderColor: COLOR_CONFIANZA[conf], borderWidth: '2px' } : undefined}>
                <div className="rev-bloque__cab">
                  <span className="rev-label" style={{ margin: 0 }}>Aislación {i + 1}</span>
                  <button type="button" onClick={() => quitarAislacion(i)}
                    aria-label={`Quitar aislación ${i + 1}`} className="rev-quitar">
                    <X size={16} />
                  </button>
                </div>
                <div className="rev-aislacion">
                  <input className="rev-input rev-aislacion__que" placeholder="Qué aísla" value={a.descripcion}
                    aria-label={`Aislación ${i + 1}: qué aísla`}
                    onChange={(e) => cambiarAislacion(i, 'descripcion', e.target.value)} />
                  <input className="rev-input" inputMode="decimal" placeholder="Largo" value={a.largo_mm}
                    aria-label={`Aislación ${i + 1}: largo`}
                    onChange={(e) => cambiarAislacion(i, 'largo_mm', e.target.value)} />
                  <input className="rev-input" inputMode="decimal" placeholder="Ancho" value={a.ancho_mm}
                    aria-label={`Aislación ${i + 1}: ancho`}
                    onChange={(e) => cambiarAislacion(i, 'ancho_mm', e.target.value)} />
                  <input className="rev-input" inputMode="numeric" placeholder="Cant." value={a.cantidad}
                    aria-label={`Aislación ${i + 1}: cantidad`}
                    onChange={(e) => cambiarAislacion(i, 'cantidad', e.target.value)} />
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={agregarAislacion} className="btn btn-secondary"
          style={{ marginTop: '10px', fontSize: 'var(--txt-sm)', fontWeight: 600 }}>
          <Plus size={14} /> Agregar aislación
        </button>

        <h3 className="rev-h3">Bobinado</h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          {circuitos.map((c) => {
            const conf = tocados[`circuito_${c.tipo}`] ? null : confianza[`circuito_${c.tipo}`];
            return (
              <div key={c.tipo} className="rev-bloque rev-bloque--circuito"
                style={conf ? { borderColor: COLOR_CONFIANZA[conf], borderWidth: '2px' } : undefined}>
                <div className="rev-bloque__cab">
                  <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: 'var(--txt-xs)', letterSpacing: '0.1em' }}>
                    {ETIQUETA_CIRCUITO[c.tipo]}
                  </h4>
                  {conf && (
                    <span style={{ fontSize: 'var(--txt-xs)', fontWeight: 700, color: COLOR_CONFIANZA[conf], textTransform: 'uppercase' }}>
                      {ETIQUETA_CONFIANZA[conf]}
                    </span>
                  )}
                </div>

                {fuente[`circuito_${c.tipo}`] && (
                  <div style={{ fontSize: 'var(--txt-xs)', color: 'var(--danger)', marginBottom: '10px' }}>
                    {fuente[`circuito_${c.tipo}`]}
                  </div>
                )}

                <div className="rev-grilla rev-grilla--chica" style={{ marginBottom: '14px' }}>
                  <div>
                    <label className="rev-label" htmlFor={`al-${c.tipo}`}>Alambre ⌀</label>
                    <input id={`al-${c.tipo}`} className="rev-input" inputMode="decimal" value={c.alambre_mm}
                      onChange={(e) => cambiarCircuito(c.tipo, 'alambre_mm', e.target.value)} />
                  </div>
                  <div>
                    <label className="rev-label" htmlFor={`hi-${c.tipo}`}>Hilos</label>
                    <input id={`hi-${c.tipo}`} className="rev-input" inputMode="numeric" value={c.alambre_hilos}
                      onChange={(e) => cambiarCircuito(c.tipo, 'alambre_hilos', e.target.value)} />
                  </div>
                  <div>
                    <label className="rev-label" htmlFor={`kg-${c.tipo}`}>Peso kg</label>
                    <input id={`kg-${c.tipo}`} className="rev-input" inputMode="decimal" value={c.alambre_kg}
                      onChange={(e) => cambiarCircuito(c.tipo, 'alambre_kg', e.target.value)} />
                  </div>
                  <div>
                    <label className="rev-label" htmlFor={`ab-${c.tipo}`}>Abertura</label>
                    <input id={`ab-${c.tipo}`} className="rev-input" inputMode="decimal" value={c.abertura_mm}
                      onChange={(e) => cambiarCircuito(c.tipo, 'abertura_mm', e.target.value)} />
                  </div>
                  <div>
                    <label className="rev-label" htmlFor={`re-${c.tipo}`}>Relación</label>
                    <input id={`re-${c.tipo}`} className="rev-input" value={c.abertura_fraccion}
                      onChange={(e) => cambiarCircuito(c.tipo, 'abertura_fraccion', e.target.value)} />
                  </div>
                </div>

                {/* Encabezado de la grilla: sin esto, en el celular son
                    tres cajas de numeros sin nombre. */}
                <div className="rev-secciones__cab" aria-hidden="true">
                  <span>#</span><span>Paso</span><span>Vueltas</span><span>Tachado</span><span />
                </div>
                <div style={{ display: 'grid', gap: '7px' }}>
                  {c.secciones.map((s, i) => (
                    <div key={i} className="rev-seccion">
                      <span className="rev-seccion__n">{i + 1}</span>
                      <input className="rev-input" inputMode="numeric" value={s.paso}
                        aria-label={`${ETIQUETA_CIRCUITO[c.tipo]} sección ${i + 1}: paso`}
                        onChange={(e) => cambiarSeccion(c.tipo, i, 'paso', e.target.value)} />
                      <input className="rev-input" inputMode="numeric" value={s.vueltas}
                        aria-label={`${ETIQUETA_CIRCUITO[c.tipo]} sección ${i + 1}: vueltas`}
                        onChange={(e) => cambiarSeccion(c.tipo, i, 'vueltas', e.target.value)} />
                      <input className="rev-input" inputMode="numeric" value={s.vueltas_tachadas}
                        style={{ opacity: 0.75 }}
                        aria-label={`${ETIQUETA_CIRCUITO[c.tipo]} sección ${i + 1}: vueltas tachadas`}
                        onChange={(e) => cambiarSeccion(c.tipo, i, 'vueltas_tachadas', e.target.value)} />
                      {c.secciones.length > 1 ? (
                        <button type="button" onClick={() => quitarSeccion(c.tipo, i)}
                          aria-label={`Quitar sección ${i + 1}`} className="rev-quitar">
                          <X size={15} />
                        </button>
                      ) : <span />}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => agregarSeccion(c.tipo)}
                  className="btn btn-secondary" style={{ marginTop: '10px', fontSize: 'var(--txt-sm)' }}>
                  <Plus size={13} /> Sección
                </button>
              </div>
            );
          })}
        </div>

        <h3 className="rev-h3">Observaciones</h3>
        <textarea rows={3} className="rev-input" style={{ resize: 'vertical' }}
          value={form.observaciones ?? ''}
          onChange={(e) => cambiar('observaciones', e.target.value)} />
        {fuente.observaciones && (
          <div className="rev-fuente">leyó: “{fuente.observaciones}”</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="revision">
      <div className="rev-cabecera">
        <button type="button" onClick={volver} className="btn btn-secondary" style={{ fontWeight: 600 }}>
          <ArrowLeft size={15} /> Volver
        </button>
        <h2 style={{ margin: 0, fontSize: esMobile ? '1.15rem' : '1.4rem' }}>Revisar lectura</h2>
      </div>

      {esMobile ? panelDatos : (
        <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: '20px', alignItems: 'start' }}>
          {panelImagen}
          {panelDatos}
        </div>
      )}

      {/* En el celular queda fijo abajo: el formulario mide tres pantallas
          y los dos botones que cierran el flujo no pueden estar al final
          de todo. En escritorio va al pie, como siempre. */}
      <div className="rev-acciones">
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

      {ampliada && urlImagen && (
        <div className="rev-lupa" role="dialog" aria-modal="true" aria-label="Ficha ampliada">
          <button type="button" onClick={() => setAmpliada(false)}
            className="rev-lupa__cerrar" aria-label="Cerrar la imagen">
            <X size={22} />
          </button>
          <div className="rev-lupa__marco">
            <img src={urlImagen} alt="Ficha de papel ampliada" />
          </div>
        </div>
      )}

      <Modal
        isOpen={modalGuardar}
        type="info"
        title="Guardar la ficha"
        message={
          dudosos.length > 0
            ? `${dudosos.length === 1 ? 'Queda 1 dato marcado como dudoso' : `Quedan ${dudosos.length} datos marcados como dudosos`} que no revisaste. `
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
