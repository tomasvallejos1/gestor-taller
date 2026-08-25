import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Trash2, X, Wrench, Pencil, ArrowRight, SlidersHorizontal,
  AlertTriangle, Wallet,
} from 'lucide-react';
import Modal from '../components/Modal';
import Hoja from '../components/Hoja';
import HojaPago from '../components/HojaPago';
import Alert from '../components/ui/Alert';
import Esqueleto from '../components/Esqueleto';
import Button from '../components/ui/Button';
import MenuAcciones, { ItemMenu } from '../components/ui/MenuAcciones';
import { useAuth } from '../context/AuthContext';
import {
  ESTADOS, ETIQUETA_ESTADO, COLOR_ESTADO, SIGUIENTE_ESTADO, VISTAS,
  listarReparaciones, guardarReparacion, cambiarEstado, eliminarReparacion,
} from '../lib/reparaciones';
import {
  ETIQUETA_ESTADO_PAGO, COLOR_ESTADO_PAGO, cobranzaDe, alertaCobro, resumenPago,
  contarDeudores,
} from '../lib/pagos';
import { pesos } from '../lib/presupuestos';
import { fechaCorta, haceCuanto, hoyIso } from '../lib/fechas';
import { listarClientes } from '../lib/clientes';
import { listarMotores } from '../lib/motores';

/**
 * Listado de ordenes de reparacion.
 *
 * Es la cola de trabajo del taller y se abre veinte veces por dia, casi
 * siempre desde el celular y casi siempre para una de tres cosas: ver
 * que hay que hacer, empujar una orden al paso siguiente, o averiguar
 * quien debe plata.
 *
 * De ahi la forma de la pantalla:
 *
 *  - Los filtros de arriba no son los seis estados del enum sino las
 *    preguntas que uno se hace: "que hay en el taller", "que esta para
 *    entregar", "quien me debe". Los estados sueltos quedan en el panel
 *    de filtros, que casi nunca se abre.
 *  - La tarjeta entera abre la orden --que es lo que se hace todo el
 *    dia-- y lo ocasional vive en el menu de la esquina.
 *  - Un motor entregado y sin cobrar se pinta en rojo. Es el unico rojo
 *    de la lista: mientras el motor este en el taller, deber es normal;
 *    una vez que se fue, la unica palanca para cobrar ya no esta.
 *  - Dar de alta o editar una orden pasa a una hoja inferior en vez de
 *    un formulario desplegado en medio de la lista, que empujaba todo
 *    lo de abajo y dejaba sin referencia al que estaba mirando otra
 *    cosa.
 */

const VACIA = {
  id: null, motor_id: '', cliente_id: '', estado: 'ingresado', ingreso: hoyIso(), egreso: '',
  problema: '', diagnostico: '', notas: '',
};

const FILTROS_VACIOS = { estado: '', pago: '' };

/** Cuanto lleva la orden, que es lo que importa mientras esta abierta. */
const cuando = (r) => (
  r.estado === 'entregado' && r.egreso
    ? `entregado ${fechaCorta(r.egreso)}`
    : `ingreso ${haceCuanto(r.ingreso)}`
);

