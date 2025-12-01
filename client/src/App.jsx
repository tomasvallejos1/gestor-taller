import React, { useState } from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Status from './pages/Status';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Motores from './pages/Motores';
import MotorForm from './pages/MotorForm';

function App() {
  const location = useLocation();
  const isSystemRoute = location.pathname.startsWith('/sistema');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-container">
      
      {isSystemRoute ? (
        <>
          {/* HEADER MÓVIL (Controlado por CSS para que solo salga en celular) */}
          <div className="mobile-header">
            <Link 
              to="/sistema/home" 
              onClick={() => setMobileMenuOpen(false)} 
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
            >
              <h3 style={{ margin: 0, cursor: 'pointer', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>
                Bobinados David
              </h3>
            </Link>
            <button 
              className="hamburger-btn" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              ☰
            </button>
          </div>

          <Sidebar isOpen={mobileMenuOpen} closeMenu={() => setMobileMenuOpen(false)} />
        </>
      ) : (
        <Navbar />
      )}

      {/* CONTENEDOR PRINCIPAL */}
      {/* Si es ruta de sistema, usa la clase 'system-content', si no, 'public-content' */}
      <div className={isSystemRoute ? "system-content" : "public-content"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/estado" element={<Status />} />
          <Route path="/login" element={<Login />} />

          <Route path="/sistema/home" element={<Dashboard />} />
          <Route path="/sistema/motores" element={<Motores />} />
          <Route path="/sistema/motores/nuevo" element={<MotorForm />} />
          <Route path="/sistema/motores/editar/:id" element={<MotorForm />} />
          <Route path="/sistema/motores/ver/:id" element={<MotorForm />} /> 
        </Routes>
      </div>
    </div>
  );
}

export default App;