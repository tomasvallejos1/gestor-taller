import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Camera, PencilLine, RotateCw, ScanLine, TriangleAlert,
} from 'lucide-react';
import Alert from '../components/ui/Alert';
import { useEsMobile } from '../lib/useMediaQuery';
import {
  cargarFichaPorFoto, seguirExtraccion, obtenerExtraccion, reintentarExtraccion,
} from '../lib/extraccion';
import MotorForm from './MotorForm';
import RevisarFicha from './RevisarFicha';

/**
 * Alta de motor, en un solo lugar.
 *
 * Antes escanear una ficha era una seccion aparte con su propia cola de
 * pendientes; una ficha a medio cargar quedaba ahi esperando que alguien
 * se acordara. Ahora es una sola linea sin desvios:
 *
 *   elegir como cargar -> foto -> leyendo -> revisar -> guardar o descartar
 *
 * El id de la lectura viaja en la URL (?ficha=...) y no en el estado del
 * componente: leer una ficha tarda ~30s y si alguien recarga la pagina o
 * se le apaga la pantalla del celular no puede perder la lectura --ya
 * esta paga y hecha--.
 */

const PASOS = { ELEGIR: 'elegir', MANUAL: 'manual', SUBIENDO: 'subiendo', LEYENDO: 'leyendo', REVISAR: 'revisar' };