const Reparaciones = () => {
  const { esEditor } = useAuth();

  /**
   * La vista y el estado se pueden pedir por URL.
   *
   * El panel muestra "Para retirar: 3" y antes ese numero llevaba al
   * listado completo, sin filtrar: el que entraba tenia que volver a
   * buscar a mano las tres ordenes que el panel le acababa de contar.
   * Un atajo que deja al otro lado del salto la misma busqueda que uno
   * venia a evitar no es un atajo.
   *
   * Ademas hace que la lista se pueda compartir y que el boton "atras"
   * del navegador devuelva a la misma lista, no a la de por defecto.
   */
  const [params, setParams] = useSearchParams();
  const vistaPedida = params.get('vista');
  const estadoPedido = params.get('estado');

  const [reparaciones, setReparaciones] = useState([]);
  const [vista, setVista] = useState(
    () => (VISTAS.some((v) => v.id === vistaPedida) ? vistaPedida : 'taller'),
  );
  const [filtros, setFiltros] = useState(() => ({
    ...FILTROS_VACIOS,
    estado: ESTADOS.includes(estadoPedido) ? estadoPedido : '',
  }));
  // Con un estado pedido por URL el panel de filtros arranca abierto: si
  // no, la lista viene recortada y no se ve por que.
  const [verFiltros, setVerFiltros] = useState(() => ESTADOS.includes(estadoPedido));
  const [texto, setTexto] = useState('');
  const [deudores, setDeudores] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [cobrando, setCobrando] = useState(null);
  const [aBorrar, setABorrar] = useState(null);
  const [aEntregar, setAEntregar] = useState(null);

  const [clientes, setClientes] = useState([]);
  const [motores, setMotores] = useState([]);

  const buscar = useCallback(async (v, f, t) => {
    setCargando(true);
    setError('');
    try {
      const r = await listarReparaciones({ vista: v, estado: f.estado, pago: f.pago, texto: t });
      setReparaciones(r.reparaciones);
    } catch (e) {
      setError(e.message ?? 'No pudimos cargar las reparaciones.');
    } finally {
      setCargando(false);
    }
  }, []);

  // El contador de deudores va aparte del listado: tiene que verse en el
  // chip aunque la lista abierta sea otra.
  const contar = useCallback(async () => {
    if (!esEditor) return;
    try {
      setDeudores(await contarDeudores());
    } catch {
      // Un contador que no carga no puede tapar la pantalla: se queda
      // en el valor anterior y la lista sigue andando.
      setDeudores((d) => d);
    }
  }, [esEditor]);

  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      buscar(vista, filtros, texto);
      // El contador no depende de los filtros: se pide una vez al
      // entrar y despues solo cuando algo lo puede haber movido.
      contar();
      return undefined;
    }
    const t = setTimeout(() => buscar(vista, filtros, texto), 300);
    return () => clearTimeout(t);
  }, [vista, filtros, texto, buscar, contar]);

  const refrescar = async () => {
    await Promise.all([buscar(vista, filtros, texto), contar()]);
  };

  // Se cargan solo al abrir el formulario, no al entrar a la pantalla.
  const abrirFormulario = async (base) => {
    setEditando(base);
    setError('');
    if (!clientes.length) {
      try {
        const [c, m] = await Promise.all([
          listarClientes({ porPagina: 300 }),
          listarMotores({ porPagina: 300, orden: 'nro_desc' }),
        ]);
        setClientes(c.clientes);
        setMotores(m.motores);
      } catch (e) {
        setError(e.message ?? 'No se pudieron cargar clientes o fichas.');
      }
    }
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    // El cliente es obligatorio para una orden nueva: sin cliente no hay
    // con quien verificar el seguimiento publico ni a nombre de quien
    // emitir el remito o la factura despues. Una orden ya cargada sin
    // cliente se puede seguir editando: no se le exige retroactivamente.
    if (!editando.id && !editando.cliente_id) {
      setError('Elegi un cliente para la orden.');
      return;
    }
    setGuardando(true);
    try {
      await guardarReparacion(editando);
      setEditando(null);
      await refrescar();
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const cambiar = async (id, estado) => {
    setError('');
    try {
      await cambiarEstado(id, estado);
      await refrescar();
    } catch (e) {
      setError(e.message ?? 'No se pudo cambiar el estado.');
    }
  };

  /** Entregar un motor con saldo pendiente se pregunta antes. */
  const avanzar = (r, siguiente) => {
    const cob = cobranzaDe(r);
    if (siguiente === 'entregado' && cob.total && cob.saldo > 0) {
      setAEntregar(r);
      return;
    }
    cambiar(r.id, siguiente);
  };

  const filtrosPuestos = Object.values(filtros).filter(Boolean).length;
  const filtrando = Boolean(filtrosPuestos || texto.trim() || vista !== 'taller');
  const porCobrar = reparaciones.reduce((s, r) => {
    const c = cobranzaDe(r);
    return s + (c.total && c.saldo > 0 ? c.saldo : 0);
  }, 0);

  return (
    <div>
      <div className="pantalla-header">
        <div>
          <h2 className="pantalla-titulo">Reparaciones</h2>
          <p className="pantalla-sub">Que motor de quien, en que estado y cuanto falta cobrar</p>
        </div>
        {esEditor && (
          <button type="button" className="btn btn-primary"
            onClick={() => abrirFormulario({ ...VACIA, ingreso: hoyIso() })}>
            <Plus size={16} /> Nueva orden
          </button>
        )}
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

      <div className="herramientas">
        <div className="buscador">
          <Search size={16} />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="N° de orden o apellido"
            aria-label="Buscar por numero de orden o cliente"
          />
          {texto && (
            <button type="button" className="buscador__limpiar" aria-label="Borrar la busqueda"
              onClick={() => setTexto('')}>
              <X size={15} />
            </button>
          )}
        </div>

        <div className="icono-btn-wrap">
          <button type="button" aria-label="Mas filtros" aria-expanded={verFiltros}
            className={`icono-btn${verFiltros || filtrosPuestos ? ' icono-btn--activo' : ''}`}
            onClick={() => setVerFiltros((v) => !v)}>
            <SlidersHorizontal size={17} />
          </button>
          {filtrosPuestos > 0 && <span className="icono-btn__punto">{filtrosPuestos}</span>}
        </div>
      </div>

      <div className="chips" role="group" aria-label="Vista de la lista">
        {VISTAS.map((v) => {
          // Con un filtro exacto puesto, la vista deja de mandar y
          // ninguna se muestra activa: la lista es la del filtro.
          const activa = vista === v.id && !filtrosPuestos;
          const esDeudores = v.id === 'deudores';
          return (
            <button key={v.id} type="button" aria-pressed={activa}
              className={`chip${activa ? ' activo' : ''}${esDeudores && deudores > 0 ? ' chip--alerta' : ''}`}
              onClick={() => {
                setVista(v.id);
                setFiltros(FILTROS_VACIOS);
                // La URL sigue a la vista para que "atras" vuelva a la
                // lista anterior y no a la de por defecto.
                setParams(v.id === 'taller' ? {} : { vista: v.id }, { replace: true });
              }}>
              {v.etiqueta}
              {esDeudores && deudores > 0 && <span className="chip__punto">{deudores}</span>}
            </button>
          );
        })}
      </div>

      {verFiltros && (
        <div className="panel-filtros">
          <div className="panel-filtros__grilla">
            <div>
              <label className="campo-label" htmlFor="f-estado">Estado</label>
              <select id="f-estado" value={filtros.estado}
                onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}>
                <option value="">Cualquiera</option>
                {ESTADOS.map((e2) => (
                  <option key={e2} value={e2}>{ETIQUETA_ESTADO[e2]}</option>
                ))}
              </select>
            </div>
            {esEditor && (
              <div>
                <label className="campo-label" htmlFor="f-pago">Cobranza</label>
                <select id="f-pago" value={filtros.pago}
                  onChange={(e) => setFiltros((f) => ({ ...f, pago: e.target.value }))}>
                  <option value="">Cualquiera</option>
                  {['impago', 'parcial', 'pagado', 'sin_importe'].map((p) => (
                    <option key={p} value={p}>{ETIQUETA_ESTADO_PAGO[p]}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {filtrosPuestos > 0 && (
            <button type="button" className="btn btn-secondary" style={{ marginTop: '13px' }}
              onClick={() => setFiltros(FILTROS_VACIOS)}>
              Quitar filtros
            </button>
          )}
        </div>
      )}

      {cargando ? (
        <Esqueleto tipo="lista" />
      ) : reparaciones.length === 0 ? (
        <div className="vacio">
          <Wrench size={26} />
          <div>
            {filtrando
              ? 'Ninguna orden coincide con la busqueda.'
              : 'Todavia no hay ordenes cargadas.'}
          </div>
        </div>
      ) : (
        <ul className="lista">
          {reparaciones.map((r) => {
            const siguiente = SIGUIENTE_ESTADO[r.estado];
            const cob = cobranzaDe(r);
            const alerta = alertaCobro(r);
            const pago = resumenPago(r, pesos);
            return (
              <li key={r.id} className={`fila${alerta ? ' fila--alerta' : ''}`}>
                <Link to={`/sistema/reparaciones/${r.id}`} className="fila-link">
                  <div className="fila-encabezado">
                    <span className="fila-titulo">
                      {r.cliente?.nombre ?? <span style={{ color: 'var(--text-light)' }}>Sin cliente</span>}
                    </span>
                    <span className="fila-nro">N° {r.numero}</span>
                  </div>

                  <div className="fila-sub">
                    {r.motor
                      ? `#${r.motor.nro_motor} ${r.motor.descripcion}`
                      : 'Sin ficha asociada'}
                    {' · '}
                    {cuando(r)}
                  </div>

                  <div className="fila-etiquetas">
                    <span className="etiqueta"
                      style={{ color: COLOR_ESTADO[r.estado], borderColor: 'currentColor' }}>
                      <span className="etiqueta__punto" aria-hidden="true" />
                      {ETIQUETA_ESTADO[r.estado]}
                    </span>

                    {pago && (alerta ? (
                      <span className="etiqueta etiqueta--alerta">
                        <AlertTriangle size={12} aria-hidden="true" />
                        {pago.texto}
                      </span>
                    ) : (
                      <span className="etiqueta"
                        style={{ color: COLOR_ESTADO_PAGO[cob.estado], borderColor: 'currentColor' }}>
                        <span className="etiqueta__punto" aria-hidden="true" />
                        {pago.texto}
                      </span>
                    ))}
                  </div>
                </Link>

                {esEditor && (
                  <div className="fila-acciones">
                    <MenuAcciones etiqueta={`Acciones de la orden ${r.numero}`}>
                      {/* El salto al estado que sigue es lo que mas se
                          toca; va primero y con su nombre, no como una
                          lista de seis donde hay que buscar cual sigue. */}
                      {siguiente && (
                        <ItemMenu onClick={() => avanzar(r, siguiente)} icono={ArrowRight}>
                          Marcar {ETIQUETA_ESTADO[siguiente].toLowerCase()}
                        </ItemMenu>
                      )}
                      {cob.saldo > 0 && (
                        <ItemMenu onClick={() => setCobrando(r)} icono={Wallet}>
                          Registrar pago
                        </ItemMenu>
                      )}
                      <ItemMenu onClick={() => abrirFormulario({
                        ...VACIA, ...r,
                        cliente_id: r.cliente?.id ?? '',
                        motor_id: r.motor?.id ?? '',
                        egreso: r.egreso ?? '',
                      })} icono={Pencil}>
                        Editar orden
                      </ItemMenu>
                      <ItemMenu onClick={() => setABorrar(r)} icono={Trash2} peligro>
                        Eliminar
                      </ItemMenu>
                    </MenuAcciones>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {reparaciones.length > 0 && (
        <div className="contador">
          {reparaciones.length} {reparaciones.length === 1 ? 'orden' : 'ordenes'}
          {porCobrar > 0 && ` · ${pesos(porCobrar)} sin cobrar`}
        </div>
      )}

      {editando && (
        <Hoja
          titulo={editando.id ? `Orden #${editando.numero}` : 'Nueva orden'}
          ayuda={editando.id ? null : 'El motor entra a nombre de un cliente. La ficha tecnica se puede vincular despues.'}
          onCerrar={() => setEditando(null)}
          pie={(
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setEditando(null)}>
                Cancelar
              </button>
              {/* `form` conecta el boton con el formulario aunque este
                  fuera de el: asi el pie queda fijo abajo y Enter sigue
                  guardando. */}
              <Button type="submit" form="form-orden" variant="primary" isLoading={guardando}>
                {editando.id ? 'Guardar' : 'Crear orden'}
              </Button>
            </>
          )}
        >
          <form id="form-orden" onSubmit={guardar} className="hoja__form">
            {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

            <div className="campo-grupo">
              <label className="campo-label" htmlFor="r-cliente">
                Cliente{!editando.id && ' *'}
              </label>
              <select id="r-cliente" className="ui-input" required={!editando.id}
                value={editando.cliente_id ?? ''}
                onChange={(e) => setEditando({ ...editando, cliente_id: e.target.value })}>
                <option value="">{editando.id ? 'Sin asignar' : 'Elegi un cliente'}</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <div className="campo-grupo">
              <label className="campo-label" htmlFor="r-motor">Ficha del motor</label>
              <select id="r-motor" className="ui-input" value={editando.motor_id ?? ''}
                onChange={(e) => setEditando({ ...editando, motor_id: e.target.value })}>
                <option value="">Sin ficha — se vincula despues</option>
                {motores.map((m) => (
                  <option key={m.id} value={m.id}>#{m.nro_motor} — {m.descripcion}</option>
                ))}
              </select>
            </div>

            <div className="campo-par">
              <div>
                <label className="campo-label" htmlFor="r-estado">Estado</label>
                <select id="r-estado" className="ui-input" value={editando.estado}
                  onChange={(e) => setEditando({ ...editando, estado: e.target.value })}>
                  {ESTADOS.map((e2) => <option key={e2} value={e2}>{ETIQUETA_ESTADO[e2]}</option>)}
                </select>
              </div>
              <div>
                <label className="campo-label" htmlFor="r-ingreso">Ingreso</label>
                <input id="r-ingreso" type="date" className="ui-input" value={editando.ingreso ?? ''}
                  onChange={(e) => setEditando({ ...editando, ingreso: e.target.value })} />
              </div>
            </div>

            <div className="campo-grupo">
              <label className="campo-label" htmlFor="r-problema">Problema declarado</label>
              <textarea id="r-problema" rows={2} className="ui-input"
                style={{ resize: 'vertical' }}
                value={editando.problema ?? ''}
                onChange={(e) => setEditando({ ...editando, problema: e.target.value })}
                placeholder="Ej: Hace ruido y no arranca" />
            </div>

            <div className="campo-grupo">
              <label className="campo-label" htmlFor="r-notas">Notas internas</label>
              <textarea id="r-notas" rows={2} className="ui-input"
                style={{ resize: 'vertical' }}
                value={editando.notas ?? ''}
                onChange={(e) => setEditando({ ...editando, notas: e.target.value })}
                placeholder="No se muestran en la consulta publica de estado" />
            </div>
          </form>
        </Hoja>
      )}

      {cobrando && (
        <HojaPago
          reparacion={cobrando}
          saldo={cobranzaDe(cobrando).saldo}
          onCerrar={() => setCobrando(null)}
          onListo={async () => { setCobrando(null); await refrescar(); }}
        />
      )}

      <Modal
        isOpen={Boolean(aBorrar)}
        type="danger"
        title="Eliminar orden"
        message={`Se elimina la orden #${aBorrar?.numero}. La ficha del motor y el cliente se conservan.`}
        confirmLabel="Eliminar"
        onClose={() => setABorrar(null)}
        onConfirm={async () => {
          try {
            await eliminarReparacion(aBorrar.id);
            await refrescar();
          } catch (e) { setError(e.message); }
          setABorrar(null);
        }}
      />

      <Modal
        isOpen={Boolean(aEntregar)}
        type="danger"
        title="Entregar sin cobrar"
        message={`La orden #${aEntregar?.numero} queda con un saldo de ${pesos(cobranzaDe(aEntregar ?? {}).saldo)}. Una vez que el motor sale del taller, cobrar es mas dificil.`}
        confirmLabel="Entregar igual"
        cancelLabel="Registrar pago"
        // El boton de la izquierda no es "volver": es el camino que casi
        // siempre corresponde. Cobrar y despues entregar.
        onClose={() => { setCobrando(aEntregar); setAEntregar(null); }}
        onConfirm={async () => {
          const r = aEntregar;
          setAEntregar(null);
          await cambiar(r.id, 'entregado');
        }}
      />
    </div>
  );
};

export default Reparaciones;
