import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { pesos } from '../lib/presupuestos';
import { ETIQUETA_MEDIO_PAGO } from '../lib/remitos';

/**
 * Vista publica del remito: el link que se comparte por WhatsApp cuando
 * se entrega el motor. Calco de PresupuestoPublico.jsx contra
 * remito_publico, que busca por token aleatorio y no por numero.
 */

const CONDICIONES = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributo: 'Monotributista',
  exento: 'Exento',
  consumidor_final: 'Consumidor Final',
  no_alcanzado: 'No Alcanzado',
};

const formatearDoc = (tipo, valor) => {
  if (!valor) return '';
  const d = String(valor).replace(/\D/g, '');
  if (tipo === 'dni') return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (d.length === 11) return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
  return d;
};

const fecha = (d) => {
  if (!d) return '';
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  const dt = soloFecha
    ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
    : new Date(d);
  return dt.toLocaleDateString('es-AR');
};

const RemitoPublico = () => {
  const { token } = useParams();
  const [datos, setDatos] = useState(null);
  const [estado, setEstado] = useState('cargando');

  useEffect(() => {
    supabase.rpc('remito_publico', { p_token: token })
      .then(({ data, error }) => {
        if (error || !data) { setEstado('no-encontrado'); return; }
        setDatos(data);
        setEstado('ok');
      })
      .catch(() => setEstado('no-encontrado'));
  }, [token]);

  if (estado === 'cargando') {
    return <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>Cargando...</div>;
  }

  if (estado === 'no-encontrado') {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '10px' }}>No encontramos este remito</h2>
        <p style={{ color: '#64748b' }}>
          El link puede estar incompleto o el remito ya no estar disponible.
          Comunicate con el taller para que te manden uno nuevo.
        </p>
      </div>
    );
  }

  const { emisor, cliente, items, trabajo } = datos;

  const celda = { padding: '11px 8px', borderBottom: '1px solid #e2e8f0', fontSize: '0.92rem' };
  const encabezado = { ...celda, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b', fontWeight: 700, borderBottom: '1px solid #cbd5e1' };

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '28px 14px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', background: 'white', borderRadius: '14px', padding: '30px 26px', boxShadow: '0 8px 24px rgba(0,0,0,0.07)', color: '#0f172a' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', margin: '0 0 6px' }}>{emisor.razon_social}</h1>
            <div style={{ fontSize: '0.86rem', color: '#64748b', lineHeight: 1.6 }}>
              {emisor.domicilio && <div>{emisor.domicilio}</div>}
              {emisor.localidad && <div>{emisor.localidad}</div>}
              {emisor.telefono && <div>Tel. {emisor.telefono}</div>}
              {emisor.cuit && <div>CUIT {formatearDoc('cuit', emisor.cuit)}</div>}
              <div>{CONDICIONES[emisor.condicion_fiscal] ?? ''}</div>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', border: '2px solid #0f172a', borderRadius: '4px',
              display: 'grid', placeItems: 'center', margin: '0 auto 6px',
              fontSize: '1.8rem', fontWeight: 800, lineHeight: 1,
            }}>X</div>
            <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, maxWidth: '110px' }}>
              DOCUMENTO NO VALIDO COMO FACTURA
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '4px' }}>REMITO</div>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>N° {datos.comprobante}</div>
            <div style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '6px', lineHeight: 1.6 }}>
              <div>Fecha: {fecha(datos.fecha)}</div>
              {datos.medio_pago && <div>Pago: {ETIQUETA_MEDIO_PAGO[datos.medio_pago] ?? datos.medio_pago}</div>}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '22px', padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
            Entregado a
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
            {cliente.nombre ?? 'Consumidor final'}
            {cliente.documento && (
              <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.9rem', marginLeft: '10px' }}>
                {(cliente.documento_tipo ?? '').toUpperCase()} {formatearDoc(cliente.documento_tipo, cliente.documento)}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.86rem', color: '#64748b', marginTop: '3px' }}>
            {cliente.domicilio && <div>{cliente.domicilio}</div>}
            <div>{CONDICIONES[cliente.condicion_fiscal] ?? 'Consumidor Final'}</div>
          </div>
        </div>

        {(trabajo?.problema || trabajo?.diagnostico) && (
          <div style={{ marginTop: '18px', display: 'grid', gap: '10px' }}>
            {trabajo.problema && (
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>
                  Problema declarado
                </div>
                <div style={{ fontSize: '0.9rem' }}>{trabajo.problema}</div>
              </div>
            )}
            {trabajo.diagnostico && (
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>
                  Diagnostico
                </div>
                <div style={{ fontSize: '0.9rem' }}>{trabajo.diagnostico}</div>
              </div>
            )}
          </div>
        )}

        {/* En el celular la tabla se apila por renglon (ver .doc-tabla
            en index.css): con scroll lateral el importe --lo que el
            cliente vino a mirar-- quedaba fuera de pantalla. */}
        <div style={{ overflowX: 'auto', marginTop: '22px' }}>
          <table className="doc-tabla" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...encabezado, textAlign: 'left' }}>Descripcion</th>
                <th style={{ ...encabezado, textAlign: 'right', width: '70px' }}>Cant.</th>
                <th style={{ ...encabezado, textAlign: 'right', width: '120px' }}>P. unitario</th>
                <th style={{ ...encabezado, textAlign: 'right', width: '120px' }}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td style={celda} data-etq="Descripcion">{it.descripcion}</td>
                  <td style={{ ...celda, textAlign: 'right' }} data-etq="Cant.">{Number(it.cantidad)}</td>
                  <td style={{ ...celda, textAlign: 'right' }} data-etq="P. unitario">{pesos(it.precio_unit)}</td>
                  <td style={{ ...celda, textAlign: 'right', fontWeight: 700 }} data-etq="Importe">{pesos(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '18px', marginLeft: 'auto', maxWidth: '300px', display: 'grid', gap: '7px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
            <span style={{ color: '#64748b' }}>Subtotal</span><strong>{pesos(datos.subtotal)}</strong>
          </div>
          {Number(datos.descuento) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
              <span style={{ color: '#64748b' }}>Descuento</span><strong>- {pesos(datos.descuento)}</strong>
            </div>
          )}
          {Number(datos.iva_pct) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
              <span style={{ color: '#64748b' }}>IVA {datos.iva_pct}%</span>
              <strong>{pesos((datos.subtotal - datos.descuento) * (datos.iva_pct / 100))}</strong>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: 800, background: '#f1f5f9', padding: '10px 12px', borderRadius: '8px' }}>
            <span>TOTAL</span><span>{pesos(datos.total)}</span>
          </div>
        </div>

        {datos.notas && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>
              Observaciones
            </div>
            <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{datos.notas}</div>
          </div>
        )}

        <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center' }}>
          Este documento no reemplaza a la factura. No es valido como comprobante fiscal.
        </div>
      </div>
    </div>
  );
};

export default RemitoPublico;
