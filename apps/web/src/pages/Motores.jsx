import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Pencil, Trash2, SlidersHorizontal, X, PackageOpen, Sparkles,
} from 'lucide-react';
import Modal from '../components/Modal';
import Alert from '../components/ui/Alert';
import Esqueleto from '../components/Esqueleto';
import MenuAcciones, { ItemMenu } from '../components/ui/MenuAcciones';
import { useAuth } from '../context/AuthContext';
import {
  listarMotores, eliminarMotor, etiquetaPotencia, traducirBusqueda,
} from '../lib/motores';
import Hoja from '../components/Hoja';
import Button from '../components/ui/Button';

/**
 * Listado de motores.
 *
 * Ver una ficha es lo que se hace todo el dia; editarla o borrarla,
 * cada tanto. Por eso la tarjeta entera es el enlace a la ficha y las
 * otras dos acciones viven en el menu de la esquina.
 *
 * De los siete filtros que habia siempre desplegados, arriba queda
 * solo la busqueda por texto --que es la que se usa-- y el resto se
 * abre a pedido.
 */

const FILTROS_VACIOS = {
  nro: '', texto: '', marca: '', modelo: '', hp: '', tipo: '', duenio: '',
};

/** Como se nombra cada filtro cuando se muestra puesto. */
const ETIQUETA_FILTRO = {
  nro: 'Ficha N°', texto: 'Texto', marca: 'Marca', modelo: 'Modelo',
  hp: 'HP', tipo: 'Tipo o uso', duenio: 'Cliente',
};
const ORDEN_POR_DEFECTO = 'recientes';

