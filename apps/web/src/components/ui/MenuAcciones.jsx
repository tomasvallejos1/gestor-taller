import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';

/**
 * Menu de acciones ocasionales de una fila.
 *
 * Editar y eliminar estaban al lado de "ver" y con el mismo peso, en
 * cada fila de cada listado. Ver una ficha se hace todo el dia;
 * eliminarla, casi nunca --y cuando se toca por error se pierde el
 * bobinado entero--. Aca la accion principal es la fila y estas dos
 * quedan a un toque de distancia.
 */

const MenuAcciones = ({ etiqueta, children }) => {
  const [abierto, setAbierto] = useState(false);
  const [haciaArriba, setHaciaArriba] = useState(false);
  const caja = useRef(null);
  const boton = useRef(null);

  const cerrar = useCallback(() => setAbierto(false), []);

  const alternar = () => {
    if (!abierto && boton.current) {
      // En la ultima fila de la lista el panel caeria debajo de la
      // barra inferior, que va por encima. Si no entra, se abre para
      // arriba en vez de quedar tapado.
      const r = boton.current.getBoundingClientRect();
      setHaciaArriba(window.innerHeight - r.bottom < 220);
    }
    setAbierto((a) => !a);
  };

  useEffect(() => {
    if (!abierto) return undefined;

    const afuera = (e) => {
      if (caja.current && !caja.current.contains(e.target)) cerrar();
    };
    const tecla = (e) => {
      if (e.key === 'Escape') { cerrar(); boton.current?.focus(); }
    };

    document.addEventListener('mousedown', afuera);
    document.addEventListener('touchstart', afuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', afuera);
      document.removeEventListener('touchstart', afuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto, cerrar]);

  return (
    <div className="menu-acciones" ref={caja}>
      <button
        ref={boton}
        type="button"
        className="menu-acciones__boton"
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={alternar}
      >
        <MoreVertical size={18} />
      </button>

      {abierto && (
        <div
          className="menu-acciones__panel"
          role="menu"
          style={haciaArriba ? { top: 'auto', bottom: 'calc(100% + 4px)' } : undefined}
          // Cualquier item que se toque cierra el menu; asi cada uno no
          // tiene que acordarse de hacerlo.
          onClick={cerrar}
        >
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Un renglon del menu. Con `to` es un enlace; con `onClick`, un boton.
 */
export const ItemMenu = ({ to, onClick, icono: Icono, peligro = false, children }) => {
  const clase = `menu-acciones__item${peligro ? ' menu-acciones__item--peligro' : ''}`;
  const contenido = (
    <>
      {Icono ? <Icono size={15} aria-hidden="true" /> : null}
      {children}
    </>
  );

  if (to) {
    return <Link to={to} role="menuitem" className={clase}>{contenido}</Link>;
  }
  return (
    <button type="button" role="menuitem" className={clase} onClick={onClick}>
      {contenido}
    </button>
  );
};

export default MenuAcciones;
