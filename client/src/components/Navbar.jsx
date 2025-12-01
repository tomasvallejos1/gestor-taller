import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  // Estado para saber si el menú móvil está abierto
  const [isOpen, setIsOpen] = useState(false);

  // Función para cerrar el menú al hacer click en un enlace
  const closeMenu = () => setIsOpen(false);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        
        {/* 1. LOGO MEJORADO (Icono + Texto) */}
        <Link to="/" className="nav-logo" onClick={closeMenu}>
          <div className="nav-icon">⚡</div>
          BOBINADOS DAVID
        </Link>

        {/* 2. BOTÓN HAMBURGUESA (Solo visible en Móvil) */}
        <div className="menu-icon" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? '✕' : '☰'} {/* Cambia de Hamburguesa a X */}
        </div>

        {/* 3. MENÚ DE NAVEGACIÓN */}
        <ul className={isOpen ? 'nav-menu active' : 'nav-menu'}>
          <li className="nav-item">
            <Link to="/" className="nav-link" onClick={closeMenu}>Inicio</Link>
          </li>
          <li className="nav-item">
            <a href="#contacto" className="nav-link" onClick={closeMenu}>Contacto</a>
          </li>
          <li className="nav-item">
            <Link to="/estado" className="nav-link" onClick={closeMenu}>Estado Reparación</Link>
          </li>
          <li className="nav-item" style={{display: 'flex', justifyContent: 'center'}}>
            <Link to="/login" className="nav-link btn-login" onClick={closeMenu}>
              👤 Acceso Negocio
            </Link>
          </li>
        </ul>

      </div>
    </nav>
  );
};

export default Navbar;