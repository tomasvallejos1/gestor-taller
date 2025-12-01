import React, { useState } from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom'; // Importamos Link
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

  // Estado para controlar el menú móvil
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div style={isSystemRoute ? { display: 'flex', flexDirection: 'column' } : {}}>
      
      {isSystemRoute ? (
        <>
          {/* HEADER MÓVIL (Solo visible en celular) */}
          <div className="mobile-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            
            {/* Título con enlace - Forzamos estilo flex para asegurar que se vea */}
            <Link 
              to="/sistema/home" 
              onClick={() => setMobileMenuOpen(false)} 
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
            >
              <h3 style={{ margin: 0, cursor: 'pointer', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>
                Bobinados David
              </h3>
            </Link>

            {/* Botón de 3 barritas */}
            <button 
              className="hamburger-btn" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}
            >
              ☰
            </button>
          </div>

          {/* Pasamos el estado al Sidebar */}
          <Sidebar isOpen={mobileMenuOpen} closeMenu={() => setMobileMenuOpen(false)} />
        </>
      ) : (
        <Navbar />
      )}

      {/* Contenedor Principal */}
      <div className={isSystemRoute ? "main-content" : ""} style={isSystemRoute ? { marginLeft: '250px', padding: '20px', width: '100%', background: '#f4f6f7', minHeight: '100vh', boxSizing: 'border-box' } : { width: '100%' }}>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/" element={<Home />} />
          <Route path="/estado" element={<Status />} />
          <Route path="/login" element={<Login />} />

          {/* Rutas del Sistema */}
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