import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Sidebar = ({ isOpen, closeMenu }) => {
  const { logout } = useContext(AuthContext);
  const { isDarkMode, toggleTheme } = useTheme();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const sidebarStyle = {
    height: '100vh',
    background: isDarkMode ? '#020617' : '#0f172a',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    boxSizing: 'border-box',
    position: 'fixed',
    top: 0,
    left: 0,
    borderRight: isDarkMode ? '1px solid #1e293b' : 'none'
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

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) { document.exitFullscreen(); setIsFullscreen(false); }
    }
    closeMenu();
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
           
           {/* FILA DE UTILIDADES (Iconos lado a lado) */}
           <div style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
               
               {/* Botón Tema */}
               <button 
                 onClick={toggleTheme} 
                 title={isDarkMode ? "Cambiar a Modo Claro" : "Cambiar a Modo Noche"}
                 style={{
                   ...linkStyle, 
                   color: '#fbbf24', 
                   textAlign: 'center', 
                   flex: 1, // Ocupa 50%
                   background: 'rgba(255,255,255,0.05)', // Un fondo sutil para que parezca botón
                   marginBottom: 0
                 }}
               >
                 {isDarkMode ? '☀️' : '🌙'}
               </button>

               {/* Botón Pantalla Completa */}
               <button 
                 onClick={toggleFullScreen} 
                 title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
                 style={{
                   ...linkStyle, 
                   color: '#38bdf8', 
                   textAlign: 'center', 
                   flex: 1, // Ocupa 50%
                   background: 'rgba(255,255,255,0.05)',
                   marginBottom: 0
                 }}
               >
                 {isFullscreen ? '🔽' : '📺'}
               </button>
           </div>

           {/* AJUSTES DE CUENTA */}
           <Link to="/sistema/ajustes" style={{...linkStyle, color: '#94a3b8'}} onClick={closeMenu}>
             ⚙️ AJUSTES DE CUENTA
           </Link>

           {/* CERRAR SESIÓN */}
           <button 
             style={{...linkStyle, color: '#ef4444', marginTop: '5px', fontWeight: '800'}} 
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