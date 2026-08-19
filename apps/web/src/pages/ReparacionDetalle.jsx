import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileDown, Share2, Check, FileText, Truck, Receipt,
  ArrowRight, Wrench, User, Settings2, Wallet, Plus, Trash2,
  AlertTriangle, Phone,
} from 'lucide-react';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import Modal from '../components/Modal';
import HojaPago from '../components/HojaPago';
import { useAuth } from '../context/AuthContext';
import {
  ESTADOS, ETIQUETA_ESTADO, COLOR_ESTADO, SIGUIENTE_ESTADO,
  obtenerReparacion, guardarReparacion, cambiarEstado,
} from '../lib/reparaciones';
import { pesos } from '../lib/presupuestos';
import { fechaCorta } from '../lib/fechas';
import {
  ETIQUETA_ESTADO_PAGO, COLOR_ESTADO_PAGO, MEDIOS,
  cobranzaDe, alertaCobro, etiquetaMedio, listarPagos, eliminarPago, fijarImporte, aNumero,
} from '../lib/pagos';
import * as remitos from '../lib/remitos';
import * as facturas from '../lib/facturas';
import { ETIQUETA_ESTADO_FACTURA, COLOR_ESTADO_FACTURA, letraFactura } from '../lib/facturas';

/**
 * Una orden de reparacion.
 *
 * Se abre parado al lado del banco, con el motor adelante, para hacer
 * una de tres cosas: ver por donde va, empujarla al paso siguiente, o
 * cobrarla. Por eso el orden de la pantalla es ese y no el del modelo
 * de datos: primero donde esta la orden, despues la plata, y recien
 * despues los datos, el diagnostico y los papeles.
 *
 * La cobranza vive aca y no en el remito por una razon practica: se
 * cobra cuando el cliente viene a buscar el motor, no cuando se emite
 * un papel. Muchas ordenes se cobran sin remito, y algunas se cobran en
 * dos veces --una seña al traerlo y el resto al retirarlo--. El remito
 * es un documento; el cobro es un hecho, y se anota cuando pasa.
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

/**
 * El camino de la orden, de un vistazo.
 *
 * Una etiqueta sola ("En proceso") dice donde esta pero no cuanto
 * falta. Los cuatro casilleros dibujados dicen las dos cosas sin que
 * haya que conocer el circuito de antemano.
 *
 * `esperando_repuesto` no es un casillero propio: es "en proceso,
 * frenado". Se dibuja en ese lugar y con el color de aviso, que es
 * exactamente lo que significa.
 */
const PASOS = [
  { estado: 'ingresado', etiqueta: 'Ingresado' },
  { estado: 'en_proceso', etiqueta: 'En proceso' },
  { estado: 'terminado', etiqueta: 'Terminado' },
  { estado: 'entregado', etiqueta: 'Entregado' },
];