const NuevoMotor = () => {
  const esMobile = useEsMobile();
  const [params, setParams] = useSearchParams();

  const fichaId = params.get('ficha');
  const modo = params.get('modo');

  const [paso, setPaso] = useState(PASOS.ELEGIR);
  const [error, setError] = useState('');
  // 'pendiente' = el servidor todavia no la agarro; 'procesando' = la
  // esta leyendo. Antes las dos se veian igual y las dos parecian
  // colgadas, que es justo lo que habia que poder distinguir.
  const [estadoLectura, setEstadoLectura] = useState('pendiente');
  const entrada = useRef(null);
  const camara = useRef(null);

  // La URL manda: asi el boton "atras" del navegador y un F5 hacen lo
  // esperable en vez de dejar la pantalla desincronizada del estado.
  useEffect(() => {
    if (modo === 'manual') { setPaso(PASOS.MANUAL); return; }
    if (!fichaId) { setPaso(PASOS.ELEGIR); return; }

    // Con una ficha en la URL hay que preguntar en que anda: puede estar
    // todavia procesando (recarga a los 5 segundos) o ya lista (recarga
    // al otro dia).
    let vigente = true;
    obtenerExtraccion(fichaId)
      .then((f) => {
        if (!vigente) return;
        if (!f) { setError('Esa lectura ya no existe.'); setPaso(PASOS.ELEGIR); return; }
        if (f.estado === 'revision') setPaso(PASOS.REVISAR);
        else if (f.estado === 'error') { setError(f.error ?? 'No se pudo leer la ficha.'); setPaso(PASOS.ELEGIR); }
        else setPaso(PASOS.LEYENDO);
      })
      .catch(() => { if (vigente) setPaso(PASOS.LEYENDO); });
    return () => { vigente = false; };
  }, [fichaId, modo]);

  // Mientras lee, seguirExtraccion combina Realtime con un sondeo de
  // respaldo y avisa una sola vez, ya con la fila en estado final.
  useEffect(() => {
    if (paso !== PASOS.LEYENDO || !fichaId) return undefined;
    return seguirExtraccion(fichaId, (fila) => {
      if (fila.estado === 'error') {
        setError(fila.error ?? 'No se pudo leer la ficha. Probá con otra foto, mejor iluminada.');
        // La ficha se queda en la URL: la foto ya esta subida y paga, y
        // sin el id no habria con que reintentar sin volver a sacarla.
        setPaso(PASOS.ELEGIR);
      } else {
        // revision o confirmada: en los dos casos hay ficha que mirar.
        setPaso(PASOS.REVISAR);
      }
    }, { alProgreso: setEstadoLectura });
  }, [paso, fichaId]);

  // Cuanto hace que esta esperando. Sirve para dejar de mentirle: pasado
  // cierto punto, "esperá un poco mas" es peor que decirle que algo raro
  // pasa y darle la salida.
  //
  // Se mide contra el instante de arranque en vez de sumar un segundo por
  // tick: el celular congela los timers con la pantalla bloqueada, y
  // sumando ticks el contador diria 20 segundos despues de dos minutos.
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    if (paso !== PASOS.LEYENDO) return undefined;
    const desde = Date.now();
    const t = setInterval(() => setSegundos(Math.round((Date.now() - desde) / 1000)), 500);
    return () => clearInterval(t);
  }, [paso]);

  const subir = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;

    setPaso(PASOS.SUBIENDO);
    setError('');
    setEstadoLectura('pendiente');
    try {
      const fila = await cargarFichaPorFoto(archivo);
      setParams({ ficha: fila.id }, { replace: true });
      setPaso(PASOS.LEYENDO);
    } catch (err) {
      setError(err.message ?? 'No se pudo subir la foto.');
      setPaso(PASOS.ELEGIR);
    }
  };

  const volverAElegir = useCallback(() => {
    setParams({}, { replace: true });
    setError('');
    setPaso(PASOS.ELEGIR);
  }, [setParams]);

  /**
   * Vuelve a pedir la lectura de la foto que ya esta arriba.
   *
   * Antes, cuando una lectura fallaba, la unica salida era sacar la foto
   * de nuevo y volver a subirla, con el motor desarmado en el banco. La
   * foto no tenia nada malo: se habia caido el proveedor, o la corrida se
   * habia pasado del limite de tiempo. Reintentar arranca directo en la
   * parte que fallo.
   */
  const reintentar = useCallback(async () => {
    if (!fichaId) return;
    setError('');
    setEstadoLectura('pendiente');
    setPaso(PASOS.LEYENDO);
    try {
      await reintentarExtraccion(fichaId);
    } catch (err) {
      setError(err.message ?? 'No se pudo reintentar la lectura.');
      setPaso(PASOS.ELEGIR);
    }
  }, [fichaId]);

  // ---------- Revision: la ficha ya leida, para confirmar o descartar ----------
  if (paso === PASOS.REVISAR && fichaId) {
    return <RevisarFicha id={fichaId} alSalir={volverAElegir} />;
  }

  // ---------- Carga a mano ----------
  if (paso === PASOS.MANUAL) {
    return <MotorForm />;
  }

  // ---------- Trabajando ----------
  if (paso === PASOS.SUBIENDO || paso === PASOS.LEYENDO) {
    const subiendo = paso === PASOS.SUBIENDO;
    // El backend se corta solo a los 120s y siempre deja un resultado, asi
    // que pasado eso hay respuesta si o si: la espera tiene final. Antes no
    // lo tenia --se pasaba del limite de la Edge Function, la mataban y la
    // pantalla giraba para siempre-- y por eso el aviso era una disculpa
    // vaga en vez de un plazo.
    const demorado = segundos > 75;

    return (
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: esMobile ? '24px 0' : '64px 0' }}>
        <div className="ui-card" style={{ padding: esMobile ? '30px 20px' : '44px 32px', textAlign: 'center' }}>
          <div className="escaner" aria-hidden="true">
            <ScanLine size={38} />
          </div>

          <h2 style={{ fontSize: 'var(--txt-lg)', margin: '22px 0 8px' }}>
            {subiendo ? 'Subiendo la foto...'
              : demorado ? 'Está tardando más de lo normal'
              : estadoLectura === 'pendiente' ? 'Arrancando la lectura'
              : 'Leyendo la ficha'}
          </h2>

          <p style={{ color: 'var(--text-light)', fontSize: 'var(--txt-base)', margin: 0, lineHeight: 1.55 }}>
            {subiendo && 'Un segundo, se está achicando y subiendo la imagen.'}
            {!subiendo && !demorado && (
              'Suele tardar entre 25 y 45 segundos. Podés bloquear el celular: la lectura sigue del lado del servidor y te espera acá.'
            )}
            {!subiendo && demorado && (
              'La foto ya está guardada. El servidor corta solo y avisa como muy tarde a los dos minutos, así que esta pantalla se va a mover sola: no hace falta que la mires. También podés volver y entrar más tarde desde acá mismo, no se pierde ni se vuelve a cobrar.'
            )}
          </p>

          {!subiendo && (
            <div style={{ marginTop: '10px', fontSize: 'var(--txt-xs)', color: 'var(--text-light)', fontVariantNumeric: 'tabular-nums' }}>
              {segundos < 60 ? `${segundos} s` : `${Math.floor(segundos / 60)} min ${segundos % 60} s`}
            </div>
          )}

          <div className="barra-progreso" aria-hidden="true"><span /></div>

          <button type="button" onClick={volverAElegir}
            className="btn btn-secondary btn-bloque" style={{ marginTop: '20px', fontSize: 'var(--txt-sm)' }}>
            {demorado ? 'Volver y seguir después' : 'Cancelar'}
          </button>
        </div>
      </div>
    );
  }

  // ---------- Elegir como cargar ----------
  const tarjeta = {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px',
    padding: esMobile ? '22px 20px' : '28px 24px', textAlign: 'left',
    border: '1px solid var(--border)', borderRadius: '16px',
    background: 'var(--surface)', color: 'inherit',
    cursor: 'pointer', width: '100%', fontFamily: 'inherit',
  };
  const icono = (fondo) => ({
    width: '46px', height: '46px', borderRadius: '13px', display: 'grid',
    placeItems: 'center', color: 'white', background: fondo, flexShrink: 0,
  });

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <Link to="/sistema/motores" className="btn btn-secondary" style={{ textDecoration: 'none', fontWeight: 600 }}>
          <ArrowLeft size={15} /> Volver
        </Link>
        <h2 style={{ margin: 0, fontSize: 'var(--txt-xl)' }}>Nueva ficha</h2>
      </div>

      {error ? (
        <Alert variant="error" className="mb-3">
          <div>{error}</div>
          {/* Con la ficha todavia en la URL, la foto sigue arriba: se puede
              reintentar la lectura sin sacarla de nuevo. Que la falla haya
              sido del proveedor no tiene por que costarle a alguien otra
              vuelta al banco de trabajo. */}
          {fichaId ? (
            <button type="button" onClick={reintentar}
              className="btn btn-secondary"
              style={{ marginTop: '10px', fontSize: 'var(--txt-sm)' }}>
              <RotateCw size={14} /> Reintentar con la misma foto
            </button>
          ) : null}
        </Alert>
      ) : null}

      <p style={{ color: 'var(--text-light)', fontSize: 'var(--txt-base)', marginTop: 0, marginBottom: '18px' }}>
        ¿Cómo querés cargarla?
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
        <button type="button" style={tarjeta}
          onClick={() => (esMobile ? camara.current?.click() : entrada.current?.click())}>
          <span style={icono('var(--gradient-primary)')}><Camera size={22} /></span>
          <span style={{ fontWeight: 700, fontSize: 'var(--txt-md)' }}>Escanear la ficha</span>
          <span style={{ fontSize: 'var(--txt-sm)', color: 'var(--text-light)', lineHeight: 1.5 }}>
            {esMobile
              ? 'Sacale una foto a la ficha de papel. El sistema la lee y vos revisás antes de guardar.'
              : 'Elegí la foto de la ficha de papel. El sistema la lee y vos revisás antes de guardar.'}
          </span>
        </button>

        <button type="button" style={tarjeta} onClick={() => setParams({ modo: 'manual' })}>
          <span style={icono('var(--surface-2, #64748b)')}><PencilLine size={22} /></span>
          <span style={{ fontWeight: 700, fontSize: 'var(--txt-md)' }}>Cargar a mano</span>
          <span style={{ fontSize: 'var(--txt-sm)', color: 'var(--text-light)', lineHeight: 1.5 }}>
            El formulario en blanco, campo por campo.
          </span>
        </button>
      </div>

      {esMobile && (
        <button type="button" onClick={() => entrada.current?.click()}
          className="btn btn-secondary"
          style={{ marginTop: '12px', width: '100%', fontSize: 'var(--txt-sm)' }}>
          Elegir una foto de la galería
        </button>
      )}

      <div style={{ marginTop: '20px', display: 'flex', gap: '9px', alignItems: 'flex-start', color: 'var(--text-light)', fontSize: 'var(--txt-sm)' }}>
        <TriangleAlert size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          La lectura automática nunca se guarda sola: siempre la revisás vos antes.
          Una ficha mal cargada es un motor mal bobinado.
        </span>
      </div>

      {/* capture pide la camara directamente en el celular; el otro input
          abre archivos, para la galeria o la compu. */}
      <input ref={camara} type="file" accept="image/*" capture="environment"
        onChange={subir} style={{ display: 'none' }} />
      <input ref={entrada} type="file" accept="image/*"
        onChange={subir} style={{ display: 'none' }} />
    </div>
  );
};

export default NuevoMotor;
