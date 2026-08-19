import React, { useMemo, useState } from 'react';
import Alert from './ui/Alert';
import Button from './ui/Button';
import Hoja from './Hoja';
import { pesos } from '../lib/presupuestos';
import {
  MEDIOS, RECARGO_TARJETA, aNumero, conRecargo, registrarPago,
} from '../lib/pagos';

/**
 * Registrar un cobro.
 *
 * Se abre con el cliente enfrente y la maquina de tarjeta en la mano,
 * asi que esta ordenada por lo que hay que decidir, en ese orden:
 * cuanto, con que, y --solo si es tarjeta-- cuanto recargo. Todo lo
 * demas (fecha, nota) tiene un valor razonable puesto y no hay que
 * mirarlo.
 *
 * El monto arranca en el saldo completo porque el caso comun es cobrar
 * todo lo que falta; los pagos parciales se hacen tocando el atajo de
 * la mitad o escribiendo el numero.
 */
const HojaPago = ({ reparacion, saldo, onCerrar, onListo }) => {
  const [monto, setMonto] = useState(saldo > 0 ? String(saldo) : '');
  const [medio, setMedio] = useState('efectivo');
  const [recargo, setRecargo] = useState(String(RECARGO_TARJETA));
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState('');
  const [verMas, setVerMas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const importe = useMemo(() => aNumero(monto), [monto]);
  const pct = medio === 'tarjeta' ? Math.max(0, aNumero(recargo)) : 0;
  const cobra = conRecargo(importe, pct);
  const restaDespues = Math.round((saldo - importe) * 100) / 100;

  const guardar = async () => {
    setError('');
    if (!(importe > 0)) { setError('Poné cuánto se cobró.'); return; }
    setGuardando(true);
    try {
      await registrarPago({
        reparacion_id: reparacion.id, monto: importe, medio, recargo_pct: pct, fecha, nota,
      });
      await onListo();
    } catch (e) {
      setError(e.message ?? 'No se pudo registrar el pago.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Hoja
      titulo="Registrar pago"
      ayuda={`Orden #${reparacion.numero}${reparacion.cliente?.nombre ? ` · ${reparacion.cliente.nombre}` : ''}`}
      onCerrar={onCerrar}
      pie={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onCerrar}>Cancelar</button>
          <Button variant="primary" onClick={guardar} isLoading={guardando}>
            Registrar {importe > 0 ? pesos(cobra) : 'pago'}
          </Button>
        </>
      )}
    >
      <div className="hoja__form">
        {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

        <label className="campo-label" htmlFor="pg-monto">Cuánto se cobra</label>
        <div className="campo-monto">
          <span className="campo-monto__signo">$</span>
          <input
            id="pg-monto"
            className="campo-monto__input"
            inputMode="decimal"
            autoComplete="off"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
          />
        </div>

        {saldo > 0 && (
          <div className="chips" style={{ marginTop: '8px', paddingBottom: 0 }}>
            <button type="button" className="chip" onClick={() => setMonto(String(saldo))}>
              Todo el saldo · {pesos(saldo)}
            </button>
            <button type="button" className="chip"
              onClick={() => setMonto(String(Math.round(saldo * 50) / 100))}>
              La mitad
            </button>
          </div>
        )}

        {importe > 0 && saldo > 0 && (
          <p className="campo-ayuda">
            {restaDespues > 0
              ? `Después de este pago queda un saldo de ${pesos(restaDespues)}.`
              : restaDespues < 0
                ? `Supera el saldo en ${pesos(Math.abs(restaDespues))}.`
                : 'Con este pago la orden queda saldada.'}
          </p>
        )}

        <div className="campo-grupo">
          <span className="campo-label">Con qué pagó</span>
          <div className="medios" role="group" aria-label="Medio de pago">
            {MEDIOS.map((m) => {
              const Icono = m.icono;
              const puesto = medio === m.valor;
              return (
                <button key={m.valor} type="button" aria-pressed={puesto}
                  className={`medio${puesto ? ' medio--puesto' : ''}`}
                  onClick={() => setMedio(m.valor)}>
                  <Icono size={19} aria-hidden="true" />
                  {m.etiqueta}
                </button>
              );
            })}
          </div>
        </div>

        {/* El recargo solo existe para la tarjeta, y aparece recien
            cuando se la elige: mostrarlo siempre obliga a leer y
            descartar un campo que no aplica en dos de cada tres cobros. */}
        {medio === 'tarjeta' && (
          <div className="campo-grupo recargo">
            <div className="recargo__fila">
              <label className="campo-label" htmlFor="pg-recargo" style={{ marginBottom: 0 }}>
                Recargo de servicio
              </label>
              <div className="recargo__campo">
                <input id="pg-recargo" className="ui-input" inputMode="decimal"
                  value={recargo} onChange={(e) => setRecargo(e.target.value)} />
                <span>%</span>
              </div>
            </div>
            <p className="campo-ayuda" style={{ marginTop: '8px' }}>
              {importe > 0 ? (
                <>
                  El cliente paga <strong>{pesos(cobra)}</strong>
                  {pct > 0 && <> · recargo {pesos(cobra - importe)}</>}
                  . A la orden se le imputan {pesos(importe)}.
                </>
              ) : 'Se suma a lo que paga el cliente; la deuda de la orden baja igual.'}
            </p>
          </div>
        )}

        {/* Fecha y nota casi nunca se tocan: el cobro se registra el dia
            que pasa. Plegadas, el formulario entra entero sin scroll. */}
        {verMas ? (
          <>
            <div className="campo-grupo">
              <label className="campo-label" htmlFor="pg-fecha">Fecha del cobro</label>
              <input id="pg-fecha" type="date" className="ui-input"
                value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="campo-grupo">
              <label className="campo-label" htmlFor="pg-nota">Nota</label>
              <input id="pg-nota" className="ui-input" value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej: seña, lo trajo el hijo" />
            </div>
          </>
        ) : (
          <button type="button" className="enlace-suave" onClick={() => setVerMas(true)}>
            Cambiar fecha o agregar una nota
          </button>
        )}
      </div>
    </Hoja>
  );
};

export default HojaPago;
