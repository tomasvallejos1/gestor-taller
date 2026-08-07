import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Wrench, Users, Ellipsis,
} from 'lucide-react';

/**
 * Barra de navegacion inferior para el celular.
 *
 * Reemplaza al menu hamburguesa: en el taller se usa el telefono con una
 * mano y el pulgar no llega comodo a la esquina de arriba. Abajo si.
 *
 * Cuatro destinos y nada mas. El resto vive en "Mas": una barra con ocho
 * iconos de 40px es una barra donde se toca el equivocado.
 */

const ITEMS = [
  { to: '/sistema/home', label: 'Panel', icon: LayoutDashboard },
  { to: '/sistema/motores', label: 'Motores', icon: Wrench },
  { to: '/sistema/clientes', label: 'Clientes', icon: Users },
  { to: '/sistema/mas', label: 'Mas', icon: Ellipsis },
];

const BarraMobile = () => (
  <nav className="barra-mobile" aria-label="Navegacion principal">
    <div className="barra-mobile-vidrio">
      {ITEMS.map((item) => {
        const Icono = item.icon;
        const { to, label } = item;
        return (
        <NavLink
          key={to}
          to={to}
          // "end" solo en el panel: sin eso, /sistema/home marcaria activo
          // cualquier ruta que empiece igual.
          end={to === '/sistema/home'}
          className={({ isActive }) => `barra-mobile-item${isActive ? ' activo' : ''}`}
        >
          <Icono size={21} strokeWidth={2.1} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
        );
      })}
    </div>
  </nav>
);

export default BarraMobile;
