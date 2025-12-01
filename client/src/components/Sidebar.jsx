import React, { useContext } from 'react'; // <--- 1. Importamos useContext
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext'; // <--- 2. Importamos el Contexto

const Sidebar = ({ isOpen, closeMenu }) => {
  const { logout } = useContext(AuthContext); // <--- 3. Sacamos la función logout

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
    padding: '15px 10px',
    display: 'block',
    borderRadius: '6px',
    marginBottom: '8px',
    fontSize: '0.95rem',
    fontWeight: '500',
    transition: 'background 0.2s',
    cursor: 'pointer' // Aseguramos que se vea como botón
  };

  // Función para manejar el cierre de sesión
  const handleLogout = (e) => {
    e.preventDefault(); // Evita la navegación por defecto
    closeMenu();        // Cierra el menú móvil si está abierto
    logout();           // <--- EJECUTA EL LOGOUT REAL (Borra token y redirige)
  };

  return (
    <>
      {/* El Sidebar en sí */}
      <div className={`sidebar ${isOpen ? 'open' : ''}`} style={sidebarStyle}>
        
        {/* LOGO CON ENLACE AL HOME */}
        <div style={{ marginBottom: '30px', textAlign: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '20px' }}>
          <Link to="/sistema/home" onClick={closeMenu} style={{ textDecoration: 'none' }}>
            <h3 style={{ margin: 0, color: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '1.3rem' }}>BOBINADOS DAVID</h3>
            <small style={{ color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}>Sistema de Gestión</small>
          </Link>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column' }}>
          <Link to="/sistema/home" style={linkStyle} onClick={closeMenu}>INICIO</Link>
          <Link to="/sistema/reparaciones" style={linkStyle} onClick={closeMenu}>REPARACIONES</Link>
          <Link to="/sistema/motores" style={linkStyle} onClick={closeMenu}>MOTORES</Link>
          <Link to="/sistema/clientes" style={linkStyle} onClick={closeMenu}>CLIENTES</Link>
          <Link to="/sistema/facturacion" style={linkStyle} onClick={closeMenu}>FACTURACIÓN</Link>
          <Link to="/sistema/informes" style={linkStyle} onClick={closeMenu}>INFORMES</Link>
        </nav>
        
        <div style={{ marginTop: 'auto' }}>
           {/* CAMBIO AQUÍ: Usamos onClick={handleLogout} */}
           <a 
             href="#" 
             style={{...linkStyle, color: '#ef4444', borderTop: '1px solid #1e293b'}} 
             onClick={handleLogout}
           >
             CERRAR SESIÓN
           </a>
        </div>
      </div>

      {/* Fondo oscuro para cerrar al hacer click afuera (Solo móvil) */}
      <div className={`overlay ${isOpen ? 'show' : ''}`} onClick={closeMenu}></div>
    </>
  );
};

export default Sidebar;