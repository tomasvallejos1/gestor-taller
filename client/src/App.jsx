import React, { useState, useContext } from 'react';
import { Routes, Route, useLocation, Link, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Status from './pages/Status';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Motores from './pages/Motores';
import MotorForm from './pages/MotorForm';
import Ajustes from './pages/Ajustes';
import ComingSoon from './pages/ComingSoon';
import ForgotPassword from './pages/ForgotPassword';

function App() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSystemRoute = location.pathname.startsWith('/sistema');

  return (
    <div className="app-container">
      
      {isSystemRoute && user ? (
        <>
          {/* HEADER MÓVIL (Con Rayito) */}
          <div className="mobile-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link 
              to="/sistema/home" 
              onClick={() => setMobileMenuOpen(false)} 
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span style={{ fontSize: '1.5rem', color: '#38bdf8' }}>⚡</span>
              <h3 style={{ margin: 0, cursor: 'pointer', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>
                Bobinados David
              </h3>
            </Link>

            <button 
              className="hamburger-btn" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}
            >
              ☰
            </button>
          </div>

          <Sidebar isOpen={mobileMenuOpen} closeMenu={() => setMobileMenuOpen(false)} />
        </>
      ) : (
        !isSystemRoute && <Navbar />
      )}

      <div className={isSystemRoute && user ? "system-content" : "public-content"}>
        <Routes>
          {/* PÚBLICAS */}
          <Route path="/" element={<Home />} />
          <Route path="/estado" element={<Status />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* PRIVADAS */}
          <Route path="/sistema/home" element={<ProtectedRoute> <Dashboard /> </ProtectedRoute>} />
          
          <Route path="/sistema/motores" element={<ProtectedRoute> <Motores /> </ProtectedRoute>} />
          <Route path="/sistema/motores/nuevo" element={<ProtectedRoute> <MotorForm /> </ProtectedRoute>} />
          <Route path="/sistema/motores/editar/:id" element={<ProtectedRoute> <MotorForm /> </ProtectedRoute>} />
          <Route path="/sistema/motores/ver/:id" element={<ProtectedRoute> <MotorForm /> </ProtectedRoute>} />

          <Route path="/sistema/ajustes" element={<ProtectedRoute> <Ajustes /> </ProtectedRoute>} />

          <Route path="/sistema/reparaciones" element={<ProtectedRoute> <ComingSoon title="Módulo de Reparaciones" /> </ProtectedRoute>} />
          <Route path="/sistema/clientes" element={<ProtectedRoute> <ComingSoon title="Gestión de Clientes" /> </ProtectedRoute>} />
          <Route path="/sistema/facturacion" element={<ProtectedRoute> <ComingSoon title="Sistema de Facturación" /> </ProtectedRoute>} />
          <Route path="/sistema/informes" element={<ProtectedRoute> <ComingSoon title="Informes y Estadísticas" /> </ProtectedRoute>} />

          <Route path="/sistema" element={<Navigate to="/sistema/home" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;