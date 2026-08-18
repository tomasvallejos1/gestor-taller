import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileDown, Share2, Check, FileText, Truck, Receipt,
  ArrowRight, Wrench, User, Settings2,
} from 'lucide-react';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import {
  ESTADOS, ETIQUETA_ESTADO, COLOR_ESTADO, SIGUIENTE_ESTADO,
  obtenerReparacion, guardarReparacion, cambiarEstado,
} from '../lib/reparaciones';
import { pesos } from '../lib/presupuestos';
import * as remitos from '../lib/remitos';
import * as facturas from '../lib/facturas';
import { ETIQUETA_ESTADO_FACTURA, COLOR_ESTADO_FACTURA, letraFactura } from '../lib/facturas';

/**
 * Una orden de reparacion.
 *
 * Se abre parado al lado del banco, con el motor adelante, para hacer
 * una de dos cosas: ver por donde va, o empujarla al paso siguiente.
 * Por eso arriba de todo va el estado y el boton que lo avanza, y
 * recien despues el detalle.
 *
 * Los tres documentos --presupuesto, remito, factura-- se dibujan
 * iguales a proposito: son el mismo objeto en tres momentos del
 * trabajo, y compartir forma es lo que deja ver de un vistazo hasta
 * donde llego la orden.
 */

const comprobanteDe = (x) => `${String(x.punto_venta ?? 1).padStart(4, '0')}-${String(x.numero ?? 0).padStart(8, '0')}`;

/** Un par etiqueta/valor, con el hueco marcado cuando no hay dato. */
const Dato = ({ label, children, vacio }) => (
  <div>
    <span className="dato__label">{label}</span>
    <div className={`dato__valor${vacio ? ' dato__valor--vacio' : ''}`}>{children}</div>
  </div>
);

/** Tarjeta de documento. `acciones` solo se dibuja si hay algo que hacer. */
const Doc = ({ icono, titulo, sub, hay, acciones }) => {
  const Icono = icono;
  return (
    <div className={`doc${hay ? '' : ' doc--vacio'}`}>
      <span className="doc__icono"><Icono size={18} /></span>
      <div className="doc__cuerpo">
        <div className="doc__titulo">{titulo}</div>
        <div className="doc__sub">{sub}</div>
      </div>
      {acciones}
    </div>
  );
};

const ReparacionDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { esEditor } = useAuth();

  const [rep, setRep] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [diagnostico, setDiagnostico] = useState('');
  const [guardandoDiag, setGuardandoDiag] = useState(false);
  const [avanzando, setAvanzando] = useState(false);
  const [verEstados, setVerEstados] = useState(false);

  const [creandoRemito, setCreandoRemito] = useState(false);
  const [generandoPdfRemito, setGenerandoPdfRemito] = useState(false);
  const [copiadoRemito, setCopiadoRemito] = useState(false);

  const [creandoFactura, setCreandoFactura] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [generandoPdfFactura, setGenerandoPdfFactura] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const r = await obtenerReparacion(id);
      if (!r) { setError('No encontramos esa orden.'); return; }
      setRep(r);
      setDiagnostico(r.diagnostico ?? '');
    } catch (e) {
      setError(e.message ?? 'No se pudo cargar la orden.');
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiar = async (estado) => {
    setError('');
    setAvanzando(true);
    try {
      await cambiarEstado(id, estado);
      setVerEstados(false);
      await cargar();
    } catch (e) {
      setError(e.message ?? 'No se pudo cambiar el estado.');
    } finally {
      setAvanzando(false);
    }
  };

  const guardarDiagnostico = async () => {
    setGuardandoDiag(true);
    setError('');
    try {
      await guardarReparacion({ ...rep, diagnostico });
      await cargar();
      setAviso('Diagnostico guardado.');
    } catch (e) {
      setError(e.message ?? 'No se pudo guardar el diagnostico.');
    } finally {
      setGuardandoDiag(false);
    }
  };

  // Las acciones de abajo comparten forma: apagan el aviso viejo,
  // corren, y refrescan. `cargar()` limpia `error` al empezar, asi que
  // el mensaje de fallo se escribe DESPUES de refrescar o se borraria
  // apenas se pinta.
  const accion = (setLoading, fn, exito) => async () => {
    setLoading(true);
    setError('');
    setAviso('');
    try {
      const r = await fn();
      await cargar();
      if (exito) setAviso(exito(r));
    } catch (e) {
      await cargar();
      setError(e.message ?? 'No se pudo completar la accion.');
    } finally {
      setLoading(false);
    }
  };

  const crearRemito = accion(setCreandoRemito,
    () => remitos.crearDesdeReparacion(id, rep.presupuesto?.id ?? null));

  const crearFactura = accion(setCreandoFactura,
    () => facturas.crearDesdeRemito(rep.remito.id));

  const emitirFactura = accion(setEmitiendo,
    () => facturas.emitir(rep.factura.id),
    (r) => (r.ya_estaba ? 'Esta factura ya estaba autorizada.' : `Factura autorizada. CAE ${r.cae}.`));

  const verificarFactura = accion(setVerificando,
    () => facturas.reconciliar(rep.factura.id),
    (r) => r.mensaje ?? (r.estado === 'autorizada' ? `Autorizada. CAE ${r.cae}.` : 'Todavia sin novedades.'));

  const abrirPdf = async (setLoading, fn) => {
    setLoading(true);
    setError('');
    try {
      const { url } = await fn();
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copiarLinkRemito = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/r/${rep.remito.token_publico}`);
    setCopiadoRemito(true);
    setTimeout(() => setCopiadoRemito(false), 2200);
  };

  if (cargando) {
    return <div style={{ padding: '48px' }}><Spinner label="Cargando..." size="lg" centered /></div>;
  }
  if (!rep) {
    return (
      <div style={{ padding: '32px' }}>
        <Alert variant="error">{error || 'No encontrado.'}</Alert>
        <Link to="/sistema/reparaciones" className="btn btn-secondary"
          style={{ marginTop: 16, textDecoration: 'none' }}>
          <ArrowLeft size={15} /> Volver
        </Link>
      </div>
    );
  }

  const siguiente = SIGUIENTE_ESTADO[rep.estado];
  const puedeRemito = ['terminado', 'entregado'].includes(rep.estado) && rep.cliente;
  const puedeFactura = rep.remito && (!rep.factura || rep.factura.estado === 'rechazada');
  const f = rep.factura;

  return (
    <div>
      <div className="pantalla-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <Link to="/sistema/reparaciones" className="icono-btn" aria-label="Volver a reparaciones">
            <ArrowLeft size={18} />
          </Link>
          <div style={{ minWidth: 0 }}>
            <h2 className="pantalla-titulo">Orden #{rep.numero}</h2>
            <p className="pantalla-sub">
              {rep.cliente?.nombre ?? 'Sin cliente'}
              {' · '}
              Ingreso {new Date(rep.ingreso).toLocaleDateString('es-AR')}
            </p>
          </div>
        </div>
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}
      {aviso ? <Alert variant="success" className="mb-3">{aviso}</Alert> : null}

      {/* ---------------- Estado y paso siguiente ---------------- */}
      <div className="seccion" style={{ marginTop: 0 }}>
        <div className="seccion__cab">
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="dato__label">Estado actual</span>
            <div style={{ marginTop: '4px' }}>
              <span className="etiqueta etiqueta--fuerte"
                style={{ color: COLOR_ESTADO[rep.estado], borderColor: 'currentColor', background: 'none' }}>
                {ETIQUETA_ESTADO[rep.estado]}
              </span>
            </div>
          </div>
          {esEditor && (
            <button type="button" className="icono-btn" aria-label="Elegir otro estado"
              aria-expanded={verEstados} onClick={() => setVerEstados((v) => !v)}>
              <Settings2 size={17} />
            </button>
          )}
        </div>

        {esEditor && siguiente && !verEstados && (
          <>
            <button type="button" className="paso" onClick={() => cambiar(siguiente)}
              disabled={avanzando}>
              <ArrowRight size={19} />
              Marcar {ETIQUETA_ESTADO[siguiente].toLowerCase()}
            </button>
            {rep.estado === 'terminado' && (
              <p className="paso__hint">Al entregar se registra la fecha de egreso.</p>
            )}
          </>
        )}

        {esEditor && verEstados && (
          <div>
            <label className="campo-label" htmlFor="rd-estado">Cambiar a</label>
            <select id="rd-estado" className="ui-input" value={rep.estado}
              onChange={(e) => cambiar(e.target.value)}>
              {ESTADOS.map((e2) => <option key={e2} value={e2}>{ETIQUETA_ESTADO[e2]}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ---------------- Datos ---------------- */}
      <div className="seccion">
        <div className="datos">
          <Dato label="Cliente" vacio={!rep.cliente}>
            {rep.cliente ? (
              <Link to="/sistema/clientes" style={{ fontWeight: 700 }}>{rep.cliente.nombre}</Link>
            ) : 'Sin cliente asignado'}
          </Dato>

          <Dato label="Ficha del motor" vacio={!rep.motor}>
            {rep.motor ? (
              <Link to={`/sistema/motores/ver/${rep.motor.nro_motor}`} style={{ fontWeight: 700 }}>
                #{rep.motor.nro_motor} {rep.motor.descripcion}
              </Link>
            ) : 'Sin ficha — se vincula al editar la orden'}
          </Dato>

          <Dato label="Ingreso">{new Date(rep.ingreso).toLocaleDateString('es-AR')}</Dato>

          {rep.egreso && (
            <Dato label="Egreso">{new Date(rep.egreso).toLocaleDateString('es-AR')}</Dato>
          )}
        </div>

        {rep.problema && (
          <div style={{ marginTop: '16px' }}>
            <span className="dato__label">Problema declarado</span>
            <div className="dato__valor">{rep.problema}</div>
          </div>
        )}
      </div>

      {/* ---------------- Diagnostico ---------------- */}
      {esEditor && (
        <div className="seccion">
          <div className="seccion__cab">
            <Wrench size={17} />
            <div>
              <h3 className="seccion__titulo">Diagnostico</h3>
              <p className="seccion__ayuda">Que se encontro y que se hizo. Se imprime en el remito.</p>
            </div>
          </div>

          <textarea rows={3} className="ui-input" style={{ resize: 'vertical' }}
            value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)}
            placeholder="Ej: Bobinado de arranque quemado, se rebobino completo." />

          {diagnostico !== (rep.diagnostico ?? '') && (
            <div className="acciones">
              <button type="button" className="btn btn-secondary"
                onClick={() => setDiagnostico(rep.diagnostico ?? '')}>
                Descartar
              </button>
              <Button variant="primary" onClick={guardarDiagnostico} isLoading={guardandoDiag}>
                Guardar diagnostico
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ---------------- Documentos ---------------- */}
      <div className="seccion">
        <div className="seccion__cab">
          <FileText size={17} />
          <h3 className="seccion__titulo">Documentos</h3>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <Doc
            icono={FileText}
            hay={Boolean(rep.presupuesto)}
            titulo="Presupuesto"
            sub={rep.presupuesto
              ? `N° ${rep.presupuesto.numero} · ${pesos(rep.presupuesto.total)}`
              : 'Todavia no se cargo'}
            acciones={esEditor && (rep.presupuesto ? (
              <Link to={`/sistema/presupuestos/${rep.presupuesto.id}`} className="btn btn-secondary">
                Ver
              </Link>
            ) : (
              <button type="button" className="btn btn-secondary"
                onClick={() => navigate(`/sistema/presupuestos/nuevo?reparacion=${id}`)}>
                Crear
              </button>
            ))}
          />

          <Doc
            icono={Truck}
            hay={Boolean(rep.remito)}
            titulo="Remito de entrega"
            sub={rep.remito
              ? `N° ${comprobanteDe(rep.remito)} · ${pesos(rep.remito.total)}`
              : puedeRemito
                ? 'Todavia no se emitio'
                : 'Se habilita con la orden terminada y un cliente asignado'}
            acciones={esEditor && !rep.remito && puedeRemito && (
              <Button variant="primary" onClick={crearRemito} isLoading={creandoRemito}>
                Emitir
              </Button>
            )}
          />

          {rep.remito && esEditor && (
            <div className="acciones" style={{ marginTop: 0 }}>
              <Link to={`/sistema/remitos/${rep.remito.id}`} className="btn btn-secondary">
                Editar remito
              </Link>
              <Button variant="secondary" isLoading={generandoPdfRemito}
                onClick={() => abrirPdf(setGenerandoPdfRemito, () => remitos.generarPdf(rep.remito.id))}>
                <FileDown size={15} /> PDF
              </Button>
              <button type="button" className="btn btn-secondary" onClick={copiarLinkRemito}>
                {copiadoRemito ? <Check size={15} /> : <Share2 size={15} />}
                {copiadoRemito ? 'Copiado' : 'Copiar link'}
              </button>
            </div>
          )}

          <Doc
            icono={Receipt}
            hay={Boolean(f)}
            titulo={f ? `Factura ${letraFactura(f.cbte_tipo)}` : 'Factura'}
            sub={f
              ? `${f.numero ? comprobanteDe(f) : 'sin numero'} · ${pesos(f.total)}`
              : rep.remito ? 'Todavia no se emitio' : 'Se habilita cuando hay un remito'}
            acciones={f ? (
              <span className="etiqueta"
                style={{ color: COLOR_ESTADO_FACTURA[f.estado], borderColor: 'currentColor' }}>
                {ETIQUETA_ESTADO_FACTURA[f.estado]}
              </span>
            ) : esEditor && puedeFactura && (
              <Button variant="primary" onClick={crearFactura} isLoading={creandoFactura}>
                Facturar
              </Button>
            )}
          />

          {esEditor && f && (
            <div className="acciones" style={{ marginTop: 0 }}>
              {f.estado === 'pendiente' && (
                <>
                  <Button variant="primary" onClick={emitirFactura} isLoading={emitiendo}>
                    Emitir CAE
                  </Button>
                  <Button variant="secondary" onClick={verificarFactura} isLoading={verificando}>
                    Verificar en ARCA
                  </Button>
                </>
              )}
              {f.estado === 'rechazada' && (
                <Button variant="primary" onClick={crearFactura} isLoading={creandoFactura}>
                  Reintentar
                </Button>
              )}
              {f.estado === 'autorizada' && (
                <Button variant="secondary" isLoading={generandoPdfFactura}
                  onClick={() => abrirPdf(setGenerandoPdfFactura, () => facturas.generarPdf(f.id))}>
                  <FileDown size={15} /> PDF de la factura
                </Button>
              )}
            </div>
          )}

          {f?.estado === 'rechazada' && f?.arca_errores && (
            <Alert variant="error">
              ARCA rechazo el comprobante: {JSON.stringify(f.arca_errores)}
            </Alert>
          )}
        </div>
      </div>

      {!rep.cliente && (
        <div style={{ marginTop: '16px' }}>
          <Alert variant="warning">
            <User size={15} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
            Esta orden no tiene cliente. Sin cliente no se puede consultar el seguimiento
            publico ni emitir el remito.
          </Alert>
        </div>
      )}
    </div>
  );
};

export default ReparacionDetalle;
