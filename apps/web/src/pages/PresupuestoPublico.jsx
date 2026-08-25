import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { pesos } from '../lib/presupuestos';

/**
 * Vista publica del presupuesto: el link que se comparte por WhatsApp.
 *
 * No necesita sesion. Va contra la funcion presupuesto_publico, que
 * busca por token aleatorio y no por numero: con /p/1, /p/2, /p/3
 * cualquiera podria recorrer todos los presupuestos del taller.
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

/**
 * vence_el llega como "2026-08-21" (un date de Postgres, sin hora).
 * new Date() lo lee como medianoche UTC y al formatearlo en Argentina
 * (UTC-3) retrocede un dia: el cliente veria el presupuesto vencido
 * una fecha antes de lo que dice el PDF. Se arma a mano.
 */
const fecha = (d) => {
  if (!d) return '';
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  const dt = soloFecha
    ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
    : new Date(d);
  return dt.toLocaleDateString('es-AR');
};

const PresupuestoPublico = () => {
  const { token } = useParams();
  const [datos, setDatos] = useState(null);
  const [estado, setEstado] = useState('cargando');

  useEffect(() => {
    supabase.rpc('presupuesto_publico', { p_token: token })
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
        <h2 style={{ marginBottom: '10px' }}>No encontramos este presupuesto</h2>
        <p style={{ color: '#64748b' }}>
          El link puede estar incompleto o el presupuesto ya no estar disponible.
          Comunicate con el taller para que te manden uno nuevo.
        </p>
      </div>
    );
  }

  const { emisor, cliente, items } = datos;
  // Vale todo el dia de vencimiento: recien al dia siguiente esta vencido.
  const hoy = new Date().toLocaleDateString('sv-SE'); // "2026-08-06"
  const vencido = Boolean(datos.vence_el) && datos.vence_el < hoy;

  const celda = { padding: '11px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 'var(--txt-base)' };
  const encabezado = { ...celda, fontSize: 'var(--txt-xs)', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b', fontWeight: 700, borderBottom: '1px solid #cbd5e1' };

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '28px 14px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', background: 'white', borderRadius: '14px', padding: '30px 26px', boxShadow: '0 8px 24px rgba(0,0,0,0.07)', color: '#0f172a' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 'var(--txt-xl)', margin: '0 0 6px' }}>{emisor.razon_social}</h1>
            <div style={{ fontSize: 'var(--txt-sm)', color: '#64748b', lineHeight: 1.6 }}>
              {emisor.domicilio && <div>{emisor.domicilio}</div>}
              {emisor.localidad && <div>{emisor.localidad}</div>}
              {emisor.telefono && <div>Tel. {emisor.telefono}</div>}
              {emisor.cuit && <div>CUIT {formatearDoc('cuit', emisor.cuit)}</div>}
              <div>{CONDICIONES[emisor.condicion_fiscal] ?? ''}</div>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            {/* Mismo recuadro que en el PDF: deja explicito que no es
                una factura, en el documento que el cliente mira online. */}
            <div style={{
              width: '52px', height: '52px', border: '2px solid #0f172a', borderRadius: '4px',
              display: 'grid', placeItems: 'center', margin: '0 auto 6px',
              fontSize: 'var(--txt-2xl)', fontWeight: 800, lineHeight: 1,
            }}>X</div>
            <div style={{ fontSize: 'var(--txt-xs)', color: '#64748b', fontWeight: 700, maxWidth: '110px' }}>
              DOCUMENTO NO VALIDO COMO FACTURA
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--txt-lg)', fontWeight: 800, marginBottom: '4px' }}>PRESUPUESTO</div>
            <div style={{ fontSize: 'var(--txt-base)', fontWeight: 700 }}>N° {datos.comprobante}</div>
            <div style={{ fontSize: 'var(--txt-sm)', color: '#64748b', marginTop: '6px', lineHeight: 1.6 }}>
              <div>Emitido: {fecha(datos.creado_en)}</div>
              <div style={{ color: vencido ? '#b91c1c' : '#64748b', fontWeight: vencido ? 700 : 400 }}>
                Valido hasta: {fecha(datos.vence_el)}
              </div>
            </div>
          </div>
        </div>

        {vencido && (
          <div style={{ marginTop: '18px', padding: '12px 14px', borderRadius: '9px', background: '#fef3c7', color: '#92400e', fontSize: 'var(--txt-sm)' }}>
            Este presupuesto vencio. Pedile al taller uno actualizado.
          </div>
        )}

        <div style={{ marginTop: '22px', padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <div style={{ fontSize: 'var(--txt-xs)', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
            Emitido para
          </div>
          <div style={{ fontWeight: 700, fontSize: 'var(--txt-md)' }}>
            {cliente.nombre ?? 'Consumidor final'}
            {cliente.documento && (
              <span style={{ fontWeight: 400, color: '#64748b', fontSize: 'var(--txt-sm)', marginLeft: '10px' }}>
                {(cliente.documento_tipo ?? '').toUpperCase()} {formatearDoc(cliente.documento_tipo, cliente.documento)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 'var(--txt-sm)', color: '#64748b', marginTop: '3px' }}>
            {cliente.domicilio && <div>{cliente.domicilio}</div>}
            <div>{CONDICIONES[cliente.condicion_fiscal] ?? 'Consumidor Final'}</div>
          </div>
        </div>

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
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--txt-base)' }}>
            <span style={{ color: '#64748b' }}>Subtotal</span><strong>{pesos(datos.subtotal)}</strong>
          </div>
          {Number(datos.descuento) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--txt-base)' }}>
              <span style={{ color: '#64748b' }}>Descuento</span><strong>- {pesos(datos.descuento)}</strong>
            </div>
          )}
          {Number(datos.iva_pct) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--txt-base)' }}>
              <span style={{ color: '#64748b' }}>IVA {datos.iva_pct}%</span>
              <strong>{pesos((datos.subtotal - datos.descuento) * (datos.iva_pct / 100))}</strong>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--txt-lg)', fontWeight: 800, background: '#f1f5f9', padding: '10px 12px', borderRadius: '8px' }}>
            <span>TOTAL</span><span>{pesos(datos.total)}</span>
          </div>
        </div>

        {datos.notas && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: 'var(--txt-xs)', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>
              Observaciones
            </div>
            <div style={{ fontSize: 'var(--txt-sm)', whiteSpace: 'pre-wrap' }}>{datos.notas}</div>
          </div>
        )}

        <div style={{ marginTop: '26px', paddingTop: '14px', borderTop: '1px solid #e2e8f0', fontSize: 'var(--txt-xs)', color: '#64748b', fontStyle: 'italic' }}>
          {emisor.leyenda}
        </div>
        <div style={{ marginTop: '8px', fontSize: 'var(--txt-xs)', color: '#94a3b8', textAlign: 'center' }}>
          Este documento no reemplaza a la factura. No es valido como comprobante fiscal.
        </div>
      </div>
    </div>
  );
};

export default PresupuestoPublico;
