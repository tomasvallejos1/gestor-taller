import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Pencil, Trash2, SlidersHorizontal, X, PackageOpen,
} from 'lucide-react';
import Modal from '../components/Modal';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import MenuAcciones, { ItemMenu } from '../components/ui/MenuAcciones';
import { useAuth } from '../context/AuthContext';
import { listarMotores, eliminarMotor, etiquetaPotencia } from '../lib/motores';

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

const FILTROS_VACIOS = { nro: '', texto: '', marca: '', modelo: '', hp: '', tipo: '' };
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
            placeholder="Buscar por descripcion, marca o uso"
            aria-label="Buscar fichas"
          />
          {filtros.texto && (
            <button type="button" className="buscador__limpiar" aria-label="Borrar la busqueda"
              onClick={() => setFiltros((f) => ({ ...f, texto: '' }))}>
              <X size={15} />
            </button>
          )}
        </div>

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

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}

      {cargando ? (
        <div style={{ padding: '48px 0' }}>
          <Spinner label="Buscando fichas..." centered />
        </div>
      ) : motores.length === 0 ? (
        <div className="vacio">
          <PackageOpen size={26} />
          <div>
            {filtros.texto || avanzadosPuestos
              ? 'Ninguna ficha coincide con la busqueda.'
              : 'Todavia no hay fichas cargadas.'}
          </div>
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

      {motores.length > 0 && (
        <div className="contador">
          {motores.length === total
            ? `${total} ${total === 1 ? 'ficha' : 'fichas'}`
            : `${motores.length} de ${total} fichas`}
        </div>
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
