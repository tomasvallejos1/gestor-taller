import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileDown, Share2, Check, FileText, Truck, Receipt, Wrench,
} from 'lucide-react';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useEsMobile } from '../lib/useMediaQuery';
import {
  ESTADOS, ETIQUETA_ESTADO, COLOR_ESTADO,
  obtenerReparacion, guardarReparacion, cambiarEstado,
} from '../lib/reparaciones';
import { pesos } from '../lib/presupuestos';
import * as remitos from '../lib/remitos';
import * as facturas from '../lib/facturas';
import { ETIQUETA_ESTADO_FACTURA, COLOR_ESTADO_FACTURA, letraFactura } from '../lib/facturas';

const labelStyle = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700, marginBottom: '6px',
  textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-light)',
};
const inputStyle = {
  width: '100%', padding: '11px 13px', borderRadius: '9px', border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'inherit', boxSizing: 'border-box', fontSize: '1rem', fontFamily: 'inherit',
};

const comprobanteDe = (x) => `${String(x.punto_venta ?? 1).padStart(4, '0')}-${String(x.numero ?? 0).padStart(8, '0')}`;

const ReparacionDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { esEditor } = useAuth();
  const esMobile = useEsMobile();

  const [rep, setRep] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [diagnostico, setDiagnostico] = useState('');
  const [guardandoDiag, setGuardandoDiag] = useState(false);

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
    try {
      await cambiarEstado(id, estado);
      await cargar();
    } catch (e) {
      setError(e.message ?? 'No se pudo cambiar el estado.');
    }
  };

  const guardarDiagnostico = async () => {
    setGuardandoDiag(true);
    setError('');
    try {
      await guardarReparacion({ ...rep, diagnostico });
      setAviso('Diagnostico guardado.');
      await cargar();
    } catch (e) {
      setError(e.message ?? 'No se pudo guardar el diagnostico.');
    } finally {
      setGuardandoDiag(false);
    }
  };

  const crearRemito = async () => {
    setCreandoRemito(true);
    setError('');
    try {
      await remitos.crearDesdeReparacion(id, rep.presupuesto?.id ?? null);
      await cargar();
    } catch (e) {
      setError(e.message ?? 'No se pudo crear el remito.');
    } finally {
      setCreandoRemito(false);
    }
  };

  const pdfRemito = async () => {
    setGenerandoPdfRemito(true);
    setError('');
    try {
      const { url } = await remitos.generarPdf(rep.remito.id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerandoPdfRemito(false);
    }
  };

  const copiarLinkRemito = async () => {
    const url = `${window.location.origin}/r/${rep.remito.token_publico}`;
    await navigator.clipboard.writeText(url);
    setCopiadoRemito(true);
    setTimeout(() => setCopiadoRemito(false), 2200);
  };

  const crearFactura = async () => {
    setCreandoFactura(true);
    setError('');
    try {
      await facturas.crearDesdeRemito(rep.remito.id);
      await cargar();
    } catch (e) {
      setError(e.message ?? 'No se pudo preparar la factura.');
    } finally {
      setCreandoFactura(false);
    }
  };

  const emitirFactura = async () => {
    setEmitiendo(true);
    setError('');
    try {
      const r = await facturas.emitir(rep.factura.id);
      setAviso(r.ya_estaba ? 'Esta factura ya estaba autorizada.' : `Factura autorizada. CAE ${r.cae}.`);
      await cargar();
    } catch (e) {
      // cargar() limpia `error` al empezar (para no arrastrar un error
      // viejo a una carga nueva). Por eso se refresca ANTES de mostrar
      // este: si el orden fuera al reves, el mensaje de ARCA desaparecia
      // apenas se pintaba, tapado por el propio refresco.
      await cargar();
      setError(e.message ?? 'ARCA rechazo el comprobante.');
    } finally {
      setEmitiendo(false);
    }
  };

  const verificarFactura = async () => {
    setVerificando(true);
    setError('');
    try {
      const r = await facturas.reconciliar(rep.factura.id);
      setAviso(r.mensaje ?? (r.estado === 'autorizada' ? `Autorizada. CAE ${r.cae}.` : 'Todavia sin novedades.'));
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setVerificando(false);
    }
  };

  const pdfFactura = async () => {
    setGenerandoPdfFactura(true);
    setError('');
    try {
      const { url } = await facturas.generarPdf(rep.factura.id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerandoPdfFactura(false);
    }
  };

  if (cargando) {
    return <div style={{ padding: '48px' }}><Spinner label="Cargando..." size="lg" centered /></div>;
  }
  if (!rep) {
    return (
      <div style={{ padding: '32px' }}>
        <Alert variant="error">{error || 'No encontrado.'}</Alert>
        <Link to="/sistema/reparaciones" className="btn btn-secondary" style={{ marginTop: 16, textDecoration: 'none' }}>
          <ArrowLeft size={15} /> Volver
        </Link>
      </div>
    );
  }

  const puedeRemito = ['terminado', 'entregado'].includes(rep.estado) && rep.cliente;
  const puedeFactura = rep.remito && (!rep.factura || rep.factura.estado === 'rechazada');

  return (
    <div>
      <div className="pantalla-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/sistema/reparaciones" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={15} /> Volver
          </Link>
          <div>
            <h2 className="pantalla-titulo">Orden #{rep.numero}</h2>
            <span className="etiqueta" style={{ marginTop: '5px', color: COLOR_ESTADO[rep.estado], borderColor: 'currentColor' }}>
              {ETIQUETA_ESTADO[rep.estado]}
            </span>
          </div>
        </div>
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}
      {aviso ? <Alert variant="success" className="mb-3">{aviso}</Alert> : null}

      {/* ---------------- Datos ---------------- */}
      <div className="ui-card" style={{ padding: '18px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
          <div>
            <div style={labelStyle}>Cliente</div>
            {rep.cliente ? (
              <Link to="/sistema/clientes" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
                {rep.cliente.nombre}
              </Link>
            ) : <span style={{ color: 'var(--warning)' }}>Sin cliente asignado</span>}
          </div>
          <div>
            <div style={labelStyle}>Ficha del motor</div>
            {rep.motor ? (
              <Link to={`/sistema/motores/ver/${rep.motor.nro_motor}`} style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
                #{rep.motor.nro_motor} {rep.motor.descripcion}
              </Link>
            ) : <span style={{ color: 'var(--text-light)' }}>Sin ficha vinculada</span>}
          </div>
        </div>

        {rep.problema && (
          <div style={{ marginTop: '14px' }}>
            <div style={labelStyle}>Problema declarado</div>
            <p style={{ margin: 0 }}>{rep.problema}</p>
          </div>
        )}

        {esEditor && (
          <div style={{ marginTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={labelStyle}>Estado</span>
            <select value={rep.estado} onChange={(e) => cambiar(e.target.value)}
              style={{ ...inputStyle, width: 'auto', minWidth: '180px' }}>
              {ESTADOS.map((e2) => <option key={e2} value={e2}>{ETIQUETA_ESTADO[e2]}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ---------------- Diagnostico ---------------- */}
      {esEditor && (
        <div className="ui-card" style={{ padding: '18px', marginBottom: '16px' }}>
          <h3 style={{ marginTop: 0, fontSize: '1.05rem' }}>Diagnostico</h3>
          <p style={{ marginTop: 0, fontSize: '0.85rem', color: 'var(--text-light)' }}>
            Que se encontro y que se hizo. Se imprime en el remito.
          </p>
          <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }}
            value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)}
            placeholder="Ej: Bobinado de arranque quemado, se rebobino completo." />
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={guardarDiagnostico} isLoading={guardandoDiag}>
              Guardar diagnostico
            </Button>
          </div>
        </div>
      )}

      {/* ---------------- Presupuesto ---------------- */}
      <div className="ui-card" style={{ padding: '18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={18} style={{ color: 'var(--text-light)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Presupuesto</h3>
              {rep.presupuesto ? (
                <span style={{ fontSize: '0.88rem', color: 'var(--text-light)' }}>
                  N° {rep.presupuesto.numero} · {pesos(rep.presupuesto.total)}
                </span>
              ) : <span style={{ fontSize: '0.88rem', color: 'var(--text-light)' }}>Todavia no se cargo</span>}
            </div>
          </div>
          {esEditor && (rep.presupuesto ? (
            <Link to={`/sistema/presupuestos/${rep.presupuesto.id}`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              Ver
            </Link>
          ) : (
            <button type="button" className="btn btn-primary"
              onClick={() => navigate(`/sistema/presupuestos/nuevo?reparacion=${id}`)}>
              Crear presupuesto
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- Remito ---------------- */}
      <div className="ui-card" style={{ padding: '18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck size={18} style={{ color: 'var(--text-light)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Remito</h3>
              {rep.remito ? (
                <span style={{ fontSize: '0.88rem', color: 'var(--text-light)' }}>
                  N° {comprobanteDe(rep.remito)} · {pesos(rep.remito.total)}
                </span>
              ) : (
                <span style={{ fontSize: '0.88rem', color: 'var(--text-light)' }}>
                  {puedeRemito ? 'Todavia no se emitio' : 'Se habilita cuando la orden esta terminada o entregada, con cliente'}
                </span>
              )}
            </div>
          </div>
          {esEditor && (rep.remito ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Link to={`/sistema/remitos/${rep.remito.id}`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                Editar
              </Link>
              <Button variant="secondary" onClick={pdfRemito} isLoading={generandoPdfRemito}>
                <FileDown size={15} /> PDF
              </Button>
              <button type="button" className="btn btn-secondary" onClick={copiarLinkRemito}>
                {copiadoRemito ? <Check size={15} /> : <Share2 size={15} />}
                {copiadoRemito ? 'Copiado' : 'Copiar link'}
              </button>
            </div>
          ) : puedeRemito && (
            <Button variant="primary" onClick={crearRemito} isLoading={creandoRemito}>
              Emitir remito
            </Button>
          ))}
        </div>
      </div>

      {/* ---------------- Factura ---------------- */}
      <div className="ui-card" style={{ padding: '18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Receipt size={18} style={{ color: 'var(--text-light)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Factura</h3>
              {rep.factura ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '2px 9px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 700,
                    border: `1px solid ${COLOR_ESTADO_FACTURA[rep.factura.estado]}`,
                    color: COLOR_ESTADO_FACTURA[rep.factura.estado],
                  }}>
                    {ETIQUETA_ESTADO_FACTURA[rep.factura.estado]}
                  </span>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-light)' }}>
                    {rep.factura.numero
                      ? `${letraFactura(rep.factura.cbte_tipo)} ${comprobanteDe(rep.factura)}`
                      : `Factura ${letraFactura(rep.factura.cbte_tipo)}`} · {pesos(rep.factura.total)}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: '0.88rem', color: 'var(--text-light)' }}>
                  {rep.remito ? 'Todavia no se emitio' : 'Se habilita cuando hay un remito'}
                </span>
              )}
            </div>
          </div>
          {esEditor && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!rep.factura && puedeFactura && (
                <Button variant="primary" onClick={crearFactura} isLoading={creandoFactura}>
                  Facturar
                </Button>
              )}
              {rep.factura && rep.factura.estado === 'pendiente' && (
                <>
                  <Button variant="primary" onClick={emitirFactura} isLoading={emitiendo}>
                    Emitir CAE
                  </Button>
                  <Button variant="secondary" onClick={verificarFactura} isLoading={verificando}>
                    Verificar en ARCA
                  </Button>
                </>
              )}
              {rep.factura && rep.factura.estado === 'rechazada' && (
                <Button variant="primary" onClick={crearFactura} isLoading={creandoFactura}>
                  Reintentar
                </Button>
              )}
              {rep.factura?.estado === 'autorizada' && (
                <Button variant="secondary" onClick={pdfFactura} isLoading={generandoPdfFactura}>
                  <FileDown size={15} /> PDF
                </Button>
              )}
            </div>
          )}
        </div>

        {rep.factura?.estado === 'rechazada' && rep.factura?.arca_errores && (
          <div style={{ marginTop: '12px' }}>
            <Alert variant="error">{JSON.stringify(rep.factura.arca_errores)}</Alert>
          </div>
        )}
      </div>

      {!rep.motor && (
        <Alert variant="warning">
          <Wrench size={15} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
          Esta orden no tiene una ficha de motor vinculada. Se puede asociar despues desde la edicion de la orden.
        </Alert>
      )}
    </div>
  );
};

export default ReparacionDetalle;
