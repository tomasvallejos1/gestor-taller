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

      <nav>
        {/* Enlaces basados en tu PDF Pag 4 */}
        <Link to="/sistema/home" style={linkStyle} className="sidebar-link">🏠 Home</Link>
        <Link to="/sistema/reparaciones" style={linkStyle} className="sidebar-link">🛠️ Reparaciones</Link>
        <Link to="/sistema/motores" style={linkStyle} className="sidebar-link">⚙️ Motores</Link>
        <Link to="/sistema/clientes" style={linkStyle} className="sidebar-link">👥 Clientes</Link>
        <Link to="/sistema/facturacion" style={linkStyle} className="sidebar-link">💰 Facturación</Link>
        <Link to="/sistema/informes" style={linkStyle} className="sidebar-link">📊 Informes</Link>
        
        <div style={{ marginTop: 'auto', borderTop: '1px solid #34495e', paddingTop: '20px' }}>
          <Link to="/" style={{...linkStyle, color: '#e74c3c'}}>🚪 Cerrar Sesión</Link>
        </div>
      </nav>
    </div>
  );
};

export default Sidebar;