const Motores = () => {
  const { esEditor } = useAuth();

  const [motores, setMotores] = useState([]);
  const [total, setTotal] = useState(0);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [orden, setOrden] = useState(ORDEN_POR_DEFECTO);
  const [verFiltros, setVerFiltros] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [aBorrar, setABorrar] = useState(null);
  const [borrando, setBorrando] = useState(false);

  const [preguntando, setPreguntando] = useState(false);
  const [pregunta, setPregunta] = useState('');
  const [traduciendo, setTraduciendo] = useState(false);
  // Se guarda que campos puso la IA para poder decir "esto entendi". Un
  // filtro que se aplica sin que se vea es indistinguible de un error.
  const [interpretado, setInterpretado] = useState(null);

  const buscar = useCallback(async (f, o) => {
    setCargando(true);
    setError('');
    try {
      const r = await listarMotores({ ...f, orden: o });
      setMotores(r.motores);
      setTotal(r.total);
    } catch (e) {
      setError(e.message ?? 'No pudimos cargar el inventario.');
      setMotores([]);
    } finally {
      setCargando(false);
    }
  }, []);

  // Los filtros se aplican en la base, asi que cada tecla seria una
  // consulta. El retardo agrupa el tipeo en una sola.
  const primeraCarga = useRef(true);
  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      buscar(filtros, orden);
      return undefined;
    }
    const t = setTimeout(() => buscar(filtros, orden), 350);
    return () => clearTimeout(t);
  }, [filtros, orden, buscar]);

  const cambiarFiltro = (e) => setFiltros((f) => ({ ...f, [e.target.name]: e.target.value }));

  const limpiar = () => {
    setFiltros(FILTROS_VACIOS);
    setOrden(ORDEN_POR_DEFECTO);
  };

  // Cuenta lo que hay puesto ademas de la busqueda de texto, que ya se
  // ve sola en su campo. Con el panel cerrado esto es lo unico que
  // avisa que la lista viene recortada.
  const avanzadosPuestos = Object.entries(filtros)
    .filter(([k, v]) => k !== 'texto' && String(v).trim())
    .length + (orden !== ORDEN_POR_DEFECTO ? 1 : 0);

  /**
   * Pregunta escrita -> filtros aplicados.
   *
   * Lo que devuelve el traductor reemplaza los filtros anteriores en vez
   * de sumarse: dos busquedas encadenadas que se acumulan dan cero
   * resultados y nadie entiende por que.
   */
  const preguntar = async (e) => {
    e?.preventDefault();
    const texto = pregunta.trim();
    if (!texto) return;

    setTraduciendo(true);
    setError('');
    try {
      const r = await traducirBusqueda(texto);
      setFiltros({ ...FILTROS_VACIOS, ...r.filtros });
      setInterpretado({ ...r.filtros, __degradado: r.degradado });
      setPreguntando(false);
      setPregunta('');
    } catch (err) {
      setError(err.message ?? 'No se pudo interpretar la busqueda.');
    } finally {
      setTraduciendo(false);
    }
  };

  const quitarFiltro = (campo) => {
    setFiltros((f) => ({ ...f, [campo]: '' }));
    setInterpretado((i) => {
      if (!i) return i;
      const resto = { ...i };
      delete resto[campo];
      // Sin ningun campo puesto, la tira de "esto entendi" no tiene nada
      // que decir y se va sola.
      return Object.keys(resto).filter((k) => !k.startsWith('__')).length ? resto : null;
    });
  };

  const confirmarBorrado = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    try {
      await eliminarMotor(aBorrar.id);
      setMotores((ms) => ms.filter((m) => m.id !== aBorrar.id));
      setTotal((t) => t - 1);
      setABorrar(null);
    } catch (e) {
      setError(e.message ?? 'No se pudo eliminar la ficha.');
      setABorrar(null);
    } finally {
      setBorrando(false);
    }
  };

  const titulo = (m) => m.descripcion || m.marca || `Ficha ${m.nro_motor}`;
  const subtitulo = (m) => [m.marca, m.modelo].filter(Boolean).join(' · ');

  /**
   * Los filtros puestos, uno por chip, con su cruz para sacarlo.
   *
   * El punto rojo sobre el embudo avisaba de que la lista venia
   * recortada, pero no de por que: habia que abrir el panel y recorrer
   * seis campos para descubrir cual tenia algo escrito. Con el filtro a
   * la vista, sacarlo es un toque y no hace falta abrir nada.
   */
  const ETIQUETA_FILTRO = {
    nro: 'N°', marca: 'Marca', modelo: 'Modelo', hp: 'Potencia', tipo: 'Tipo',
  };
  const ETIQUETA_ORDEN = {
    antiguos: 'Más antiguas', nro_desc: 'N° más alto', nro_asc: 'N° más bajo',
  };

  const chipsActivos = [
    ...Object.entries(filtros)
      .filter(([k, v]) => k !== 'texto' && String(v).trim())
      .map(([k, v]) => ({
        clave: k,
        texto: `${ETIQUETA_FILTRO[k] ?? k}: ${v}`,
        quitar: () => setFiltros((f) => ({ ...f, [k]: '' })),
      })),
    ...(orden !== ORDEN_POR_DEFECTO ? [{
      clave: 'orden',
      texto: ETIQUETA_ORDEN[orden] ?? orden,
      quitar: () => setOrden(ORDEN_POR_DEFECTO),
    }] : []),
  ];

  return (
    <div>
      <div className="pantalla-header">
        <div>
          <h2 className="pantalla-titulo">Motores</h2>
          <p className="pantalla-sub">Fichas tecnicas del taller</p>
        </div>
        {esEditor && (
          <Link to="/sistema/motores/nuevo" className="btn btn-primary">
            <Plus size={16} />
            Nueva
          </Link>
        )}
      </div>

      <div className="herramientas">
        <div className="buscador">
          <Search size={16} />
          <input
            name="texto"
            value={filtros.texto}
            onChange={cambiarFiltro}
            placeholder="Buscar por N°, descripcion o marca"
            aria-label="Buscar fichas por numero, descripcion o marca"
          />
          {filtros.texto && (
            <button type="button" className="buscador__limpiar" aria-label="Borrar la busqueda"
              onClick={() => setFiltros((f) => ({ ...f, texto: '' }))}>
              <X size={15} />
            </button>
          )}
        </div>

        {/* Preguntar con palabras y filtrar a mano son la misma accion
            por dos caminos: van juntos, al lado del buscador. */}
        <button
          type="button"
          className={`icono-btn${interpretado ? ' icono-btn--activo' : ''}`}
          aria-label="Buscar escribiendo una pregunta"
          onClick={() => setPreguntando(true)}
        >
          <Sparkles size={17} />
        </button>

        <div className="icono-btn-wrap">
          <button
            type="button"
            className={`icono-btn${verFiltros || avanzadosPuestos ? ' icono-btn--activo' : ''}`}
            aria-label="Mas filtros"
            aria-expanded={verFiltros}
            onClick={() => setVerFiltros((v) => !v)}
          >
            <SlidersHorizontal size={17} />
          </button>
          {avanzadosPuestos > 0 && (
            <span className="icono-btn__punto">{avanzadosPuestos}</span>
          )}
        </div>
      </div>

      {verFiltros && (
        <div className="panel-filtros">
          <div className="panel-filtros__grilla">
            <div>
              <label className="campo-label" htmlFor="f-nro">N° de ficha</label>
              <input id="f-nro" name="nro" value={filtros.nro} onChange={cambiarFiltro}
                inputMode="numeric" placeholder="5" />
            </div>
            <div>
              <label className="campo-label" htmlFor="f-marca">Marca</label>
              <input id="f-marca" name="marca" value={filtros.marca} onChange={cambiarFiltro}
                placeholder="Czerweny" />
            </div>
            <div>
              <label className="campo-label" htmlFor="f-modelo">Modelo</label>
              <input id="f-modelo" name="modelo" value={filtros.modelo} onChange={cambiarFiltro} />
            </div>
            <div>
              <label className="campo-label" htmlFor="f-hp">Potencia</label>
              <input id="f-hp" name="hp" value={filtros.hp} onChange={cambiarFiltro}
                placeholder="5.5" />
            </div>
            <div>
              <label className="campo-label" htmlFor="f-tipo">Tipo o uso</label>
              <input id="f-tipo" name="tipo" value={filtros.tipo} onChange={cambiarFiltro}
                placeholder="bombeador" />
            </div>
            <div>
              <label className="campo-label" htmlFor="f-duenio">Cliente</label>
              <input id="f-duenio" name="duenio" value={filtros.duenio} onChange={cambiarFiltro}
                placeholder="Apellido del dueño" />
            </div>
            <div>
              <label className="campo-label" htmlFor="f-orden">Ordenar</label>
              <select id="f-orden" value={orden} onChange={(e) => setOrden(e.target.value)}>
                <option value="recientes">Mas nuevas</option>
                <option value="antiguos">Mas antiguas</option>
                <option value="nro_desc">N° mas alto</option>
                <option value="nro_asc">N° mas bajo</option>
              </select>
            </div>
          </div>

          {avanzadosPuestos > 0 && (
            <button type="button" onClick={limpiar} className="btn btn-secondary"
              style={{ marginTop: '13px' }}>
              Quitar filtros
            </button>
          )}
        </div>
      )}

      {chipsActivos.length > 0 && (
        <div className="filtros-activos">
          {chipsActivos.map((c) => (
            <button key={c.clave} type="button" className="chip-filtro" onClick={c.quitar}>
              {c.texto}
              <X size={13} aria-hidden="true" />
              <span className="sr-solo">Quitar este filtro</span>
            </button>
          ))}
          <button type="button" className="chip-filtro chip-filtro--todo" onClick={limpiar}>
            Quitar todos
          </button>
        </div>
      )}

      {interpretado && (
        <div className="leido">
          <span className="leido__rotulo">
            {interpretado.__degradado ? 'Busque tal cual lo escribiste' : 'Entendí'}
          </span>
          {Object.entries(interpretado)
            .filter(([campo, valor]) => !campo.startsWith('__') && valor)
            .map(([campo, valor]) => (
              <button key={campo} type="button" className="leido__chip"
                onClick={() => quitarFiltro(campo)}
                aria-label={`Quitar el filtro ${ETIQUETA_FILTRO[campo]}`}>
                {ETIQUETA_FILTRO[campo]}: <strong>{valor}</strong>
                <X size={13} aria-hidden="true" />
              </button>
            ))}
          <button type="button" className="leido__limpiar"
            onClick={() => { setFiltros(FILTROS_VACIOS); setInterpretado(null); }}>
            Limpiar
          </button>
        </div>
      )}

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

      {/* Cuantas hay, antes de la lista y no despues.
          Al pie solo se leia despues de recorrer las cincuenta, que es
          justo cuando ya no sirve saber que eran cincuenta. */}
      {!cargando && motores.length > 0 && (
        <p className="contador contador--arriba">
          {motores.length === total
            ? `${total} ${total === 1 ? 'ficha' : 'fichas'}`
            : `${motores.length} de ${total} fichas`}
        </p>
      )}

      {cargando ? (
        <div style={{ padding: '48px 0' }}>
          <Esqueleto tipo="lista" />
        </div>
      ) : motores.length === 0 ? (
        /* Un vacio sin salida deja a la persona mirando el cartel.
           Buscando, la salida es soltar la busqueda; sin fichas todavia,
           es cargar la primera. */
        <div className="vacio">
          <PackageOpen size={26} />
          {filtros.texto || avanzadosPuestos ? (
            <>
              <div>Ninguna ficha coincide con la búsqueda.</div>
              <button type="button" className="btn btn-secondary"
                onClick={() => { setFiltros(FILTROS_VACIOS); setOrden(ORDEN_POR_DEFECTO); }}>
                Limpiar la búsqueda
              </button>
            </>
          ) : (
            <>
              <div>Todavía no hay fichas cargadas.</div>
              {esEditor && (
                <Link to="/sistema/motores/nuevo" className="btn btn-primary"
                  style={{ textDecoration: 'none' }}>
                  <Plus size={16} /> Cargar la primera
                </Link>
              )}
            </>
          )}
        </div>
      ) : (
        <ul className="lista">
          {motores.map((m) => {
            const ref = m.nro_motor ?? m.id;
            const potencia = etiquetaPotencia(m);
            const uso = m.aplicacion || m.tipo_electrico;
            return (
              <li key={m.id} className="fila">
                <Link to={`/sistema/motores/ver/${ref}`} className="fila-link">
                  <div className="fila-encabezado">
                    <span className="fila-titulo">{titulo(m)}</span>
                    <span className="fila-nro">N° {m.nro_motor}</span>
                  </div>

                  {subtitulo(m) && <div className="fila-sub">{subtitulo(m)}</div>}

                  {(potencia || uso) && (
                    <div className="fila-etiquetas">
                      {potencia && <span className="etiqueta etiqueta--fuerte">{potencia}</span>}
                      {uso && <span className="etiqueta">{uso}</span>}
                    </div>
                  )}
                </Link>

                {esEditor && (
                  <div className="fila-acciones">
                    <MenuAcciones etiqueta={`Acciones de la ficha ${m.nro_motor}`}>
                      <ItemMenu to={`/sistema/motores/editar/${ref}`} icono={Pencil}>
                        Editar ficha
                      </ItemMenu>
                      <ItemMenu onClick={() => setABorrar(m)} icono={Trash2} peligro>
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

      {/* Al pie queda solo el aviso de que la lista viene cortada, que es
          lo unico que hace falta saber justo ahi abajo. */}
      {motores.length > 0 && motores.length < total && (
        <div className="contador">
          Se muestran las primeras {motores.length} de {total}. Afiná la búsqueda para ver el resto.
        </div>
      )}

      {preguntando && (
        <Hoja
          titulo="Buscar con palabras"
          ayuda="Escribí lo que buscás como se lo dirías a alguien del taller. Se traduce a filtros y podés corregirlos después."
          onCerrar={() => setPreguntando(false)}
          pie={(
            <>
              <button type="button" className="btn btn-secondary"
                onClick={() => setPreguntando(false)}>
                Cancelar
              </button>
              <Button variant="primary" onClick={preguntar} isLoading={traduciendo}>
                Buscar
              </Button>
            </>
          )}
        >
          <form className="hoja__form" onSubmit={preguntar}>
            <textarea
              className="ui-input"
              rows={3}
              autoFocus
              style={{ resize: 'vertical' }}
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              placeholder="Ej: los trifásicos de 5 HP que rebobinamos para González"
            />
            <p className="campo-ayuda">
              Entiende marca, modelo, potencia, tipo o uso, número de ficha y el cliente
              dueño del motor. Lo que no reconoce lo busca como texto.
            </p>
          </form>
        </Hoja>
      )}

      <Modal
        isOpen={Boolean(aBorrar)}
        type="danger"
        title="Eliminar ficha"
        message={`Se borra la ficha N° ${aBorrar?.nro_motor} (${aBorrar ? titulo(aBorrar) : ''}) con todo su bobinado. No se puede deshacer.`}
        onClose={() => setABorrar(null)}
        onConfirm={confirmarBorrado}
        isLoading={borrando}
      />
    </div>
  );
};

export default Motores;
