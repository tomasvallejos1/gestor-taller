import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Camera, PencilLine, ScanLine, TriangleAlert,
} from 'lucide-react';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import { useEsMobile } from '../lib/useMediaQuery';
import { cargarFichaPorFoto, seguirExtraccion, obtenerExtraccion } from '../lib/extraccion';
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

  // Mientras lee, se escucha el cambio de estado en vez de encuestar la
  // base cada dos segundos.
  useEffect(() => {
    if (paso !== PASOS.LEYENDO || !fichaId) return undefined;
    return seguirExtraccion(fichaId, (fila) => {
      if (fila.estado === 'revision') {
        setPaso(PASOS.REVISAR);
      } else if (fila.estado === 'error') {
        setError(fila.error ?? 'No se pudo leer la ficha. Probá con otra foto, mejor iluminada.');
        setParams({}, { replace: true });
      }
    });
  }, [paso, fichaId, setParams]);

  const subir = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;

    setPaso(PASOS.SUBIENDO);
    setError('');
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
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: esMobile ? '40px 4px' : '64px 0' }}>
        <div className="ui-card" style={{ padding: esMobile ? '32px 20px' : '44px 32px', textAlign: 'center' }}>
          <div className="escaner" aria-hidden="true">
            <ScanLine size={38} />
          </div>

          <h2 style={{ fontSize: '1.2rem', margin: '22px 0 8px' }}>
            {subiendo ? 'Subiendo la foto...' : 'Leyendo la ficha'}
          </h2>
          <p style={{ color: 'var(--text-light)', fontSize: '0.92rem', margin: 0 }}>
            {subiendo
              ? 'Un segundo, se esta achicando y subiendo la imagen.'
              : 'Puede tardar hasta medio minuto. Podés dejar la pantalla prendida; si se corta, volvé a entrar y la lectura sigue acá.'}
          </p>

          <div className="barra-progreso" aria-hidden="true"><span /></div>

          <button type="button" onClick={volverAElegir}
            className="btn btn-secondary" style={{ marginTop: '22px', fontSize: '0.86rem' }}>
            Cancelar
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
        <h2 style={{ margin: 0, fontSize: '1.45rem' }}>Nueva ficha</h2>
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

      <p style={{ color: 'var(--text-light)', fontSize: '0.95rem', marginTop: 0, marginBottom: '18px' }}>
        ¿Cómo querés cargarla?
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
        <button type="button" style={tarjeta}
          onClick={() => (esMobile ? camara.current?.click() : entrada.current?.click())}>
          <span style={icono('var(--gradient-primary)')}><Camera size={22} /></span>
          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Escanear la ficha</span>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-light)', lineHeight: 1.5 }}>
            {esMobile
              ? 'Sacale una foto a la ficha de papel. El sistema la lee y vos revisás antes de guardar.'
              : 'Elegí la foto de la ficha de papel. El sistema la lee y vos revisás antes de guardar.'}
          </span>
        </button>

        <button type="button" style={tarjeta} onClick={() => setParams({ modo: 'manual' })}>
          <span style={icono('var(--surface-2, #64748b)')}><PencilLine size={22} /></span>
          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Cargar a mano</span>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-light)', lineHeight: 1.5 }}>
            El formulario en blanco, campo por campo.
          </span>
        </button>
      </div>

      {esMobile && (
        <button type="button" onClick={() => entrada.current?.click()}
          className="btn btn-secondary"
          style={{ marginTop: '12px', width: '100%', fontSize: '0.88rem' }}>
          Elegir una foto de la galería
        </button>
      )}

      <div style={{ marginTop: '20px', display: 'flex', gap: '9px', alignItems: 'flex-start', color: 'var(--text-light)', fontSize: '0.84rem' }}>
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