const Progreso = ({ estado }) => {
  if (estado === 'cancelado') return null;
  const frenada = estado === 'esperando_repuesto';
  const actual = frenada ? 1 : PASOS.findIndex((p) => p.estado === estado);

  return (
    <ol className="progreso" aria-label="Avance de la orden">
      {PASOS.map((p, i) => {
        const hecho = i < actual;
        const esActual = i === actual;
        return (
          <li key={p.estado}
            className={`progreso__paso${hecho ? ' hecho' : ''}${esActual ? ' actual' : ''}${esActual && frenada ? ' frenada' : ''}`}
            aria-current={esActual ? 'step' : undefined}>
            <span className="progreso__punto" aria-hidden="true">
              {hecho ? <Check size={11} strokeWidth={3.2} /> : null}
            </span>
            <span className="progreso__label">
              {esActual && frenada ? 'Esperando repuesto' : p.etiqueta}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

const ReparacionDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { esEditor } = useAuth();

  const [rep, setRep] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [diagnostico, setDiagnostico] = useState('');
  const [guardandoDiag, setGuardandoDiag] = useState(false);
  const [avanzando, setAvanzando] = useState(false);
  const [verEstados, setVerEstados] = useState(false);
  const [aEntregar, setAEntregar] = useState(false);

  const [cobrando, setCobrando] = useState(false);
  const [aFacturarServicio, setAFacturarServicio] = useState(false);
  const [editandoImporte, setEditandoImporte] = useState(false);
  const [importe, setImporte] = useState('');
  const [guardandoImporte, setGuardandoImporte] = useState(false);
  const [pagoABorrar, setPagoABorrar] = useState(null);

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
      // Los pagos son de editores: pedirlos como lector es un viaje que
      // siempre vuelve vacio.
      setPagos(esEditor ? await listarPagos(id) : []);
    } catch (e) {
      setError(e.message ?? 'No se pudo cargar la orden.');
    } finally {
      setCargando(false);
    }
  }, [id, esEditor]);

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

  const avisoEmision = (r) => (
    r.ya_estaba ? 'Esta factura ya estaba autorizada.' : `Factura autorizada. CAE ${r.cae}.`
  );

  const emitirFactura = accion(setEmitiendo,
    () => facturas.emitir(rep.factura.id), avisoEmision);

  // Las dos cosas van juntas y en este orden: si el renglon se carga y
  // la emision falla, la factura queda pendiente CON el renglon y el
  // proximo intento ya no pasa por aca --la RPC se niega a duplicarlo--.
  const emitirComoServicio = accion(setEmitiendo, async () => {
    await facturas.completarConServicio(rep.factura.id);
    return facturas.emitir(rep.factura.id);
  }, avisoEmision);

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

  const guardarImporte = async (valor) => {
    setGuardandoImporte(true);
    setError('');
    try {
      await fijarImporte(id, valor);
      setEditandoImporte(false);
      await cargar();
    } catch (e) {
      setError(e.message ?? 'No se pudo guardar el importe.');
    } finally {
      setGuardandoImporte(false);
    }
  };

  const borrarPago = async () => {
    const p = pagoABorrar;
    setPagoABorrar(null);
    setError('');
    try {
      await eliminarPago(p.id);
      await cargar();
    } catch (e) {
      setError(e.message ?? 'No se pudo borrar el pago.');
    }
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

  const cob = cobranzaDe(rep);
  const alerta = alertaCobro(rep);
  // Una factura sin renglones vale 0, y ARCA no autoriza un comprobante
  // de cero. Es el trabajo que se hizo sin presupuesto: el importe esta
  // en la cobranza y hay que bajarlo a un renglon antes de emitir.
  const facturaSinRenglones = Boolean(f) && !(Number(f.total) > 0);
  const avance = cob.total > 0 ? Math.min(100, Math.round((cob.pagado / cob.total) * 100)) : 0;
  const recargos = Math.round((cob.cobrado - cob.pagado) * 100) / 100;

  // De donde sale el importe. Que se vea evita la pregunta de siempre:
  // "¿y este numero de donde salio?".
  const origenImporte = cob.importe !== null
    ? 'Importe puesto a mano'
    : rep.remito && cob.importe_doc !== null
      ? `Del remito ${comprobanteDe(rep.remito)}`
      : rep.presupuesto && cob.importe_doc !== null
        ? `Del presupuesto N° ${rep.presupuesto.numero}`
        : null;

  /**
   * Emitir el CAE. Si la factura no tiene renglones, no se emite de
   * callado con un importe sacado de la cobranza: se muestra el numero
   * y se pide confirmar. Es un comprobante fiscal y despues del CAE no
   * se corrige.
   */
  const pedirEmision = () => {
    if (!facturaSinRenglones) { emitirFactura(); return; }
    if (!(cob.total > 0)) {
      setAviso('');
      setError('Esta factura no tiene renglones y la orden no tiene importe cargado. '
        + 'Pone el importe a cobrar en Cobranza y volve a intentar.');
      return;
    }
    setAFacturarServicio(true);
  };

  const avanzarPaso = () => {
    // Entregar el motor con saldo pendiente se pregunta antes: despues
    // de que sale del taller, cobrar depende de que el cliente vuelva.
    if (siguiente === 'entregado' && cob.total && cob.saldo > 0) setAEntregar(true);
    else cambiar(siguiente);
  };

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
              Ingreso {fechaCorta(rep.ingreso)}
            </p>
          </div>
        </div>

        {/* El telefono del cliente, a un toque. Es la accion que sigue a
            "esta terminado" y estaba a dos pantallas de distancia. */}
        {rep.cliente?.telefono && (
          <a href={`tel:${rep.cliente.telefono}`} className="icono-btn"
            aria-label={`Llamar a ${rep.cliente.nombre}`}>
            <Phone size={17} />
          </a>
        )}
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}
      {aviso ? <Alert variant="success" className="mb-3">{aviso}</Alert> : null}

      {/* Un motor que ya se fue y no se cobro es lo primero que hay que
          ver al abrir la orden, antes que cualquier otra cosa. */}
      {alerta && (
        <Alert variant="error" className="mb-3">
          <strong>Entregado sin cobrar.</strong> Queda un saldo de {pesos(cob.saldo)}
          {rep.egreso ? ` desde el ${fechaCorta(rep.egreso)}` : ''}.
        </Alert>
      )}

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

        <Progreso estado={rep.estado} />

        {esEditor && siguiente && !verEstados && (
          <>
            <button type="button" className="paso" onClick={avanzarPaso} disabled={avanzando}>
              <ArrowRight size={19} />
              Marcar {ETIQUETA_ESTADO[siguiente].toLowerCase()}
            </button>
            {rep.estado === 'terminado' && (
              <p className="paso__hint">Al entregar se registra la fecha de egreso.</p>
            )}
          </>
        )}

        {esEditor && verEstados && (
          <div style={{ marginTop: '14px' }}>
            <label className="campo-label" htmlFor="rd-estado">Cambiar a</label>
            <select id="rd-estado" className="ui-input" value={rep.estado}
              onChange={(e) => cambiar(e.target.value)}>
              {ESTADOS.map((e2) => <option key={e2} value={e2}>{ETIQUETA_ESTADO[e2]}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ---------------- Cobranza ---------------- */}
      {esEditor && (
        <div className="seccion">
          <div className="seccion__cab">
            <Wallet size={17} />
            <h3 className="seccion__titulo">Cobranza</h3>
            <span className="etiqueta" style={{
              marginLeft: 'auto',
              color: alerta ? 'var(--danger)' : COLOR_ESTADO_PAGO[cob.estado],
              borderColor: 'currentColor',
            }}>
              {ETIQUETA_ESTADO_PAGO[cob.estado]}
            </span>
          </div>

          {cob.total > 0 ? (
            <>
              <div className="cobranza__cifra">
                <span className="dato__label">
                  {cob.saldo > 0 ? 'Resta cobrar' : 'Cobrado por completo'}
                </span>
                <div className="cobranza__monto"
                  style={{ color: alerta ? 'var(--danger)' : undefined }}>
                  {pesos(cob.saldo > 0 ? cob.saldo : cob.total)}
                </div>
              </div>

              {/* El color de la barra lo pone el componente y no el CSS
                  porque depende de tres cosas a la vez (cuanto se
                  cobro, si esta entregada y si quedo saldo), y eso una
                  clase sola no lo sabe. */}
              <div className="cobranza__barra" role="img" aria-label={`${avance}% cobrado`}>
                <span style={{
                  width: `${Math.max(avance, cob.pagado > 0 ? 4 : 0)}%`,
                  background: avance >= 100
                    ? 'var(--success)'
                    : alerta ? 'var(--danger)' : 'var(--warning)',
                }} />
              </div>

              <div className="cobranza__pie">
                <span>{pesos(cob.pagado)} de {pesos(cob.total)}</span>
                {origenImporte && <span>{origenImporte}</span>}
              </div>

              {recargos > 0 && (
                <p className="campo-ayuda" style={{ marginTop: '6px' }}>
                  Entraron {pesos(cob.cobrado)} en caja: {pesos(recargos)} son recargos de tarjeta,
                  que no descuentan deuda.
                </p>
              )}
            </>
          ) : (
            <p className="cobranza__vacia">
              Todavia no hay importe. Se toma solo del remito, o del presupuesto mientras no
              haya remito.
            </p>
          )}

          {cob.saldo > 0 || cob.total <= 0 ? (
            <button type="button" className="paso paso--cobrar" onClick={() => setCobrando(true)}>
              <Plus size={19} /> Registrar pago
            </button>
          ) : null}

          {/* El importe a mano es la valvula de escape para el trabajo
              que se cobra sin papeles. Va abajo y en chico: el camino
              normal es que el numero venga del documento. */}
          {editandoImporte ? (
            <div className="cobranza__importe">
              <label className="campo-label" htmlFor="rd-importe">Importe a cobrar</label>
              <div className="campo-monto">
                <span className="campo-monto__signo">$</span>
                <input id="rd-importe" className="campo-monto__input" inputMode="decimal"
                  value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="0" />
              </div>
              <div className="acciones">
                <button type="button" className="btn btn-secondary"
                  onClick={() => setEditandoImporte(false)}>
                  Cancelar
                </button>
                {/* Vaciar el campo es la forma natural de decir "no va
                    ningun importe": se guarda null y la orden vuelve a
                    tomar el del documento, si lo hay. */}
                <Button variant="primary" isLoading={guardandoImporte}
                  onClick={() => guardarImporte(importe.trim() === '' ? null : aNumero(importe))}>
                  Guardar importe
                </Button>
              </div>
            </div>
          ) : (
            <div className="cobranza__enlaces">
              <button type="button" className="enlace-suave"
                onClick={() => { setImporte(cob.total ? String(cob.total) : ''); setEditandoImporte(true); }}>
                {cob.total > 0 ? 'Cambiar el importe' : 'Poner un importe a mano'}
              </button>
              {/* Solo si el documento dice algo. Un remito sin renglones
                  vale 0, y ofrecer "volver a $ 0,00" es ofrecer borrar
                  el unico importe que la orden tiene. */}
              {cob.importe !== null && cob.importe_doc > 0 && (
                <button type="button" className="enlace-suave" onClick={() => guardarImporte(null)}>
                  Volver al del documento ({pesos(cob.importe_doc)})
                </button>
              )}
            </div>
          )}

          {pagos.length > 0 && (
            <ul className="pagos">
              {pagos.map((p) => {
                const Icono = MEDIOS.find((m) => m.valor === p.medio)?.icono ?? Wallet;
                return (
                  <li key={p.id} className="pago">
                    <span className="pago__icono"><Icono size={16} /></span>
                    <div className="pago__cuerpo">
                      <div className="pago__titulo">
                        {etiquetaMedio(p.medio)}
                        {Number(p.recargo_pct) > 0 && ` · recargo ${Number(p.recargo_pct)}%`}
                      </div>
                      <div className="pago__sub">
                        {fechaCorta(p.fecha)}{p.nota ? ` · ${p.nota}` : ''}
                      </div>
                    </div>
                    <div className="pago__montos">
                      <div className="importe">{pesos(p.cobrado)}</div>
                      {Number(p.recargo) > 0 && (
                        <div className="pago__imputa">imputa {pesos(p.monto)}</div>
                      )}
                    </div>
                    <button type="button" className="pago__quitar" onClick={() => setPagoABorrar(p)}
                      aria-label={`Borrar el pago de ${pesos(p.cobrado)}`}>
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

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

          <Dato label="Ingreso">{fechaCorta(rep.ingreso)}</Dato>

          {rep.egreso && <Dato label="Egreso">{fechaCorta(rep.egreso)}</Dato>}
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
              ? `${f.numero ? comprobanteDe(f) : 'sin numero'} · ${
                facturaSinRenglones ? 'sin renglones' : pesos(f.total)}`
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
                  <Button variant="primary" onClick={pedirEmision} isLoading={emitiendo}>
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
              <strong>ARCA rechazo el comprobante.</strong>{' '}
              {facturas.mensajeArca(f.arca_errores)}
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

      {cobrando && (
        <HojaPago
          reparacion={rep}
          saldo={cob.saldo > 0 ? cob.saldo : 0}
          onCerrar={() => setCobrando(false)}
          onListo={async () => { setCobrando(false); await cargar(); }}
        />
      )}

      <Modal
        isOpen={aEntregar}
        type="danger"
        title="Entregar sin cobrar"
        message={`Queda un saldo de ${pesos(cob.saldo)}. Una vez que el motor sale del taller, cobrar es mas dificil.`}
        confirmLabel="Entregar igual"
        cancelLabel="Registrar pago"
        onClose={() => { setAEntregar(false); setCobrando(true); }}
        onConfirm={async () => { setAEntregar(false); await cambiar('entregado'); }}
      />

      <Modal
        isOpen={aFacturarServicio}
        title="Facturar sin detalle"
        message={`Esta factura no tiene renglones cargados. Se va a emitir con uno solo, "Servicio", por ${pesos(cob.total)}, que es el importe a cobrar de la orden. Despues del CAE la factura no se puede corregir.`}
        confirmLabel={`Emitir por ${pesos(cob.total)}`}
        cancelLabel="Cancelar"
        onClose={() => setAFacturarServicio(false)}
        onConfirm={async () => { setAFacturarServicio(false); await emitirComoServicio(); }}
      />

      <Modal
        isOpen={Boolean(pagoABorrar)}
        type="danger"
        title="Borrar el pago"
        message={pagoABorrar
          ? `Se borra el cobro de ${pesos(pagoABorrar.cobrado)} del ${fechaCorta(pagoABorrar.fecha)}. El saldo de la orden vuelve a subir.`
          : ''}
        confirmLabel="Borrar"
        onClose={() => setPagoABorrar(null)}
        onConfirm={borrarPago}
      />

      {/* Aire para que la barra de abajo del celular no tape el ultimo
          boton de la pantalla. */}
      <div style={{ height: '12px' }} />
    </div>
  );
};

export default ReparacionDetalle;
