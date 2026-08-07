import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, X, Save, AlertTriangle, Camera, FileText, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useEsMobile } from '../lib/useMediaQuery';
import { obtenerMotor, guardarMotor } from '../lib/motores';
import { conUrls, subirFoto, eliminarFoto, marcarComoFicha } from '../lib/fotos';
import { revisarPlausibilidad } from '@shared/parseo.js';

const CIRCUITO_VACIO = (tipo) => ({
  tipo,
  alambre_mm: '',
  alambre_hilos: '1',
  alambre_kg: '',
  abertura_mm: '',
  abertura_fraccion: '',
  secciones: [{ paso: '', vueltas: '', vueltas_tachadas: '' }],
});

const AISLACION_VACIA = () => ({
  descripcion: '', largo_mm: '', ancho_mm: '', cantidad: '',
});

const FORM_VACIO = {
  id: null,
  nro_motor: null,
  descripcion: '',
  marca: '',
  modelo: '',
  aplicacion: '',
  tipo_electrico: '',
  hp_texto: '',
  amperaje_texto: '',
  capacitor_texto: '',
  ranuras: '',
  rpm: '',
  largo_mm: '',
  diam_int_mm: '',
  diam_ext_mm: '',
  observaciones: '',
  circuitos: [CIRCUITO_VACIO('arranque'), CIRCUITO_VACIO('trabajo')],
  aislaciones: [AISLACION_VACIA()],
};

const ETIQUETA_CIRCUITO = { arranque: 'Arranque', trabajo: 'Trabajo' };

const MotorForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { esEditor } = useAuth();
  const esMobile = useEsMobile();

  const modoVer = location.pathname.includes('/ver/');
  const esEdicion = Boolean(id) && !modoVer;
  const soloLectura = modoVer || !esEditor;

  const [form, setForm] = useState(FORM_VACIO);
  const [fotos, setFotos] = useState([]);
  // Fotos elegidas que todavia no se subieron. En una ficha nueva no hay
  // motor_id al que colgarlas, asi que esperan a que se guarde.
  const [pendientes, setPendientes] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [cargando, setCargando] = useState(Boolean(id));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    let vigente = true;

    obtenerMotor(id)
      .then((ficha) => {
        if (!vigente) return;
        if (!ficha) { setError('No encontramos esa ficha.'); return; }

        const { motor, circuitos } = ficha;
        const porTipo = (tipo) => {
          const c = circuitos.find((x) => x.tipo === tipo);
          if (!c) return CIRCUITO_VACIO(tipo);
          return {
            tipo,
            alambre_mm: c.alambre_mm ?? '',
            alambre_hilos: String(c.alambre_hilos ?? 1),
            alambre_kg: c.alambre_kg ?? '',
            abertura_mm: c.abertura_mm ?? '',
            abertura_fraccion: c.abertura_fraccion ?? '',
            secciones: c.secciones?.length
              ? c.secciones.map((s) => ({
                  paso: s.paso ?? '',
                  vueltas: s.vueltas ?? '',
                  vueltas_tachadas: s.vueltas_tachadas ?? '',
                }))
              : [{ paso: '', vueltas: '', vueltas_tachadas: '' }],
          };
        };

        setForm({
          ...FORM_VACIO,
          ...Object.fromEntries(
            Object.keys(FORM_VACIO)
              .filter((k) => k !== 'circuitos' && k !== 'aislaciones')
              .map((k) => [k, motor[k] ?? FORM_VACIO[k]]),
          ),
          id: motor.id,
          nro_motor: motor.nro_motor,
          circuitos: [porTipo('arranque'), porTipo('trabajo')],
          // Siempre al menos una fila para que el formulario no arranque
          // vacio y haya que descubrir el boton de agregar.
          aislaciones: ficha.aislaciones?.length
            ? ficha.aislaciones.map((a) => ({
              descripcion: a.descripcion ?? '',
              largo_mm: a.largo_mm ?? '',
              ancho_mm: a.ancho_mm ?? '',
              cantidad: a.cantidad ?? '',
            }))
            : [AISLACION_VACIA()],
        });
        // El bucket es privado: hay que firmar cada URL para poder verlas.
        conUrls(ficha.fotos ?? [])
          .then((f) => { if (vigente) setFotos(f); })
          .catch(() => { if (vigente) setFotos(ficha.fotos ?? []); });
      })
      .catch((e) => { if (vigente) setError(e.message ?? 'No se pudo cargar la ficha.'); })
      .finally(() => { if (vigente) setCargando(false); });

    return () => { vigente = false; };
  }, [id]);

  const cambiar = (campo, valor) => {
    if (soloLectura) return;
    setForm((f) => ({ ...f, [campo]: valor }));
  };

  const cambiarCircuito = (tipo, campo, valor) => {
    if (soloLectura) return;
    setForm((f) => ({
      ...f,
      circuitos: f.circuitos.map((c) => (c.tipo === tipo ? { ...c, [campo]: valor } : c)),
    }));
  };

  const cambiarSeccion = (tipo, indice, campo, valor) => {
    if (soloLectura) return;
    setForm((f) => ({
      ...f,
      circuitos: f.circuitos.map((c) => (c.tipo !== tipo ? c : {
        ...c,
        secciones: c.secciones.map((s, i) => (i === indice ? { ...s, [campo]: valor } : s)),
      })),
    }));
  };

  const agregarSeccion = (tipo) => setForm((f) => ({
    ...f,
    circuitos: f.circuitos.map((c) => (c.tipo !== tipo ? c : {
      ...c,
      secciones: [...c.secciones, { paso: '', vueltas: '', vueltas_tachadas: '' }],
    })),
  }));

  const quitarSeccion = (tipo, indice) => setForm((f) => ({
    ...f,
    circuitos: f.circuitos.map((c) => (c.tipo !== tipo ? c : {
      ...c,
      secciones: c.secciones.length > 1
        ? c.secciones.filter((_, i) => i !== indice)
        : c.secciones,
    })),
  }));

  const cambiarAislacion = (indice, campo, valor) => {
    if (soloLectura) return;
    setForm((f) => ({
      ...f,
      aislaciones: f.aislaciones.map((a, i) => (i === indice ? { ...a, [campo]: valor } : a)),
    }));
  };

  const agregarAislacion = () => setForm((f) => ({
    ...f,
    aislaciones: [...f.aislaciones, AISLACION_VACIA()],
  }));

  // Nunca deja el formulario sin ninguna fila: si se saca la ultima,
  // se vacia en vez de desaparecer.
  const quitarAislacion = (indice) => setForm((f) => ({
    ...f,
    aislaciones: f.aislaciones.length > 1
      ? f.aislaciones.filter((_, i) => i !== indice)
      : [AISLACION_VACIA()],
  }));

  const elegirFotos = (e) => {
    const archivos = Array.from(e.target.files ?? []);
    if (!archivos.length) return;
    setPendientes((p) => [
      ...p,
      ...archivos.map((archivo) => ({
        archivo,
        vista: URL.createObjectURL(archivo),
        // La primera foto de una ficha nueva suele ser el papel.
        esFicha: p.length === 0 && fotos.length === 0,
      })),
    ]);
    e.target.value = ''; // permite volver a elegir el mismo archivo
  };

  const quitarPendiente = (indice) => setPendientes((p) => {
    URL.revokeObjectURL(p[indice].vista);
    return p.filter((_, i) => i !== indice);
  });

  const marcarPendienteFicha = (indice) => setPendientes((p) => p.map((x, i) => (
    { ...x, esFicha: i === indice }
  )));

  const borrarFoto = async (foto) => {
    try {
      await eliminarFoto(foto);
      setFotos((fs) => fs.filter((f) => f.id !== foto.id));
    } catch (e) {
      setError(e.message ?? 'No se pudo eliminar la foto.');
    }
  };

  const alternarFicha = async (foto) => {
    try {
      await marcarComoFicha(form.id, foto.id);
      setFotos((fs) => fs.map((f) => ({ ...f, es_ficha: f.id === foto.id })));
    } catch (e) {
      setError(e.message ?? 'No se pudo marcar la foto.');
    }
  };

  // Las URL de objeto sobreviven al desmontaje si no se liberan.
  useEffect(() => () => {
    pendientes.forEach((p) => URL.revokeObjectURL(p.vista));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Advertencias de plausibilidad: no bloquean el guardado, avisan.
  // Atrapan el caso donde el dato tiene formato valido pero valor absurdo
  // (300 vueltas esta bien; 150150 casi seguro es "150.150" mal leido).
  const avisos = revisarPlausibilidad({
    ranuras: form.ranuras ? Number(form.ranuras) : null,
    rpm: form.rpm ? Number(form.rpm) : null,
    alambreMm: form.circuitos[0]?.alambre_mm ? Number(form.circuitos[0].alambre_mm) : null,
    secciones: form.circuitos.flatMap((c) => c.secciones.map((s) => ({
      paso: s.paso ? Number(s.paso) : null,
      vueltas: s.vueltas ? Number(s.vueltas) : null,
    }))),
  });

  const alGuardar = (e) => {
    e.preventDefault();
    setError('');
    if (!form.descripcion.trim()) {
      setError('La descripcion es obligatoria. Es lo que identifica la ficha (ej: "MOTOR BATIDOR").');
      return;
    }
    setModal(true);
  };

  const confirmarGuardado = async () => {
    if (guardando) return;
    setGuardando(true);
    try {
      // Los circuitos sin ningun dato no se mandan: una ficha puede
      // tener solo arranque.
      const circuitos = form.circuitos
        .filter((c) => c.alambre_mm || c.alambre_kg || c.abertura_mm
          || c.secciones.some((s) => s.paso || s.vueltas))
        .map((c) => ({
          ...c,
          secciones: c.secciones.filter((s) => s.paso !== '' || s.vueltas !== ''),
        }));

      // Las filas de aislacion en blanco son renglones que el usuario
      // agrego y no completo; el RPC ya las ignora, pero se filtran aca
      // tambien para no mandar ruido por la red.
      const aislaciones = form.aislaciones.filter(
        (a) => a.largo_mm || a.ancho_mm || a.cantidad || a.descripcion.trim(),
      );

      const nuevoId = await guardarMotor({ ...form, circuitos, aislaciones });

      // Recien ahora hay motor_id para colgar las fotos.
      if (pendientes.length) {
        setSubiendo(true);
        for (const [i, p] of pendientes.entries()) {
          await subirFoto(nuevoId, p.archivo, {
            esFicha: p.esFicha,
            orden: fotos.length + i,
          });
        }
        pendientes.forEach((p) => URL.revokeObjectURL(p.vista));
        setPendientes([]);
        setSubiendo(false);
      }

      setModal(false);
      navigate(`/sistema/motores/ver/${nuevoId}`);
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar la ficha.');
      setModal(false);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <div style={{ padding: '48px' }}><Spinner label="Cargando ficha..." size="lg" centered /></div>;
  }

  const labelStyle = { display: 'block', marginBottom: '7px', fontWeight: '700', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-light)' };
  const inputStyle = {
    width: '100%', padding: '11px 13px', borderRadius: '9px', boxSizing: 'border-box',
    fontFamily: 'inherit', fontSize: '1rem', color: 'inherit',
    border: soloLectura ? '1px solid transparent' : '1px solid var(--border)',
    background: soloLectura ? 'var(--surface-soft)' : 'var(--surface)',
    fontWeight: soloLectura ? '600' : '400',
    pointerEvents: soloLectura ? 'none' : 'auto',
  };
  const seccionTitulo = { borderLeft: '4px solid var(--accent)', paddingLeft: '14px', margin: '28px 0 18px', fontSize: '1.15rem', fontWeight: '800' };

  // En modo lectura los ejemplos se apagan en todos lados, no solo en
  // los campos con <Campo>: las grillas de bobinado y aislacion tambien
  // mostraban "0,45" y "30" en gris como si fueran datos.
  const ph = (ejemplo) => (soloLectura ? undefined : ejemplo);

  const Campo = ({ etiqueta, campo, ancho, placeholder, ...props }) => {
    // Al VER una ficha, un placeholder gris ("Ej: 60") se lee igual que
    // un dato real y el que mira termina creyendo que la ficha dice 60.
    // En modo lectura no hay ejemplos: o esta el dato, o dice N/A.
    const vacio = soloLectura && !String(form[campo] ?? '').trim();
    return (
      <div style={ancho ? { gridColumn: `span ${ancho}` } : undefined}>
        <label style={labelStyle} htmlFor={`c-${campo}`}>{etiqueta}</label>
        <input
          id={`c-${campo}`}
          style={vacio ? { ...inputStyle, color: 'var(--text-light)', fontWeight: 400 } : inputStyle}
          value={vacio ? 'N/A' : (form[campo] ?? '')}
          onChange={(e) => cambiar(campo, e.target.value)}
          readOnly={soloLectura}
          placeholder={soloLectura ? undefined : placeholder}
          {...props}
        />
      </div>
    );
  };

  const grilla = (min = '160px') => ({
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`,
    gap: '14px',
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <Link to="/sistema/motores" className="btn btn-secondary" style={{ textDecoration: 'none', fontWeight: 600 }}>
          <ArrowLeft size={15} /> Volver
        </Link>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
          {modoVer ? 'Ficha' : esEdicion ? 'Editar ficha' : 'Nueva ficha'}
          {form.nro_motor ? <span style={{ color: 'var(--text-light)' }}> #{form.nro_motor}</span> : null}
        </h2>
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

      {avisos.length > 0 && !soloLectura ? (
        <Alert variant="warning" className="mb-3">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              {avisos.map((a) => <div key={a}>{a}</div>)}
            </div>
          </div>
        </Alert>
      ) : null}

      <form onSubmit={alGuardar} className="ui-card" style={{ padding: esMobile ? '18px' : '32px' }}>

        <h3 style={{ ...seccionTitulo, marginTop: 0 }}>Identificacion</h3>
        <div style={grilla()}>
          <Campo
            etiqueta="Descripcion *"
            campo="descripcion"
            ancho={esMobile ? undefined : 2}
            required
            placeholder={ph('Ej: MOTOR BATIDOR')}
          />
          <Campo etiqueta="Marca" campo="marca" placeholder={ph('Ej: Czerweny')} />
          <Campo etiqueta="Modelo" campo="modelo" placeholder={ph('Ej: ZIII')} />
          <Campo etiqueta="Aplicacion / uso" campo="aplicacion" placeholder={ph('Ej: bombeador')} />
          <div>
            <label style={labelStyle} htmlFor="c-tipo">Tipo electrico</label>
            <select
              id="c-tipo"
              style={inputStyle}
              value={form.tipo_electrico ?? ''}
              onChange={(e) => cambiar('tipo_electrico', e.target.value)}
              disabled={soloLectura}
            >
              <option value="">Sin especificar</option>
              <option value="monofasico">Monofasico</option>
              <option value="trifasico">Trifasico</option>
              <option value="continua">Corriente continua</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>

        <h3 style={seccionTitulo}>Datos electricos</h3>
        <div style={grilla('140px')}>
          <Campo etiqueta="Potencia (HP)" campo="hp_texto" placeholder={ph('Ej: 1/2')} />
          <Campo etiqueta="Amperaje" campo="amperaje_texto" placeholder={ph('Ej: 4,5 A')} />
          <Campo etiqueta="Capacitor" campo="capacitor_texto" placeholder={ph('Ej: 8 µF')} />
          <Campo etiqueta="Ranuras" campo="ranuras" inputMode="numeric" placeholder={ph('Ej: 24')} />
          <Campo etiqueta="RPM" campo="rpm" inputMode="numeric" placeholder={ph('Ej: 1450')} />
        </div>

        <h3 style={seccionTitulo}>Medidas de carcasa (mm)</h3>
        <div style={grilla('140px')}>
          <Campo etiqueta="Largo" campo="largo_mm" inputMode="decimal" placeholder={ph('Ej: 45')} />
          <Campo etiqueta="Diametro interior" campo="diam_int_mm" inputMode="decimal" placeholder={ph('Ej: 73')} />
          <Campo etiqueta="Diametro exterior" campo="diam_ext_mm" inputMode="decimal" placeholder={ph('Ej: 124')} />
        </div>

        <h3 style={seccionTitulo}>Bobinado</h3>
        <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr' : '1fr 1fr', gap: '18px' }}>
          {form.circuitos.map((circuito) => (
            <div
              key={circuito.tipo}
              style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', background: 'var(--surface-soft)' }}
            >
              <h4 style={{ margin: '0 0 14px', textTransform: 'uppercase', fontSize: '0.82rem', letterSpacing: '0.1em' }}>
                {ETIQUETA_CIRCUITO[circuito.tipo]}
              </h4>

              <div style={{ ...grilla('110px'), marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>Alambre ⌀ (mm)</label>
                  <input style={inputStyle} inputMode="decimal" placeholder={ph('0,45')}
                    value={circuito.alambre_mm}
                    onChange={(e) => cambiarCircuito(circuito.tipo, 'alambre_mm', e.target.value)}
                    readOnly={soloLectura} />
                </div>
                <div>
                  {/* El "2x" de "⌀2x0,45mm": dos alambres en paralelo.
                      Perderlo es perder la mitad de la seccion de cobre. */}
                  <label style={labelStyle}>Hilos</label>
                  <input style={inputStyle} inputMode="numeric" placeholder={ph('1')}
                    value={circuito.alambre_hilos}
                    onChange={(e) => cambiarCircuito(circuito.tipo, 'alambre_hilos', e.target.value)}
                    readOnly={soloLectura} />
                </div>
                <div>
                  <label style={labelStyle}>Peso (kg)</label>
                  <input style={inputStyle} inputMode="decimal" placeholder={ph('0,300')}
                    value={circuito.alambre_kg}
                    onChange={(e) => cambiarCircuito(circuito.tipo, 'alambre_kg', e.target.value)}
                    readOnly={soloLectura} />
                </div>
                <div>
                  <label style={labelStyle}>Abertura (mm)</label>
                  <input style={inputStyle} inputMode="decimal" placeholder={ph('42')}
                    value={circuito.abertura_mm}
                    onChange={(e) => cambiarCircuito(circuito.tipo, 'abertura_mm', e.target.value)}
                    readOnly={soloLectura} />
                </div>
                <div>
                  <label style={labelStyle}>Relacion molde</label>
                  <input style={inputStyle} placeholder={ph('2/3')}
                    value={circuito.abertura_fraccion}
                    onChange={(e) => cambiarCircuito(circuito.tipo, 'abertura_fraccion', e.target.value)}
                    readOnly={soloLectura} />
                </div>
              </div>

              {/*
                Grilla paso <-> vueltas.

                En la ficha de papel esto son dos renglones ("PASO 4-6-8" /
                "VTAS 80-80-90") y hay que leerlos en paralelo. Guardarlos
                como dos textos permite que queden distinta cantidad de
                valores y nadie se entere. Una fila por seccion hace que el
                desalineamiento sea imposible por construccion.
              */}
              <label style={{ ...labelStyle, marginBottom: '10px' }}>
                Secciones (paso y vueltas)
              </label>

              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 1fr 36px', gap: '8px', alignItems: 'center' }}>
                  <span />
                  <span style={{ ...labelStyle, margin: 0, fontSize: '0.64rem' }}>Paso</span>
                  <span style={{ ...labelStyle, margin: 0, fontSize: '0.64rem' }}>Vueltas</span>
                  <span style={{ ...labelStyle, margin: 0, fontSize: '0.64rem' }}>Tachado</span>
                  <span />
                </div>

                {circuito.secciones.map((s, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 1fr 36px', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 700 }}>{i + 1}</span>
                    <input style={{ ...inputStyle, padding: '9px 10px' }} inputMode="numeric" placeholder={ph('6')}
                      value={s.paso}
                      onChange={(e) => cambiarSeccion(circuito.tipo, i, 'paso', e.target.value)}
                      readOnly={soloLectura} />
                    <input style={{ ...inputStyle, padding: '9px 10px' }} inputMode="numeric" placeholder={ph('30')}
                      value={s.vueltas}
                      onChange={(e) => cambiarSeccion(circuito.tipo, i, 'vueltas', e.target.value)}
                      readOnly={soloLectura} />
                    {/* Valor corregido en la ficha original: en la ficha C
                        "32" quedo tachado y arriba se escribio "30". */}
                    <input style={{ ...inputStyle, padding: '9px 10px', opacity: 0.75 }} inputMode="numeric" placeholder={ph('-')}
                      value={s.vueltas_tachadas}
                      onChange={(e) => cambiarSeccion(circuito.tipo, i, 'vueltas_tachadas', e.target.value)}
                      readOnly={soloLectura} />
                    {!soloLectura && circuito.secciones.length > 1 ? (
                      <button type="button" onClick={() => quitarSeccion(circuito.tipo, i)}
                        aria-label={`Quitar seccion ${i + 1}`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '8px', minHeight: '36px' }}>
                        <X size={15} />
                      </button>
                    ) : <span />}
                  </div>
                ))}
              </div>

              {!soloLectura && (
                <button type="button" onClick={() => agregarSeccion(circuito.tipo)}
                  className="btn btn-secondary"
                  style={{ marginTop: '10px', fontSize: '0.84rem', fontWeight: 600 }}>
                  <Plus size={14} /> Agregar seccion
                </button>
              )}
            </div>
          ))}
        </div>

        <h3 style={seccionTitulo}>Aislaciones</h3>
        <p style={{ margin: '-8px 0 12px', fontSize: '0.86rem', color: 'var(--text-light)' }}>
          Una fila por medida. Un motor puede llevar varias (fondo de ranura,
          cuña, entre fases), cada una con su cantidad.
        </p>

        <div style={{ display: 'grid', gap: '8px' }}>
          {/* Encabezado solo en pantalla ancha: en el celular cada input
              ya trae su placeholder y la fila entrarĩa apretada. */}
          {!esMobile && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 100px 100px 100px 36px',
              gap: '8px', fontSize: '0.7rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.07em',
              color: 'var(--text-light)',
            }}>
              <span>Que aisla</span><span>Largo (mm)</span><span>Ancho (mm)</span><span>Cantidad</span><span />
            </div>
          )}

          {form.aislaciones.map((a, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: esMobile ? '1fr 1fr' : '1.4fr 100px 100px 100px 36px',
              gap: '8px', alignItems: 'center',
            }}>
              <input style={{ ...inputStyle, padding: '9px 10px', gridColumn: esMobile ? '1 / -1' : 'auto' }}
                placeholder={ph('Fondo de ranura')} value={a.descripcion}
                aria-label={`Aislacion ${i + 1}: que aisla`}
                onChange={(e) => cambiarAislacion(i, 'descripcion', e.target.value)}
                readOnly={soloLectura} />
              <input style={{ ...inputStyle, padding: '9px 10px' }} inputMode="decimal"
                placeholder={ph(esMobile ? 'Largo (mm)' : '60')} value={a.largo_mm}
                aria-label={`Aislacion ${i + 1}: largo en mm`}
                onChange={(e) => cambiarAislacion(i, 'largo_mm', e.target.value)}
                readOnly={soloLectura} />
              <input style={{ ...inputStyle, padding: '9px 10px' }} inputMode="decimal"
                placeholder={ph(esMobile ? 'Ancho (mm)' : '30')} value={a.ancho_mm}
                aria-label={`Aislacion ${i + 1}: ancho en mm`}
                onChange={(e) => cambiarAislacion(i, 'ancho_mm', e.target.value)}
                readOnly={soloLectura} />
              <input style={{ ...inputStyle, padding: '9px 10px' }} inputMode="numeric"
                placeholder={ph(esMobile ? 'Cantidad' : '24')} value={a.cantidad}
                aria-label={`Aislacion ${i + 1}: cantidad`}
                onChange={(e) => cambiarAislacion(i, 'cantidad', e.target.value)}
                readOnly={soloLectura} />
              {!soloLectura ? (
                <button type="button" onClick={() => quitarAislacion(i)}
                  aria-label={`Quitar aislacion ${i + 1}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '8px', minHeight: '36px' }}>
                  <X size={15} />
                </button>
              ) : <span />}
            </div>
          ))}
        </div>

        {!soloLectura && (
          <button type="button" onClick={agregarAislacion}
            className="btn btn-secondary"
            style={{ marginTop: '10px', fontSize: '0.84rem', fontWeight: 600 }}>
            <Plus size={14} /> Agregar aislacion
          </button>
        )}

        <h3 style={seccionTitulo}>Observaciones</h3>
        <textarea
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
          value={form.observaciones ?? ''}
          onChange={(e) => cambiar('observaciones', e.target.value)}
          readOnly={soloLectura}
          placeholder={ph('Ej: ABERTURA MOLDE CHICO 77mm TRAB / 66mm ARRANQ')}
        />

        {(fotos.length > 0 || pendientes.length > 0 || !soloLectura) && (
          <>
            <h3 style={seccionTitulo}>Fotos</h3>
            <p style={{ margin: '-8px 0 14px', fontSize: '0.86rem', color: 'var(--text-light)' }}>
              Marca con <FileText size={13} style={{ verticalAlign: '-2px' }} /> la foto de
              la ficha de papel: es la que devuelve el bot y contra la que se compara al
              revisar una carga automatica.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {fotos.map((f) => (
                <div key={f.id} style={{ position: 'relative', width: '124px' }}>
                  <a
                    href={f.url ?? '#'} target="_blank" rel="noreferrer"
                    style={{
                      display: 'block', width: '124px', height: '124px', borderRadius: '10px',
                      overflow: 'hidden', background: 'var(--surface-soft)',
                      border: f.es_ficha ? '2px solid var(--accent)' : '1px solid var(--border)',
                    }}
                  >
                    {f.url
                      ? <img src={f.url} alt={f.es_ficha ? 'Ficha de papel' : 'Motor'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: '0.75rem', color: 'var(--text-light)' }}>sin vista</span>}
                  </a>
                  {!soloLectura && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '5px' }}>
                      <button type="button" onClick={() => alternarFicha(f)}
                        title={f.es_ficha ? 'Es la ficha de papel' : 'Marcar como ficha de papel'}
                        style={{ flex: 1, minHeight: '36px', border: '1px solid var(--border)', borderRadius: '7px', cursor: 'pointer', background: f.es_ficha ? 'var(--gradient-primary)' : 'transparent', color: f.es_ficha ? '#fff' : 'inherit' }}>
                        <FileText size={14} />
                      </button>
                      <button type="button" onClick={() => borrarFoto(f)} title="Eliminar foto"
                        style={{ flex: 1, minHeight: '36px', border: '1px solid var(--border)', borderRadius: '7px', cursor: 'pointer', background: 'transparent', color: 'var(--danger)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {pendientes.map((p, i) => (
                <div key={i} style={{ width: '124px' }}>
                  <div style={{
                    width: '124px', height: '124px', borderRadius: '10px', overflow: 'hidden',
                    border: p.esFicha ? '2px solid var(--accent)' : '1px dashed var(--border)',
                    opacity: 0.85,
                  }}>
                    <img src={p.vista} alt="Sin subir"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '5px' }}>
                    <button type="button" onClick={() => marcarPendienteFicha(i)}
                      title="Marcar como ficha de papel"
                      style={{ flex: 1, minHeight: '36px', border: '1px solid var(--border)', borderRadius: '7px', cursor: 'pointer', background: p.esFicha ? 'var(--gradient-primary)' : 'transparent', color: p.esFicha ? '#fff' : 'inherit' }}>
                      <FileText size={14} />
                    </button>
                    <button type="button" onClick={() => quitarPendiente(i)} title="Quitar"
                      style={{ flex: 1, minHeight: '36px', border: '1px solid var(--border)', borderRadius: '7px', cursor: 'pointer', background: 'transparent', color: 'var(--danger)' }}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {!soloLectura && (
                <label style={{
                  width: '124px', height: '124px', borderRadius: '10px',
                  border: '2px dashed var(--border)', display: 'grid', placeItems: 'center',
                  cursor: 'pointer', color: 'var(--text-light)', textAlign: 'center',
                  fontSize: '0.78rem', gap: '4px', alignContent: 'center',
                }}>
                  {/* capture abre la camara directo en el celular, que es
                      desde donde se fotografian las fichas en el taller. */}
                  <input type="file" accept="image/*" multiple capture="environment"
                    onChange={elegirFotos} style={{ display: 'none' }} />
                  <Camera size={22} />
                  <span>Agregar fotos</span>
                </label>
              )}
            </div>

            {pendientes.length > 0 && (
              <p style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-light)' }}>
                {pendientes.length} foto(s) se van a subir al guardar la ficha.
              </p>
            )}
          </>
        )}

        {!soloLectura && (
          <div style={{ marginTop: '28px', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            <Link to="/sistema/motores" className="btn btn-secondary" style={{ textDecoration: 'none', fontWeight: 600 }}>
              Cancelar
            </Link>
            <Button type="submit" variant="primary" size="lg" isLoading={guardando || subiendo}>
              <Save size={16} />
              {subiendo ? 'Subiendo fotos...' : esEdicion ? 'Guardar cambios' : 'Crear ficha'}
            </Button>
          </div>
        )}
      </form>

      <Modal
        isOpen={modal}
        type="info"
        title={esEdicion ? 'Guardar cambios' : 'Crear ficha'}
        message={
          avisos.length > 0
            ? `Hay ${avisos.length} advertencia(s) sin resolver. Se guarda igual, pero conviene revisarlas primero. ¿Continuar?`
            : '¿Confirmas los datos de la ficha?'
        }
        onClose={() => setModal(false)}
        onConfirm={confirmarGuardado}
        isLoading={guardando}
      />
    </div>
  );
};

export default MotorForm;
