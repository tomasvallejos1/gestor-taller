import { Link } from 'react-router-dom';

const Sidebar = () => {
  const sidebarStyle = {
    width: '250px',
    height: '100vh', // Altura completa
    background: '#2c3e50', // Color oscuro profesional
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    boxSizing: 'border-box',
    position: 'fixed', // Para que se quede fijo
    left: 0,
    top: 0
  };

  const linkStyle = {
    color: '#ecf0f1',
    textDecoration: 'none',
    padding: '15px 10px',
    display: 'block',
    borderRadius: '5px',
    marginBottom: '5px',
    transition: 'background 0.3s'
  };

  const logoStyle = {
    marginBottom: '40px',
    textAlign: 'center',
    borderBottom: '1px solid #34495e',
    paddingBottom: '20px'
  };

  return (
    <div style={sidebarStyle}>
      <div style={logoStyle}>
        <h3>BOBINADOS DAVID</h3>
        <small>Sistema de Gestión</small>
      </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <Link to="/sistema/home" style={linkStyle}>INICIO</Link>
          <Link to="/sistema/reparaciones" style={linkStyle}>REPARACIONES</Link>
          <Link to="/sistema/motores" style={linkStyle}>MOTORES</Link>
          <Link to="/sistema/clientes" style={linkStyle}>CLIENTES</Link>
          <Link to="/sistema/facturacion" style={linkStyle}>FACTURACIÓN</Link>
          <Link to="/sistema/informes" style={linkStyle}>INFORMES</Link>
        </nav>
    </div>
  );
};

export default Sidebar;