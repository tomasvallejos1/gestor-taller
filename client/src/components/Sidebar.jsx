import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Sidebar = ({ isOpen, closeMenu }) => {
  const { logout } = useContext(AuthContext);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const sidebarStyle = {
    height: '100vh',
    background: '#0f172a',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    boxSizing: 'border-box',
    position: 'fixed',
    top: 0,
    left: 0,
  };

  const linkStyle = {
    color: '#ecf0f1',
    textDecoration: 'none',
    padding: '12px 10px',
    display: 'block',
    borderRadius: '6px',
    marginBottom: '5px',
    fontSize: '0.9rem',
    fontWeight: '500',
    transition: 'background 0.2s',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    fontFamily: 'inherit'
  };

  const handleLogout = (e) => {
    e.preventDefault();
    closeMenu();
    logout();
  };

  // --- FUNCIÓN PANTALLA COMPLETA ---
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.log(`Error al intentar pantalla completa: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
    closeMenu(); // Cerramos el menú en móvil para ver el resultado
  };

  return (
    <>
      <div className={`sidebar ${isOpen ? 'open' : ''}`} style={sidebarStyle}>
        
        {/* LOGO */}
        <div style={{ marginBottom: '30px', textAlign: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '20px' }}>
          <Link to="/sistema/home" onClick={closeMenu} style={{ textDecoration: 'none' }}>
            <h3 style={{ margin: 0, color: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '1.3rem' }}>BOBINADOS DAVID</h3>
            <small style={{ color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}>Sistema de Gestión</small>
          </Link>
        </div>

        {/* NAVEGACIÓN */}
        <nav style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <Link to="/sistema/home" style={linkStyle} onClick={closeMenu}>INICIO</Link>
          <Link to="/sistema/reparaciones" style={linkStyle} onClick={closeMenu}>REPARACIONES</Link>
          <Link to="/sistema/motores" style={linkStyle} onClick={closeMenu}>MOTORES</Link>
          <Link to="/sistema/clientes" style={linkStyle} onClick={closeMenu}>CLIENTES</Link>
          <Link to="/sistema/facturacion" style={linkStyle} onClick={closeMenu}>FACTURACIÓN</Link>
          <Link to="/sistema/informes" style={linkStyle} onClick={closeMenu}>INFORMES</Link>
        </nav>
        
        {/* ZONA INFERIOR */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '15px' }}>
           
           {/* BOTÓN PANTALLA COMPLETA */}
           <button onClick={toggleFullScreen} style={{...linkStyle, color: '#38bdf8'}}>
             {isFullscreen ? '🔽 SALIR PANTALLA COMPLETA' : '📺 PANTALLA COMPLETA'}
           </button>

           {/* AJUSTES */}
           <Link to="/sistema/ajustes" style={{...linkStyle, color: '#94a3b8'}} onClick={closeMenu}>
             ⚙️ AJUSTES DE CUENTA
           </Link>

           {/* SALIR */}
           <button 
             style={{
               ...linkStyle, 
               color: '#ef4444', 
               marginTop: '5px',
               fontWeight: '800'
             }} 
             onClick={handleLogout}
           >
             CERRAR SESIÓN
           </button>
        </div>
      </div>

      <div className={`overlay ${isOpen ? 'show' : ''}`} onClick={closeMenu}></div>
    </>
  );
};

export default Sidebar;