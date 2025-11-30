import { Link } from 'react-router-dom';

const Navbar = () => {
  const navStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    background: 'white',
    borderBottom: '1px solid #ddd',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  };

  const ulStyle = {
    display: 'flex',
    gap: '20px',
    listStyle: 'none',
    margin: 0,
    padding: 0
  };

  const linkStyle = {
    textDecoration: 'none',
    color: '#333',
    fontWeight: '500'
  };

  return (
    <nav style={navStyle}>
      <div className="logo">
        <h2 style={{ margin: 0, color: '#0056b3', fontWeight: '800' }}>BOBINADOS DAVID</h2>
      </div>
      <ul style={ulStyle}>
        <li><Link to="/" style={linkStyle}>Inicio</Link></li>
        <li><Link to="/estado" style={linkStyle}>Estado Reparación</Link></li>
        <li><a href="#contacto" style={linkStyle}>Contacto</a></li>
      </ul>
      <div>
        <Link to="/login" className="btn">👤 Acceso</Link>
      </div>
    </nav>
  );
};

export default Navbar;