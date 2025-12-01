import React, { useState, useContext } from 'react';
import { Routes, Route, useLocation, Link, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext'; // <--- 1. Importamos el Contexto
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';

// Imports de páginas
import Home from './pages/Home';
import Status from './pages/Status';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Motores from './pages/Motores';
import MotorForm from './pages/MotorForm';
import Ajustes from './pages/Ajustes';
import ForgotPassword from './pages/ForgotPassword';


function App() {
  const { user } = useContext(AuthContext); // <--- 2. Obtenemos el usuario actual
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Detectamos si estamos en zona de sistema
  const isSystemRoute = location.pathname.startsWith('/sistema');

  return (
    <div className="app-container">
      
      {/* 3. LÓGICA DE VISUALIZACIÓN SEGURA:
          Solo mostramos el Sidebar/Header si es ruta de sistema Y ADEMÁS el usuario existe.
      */}
      {isSystemRoute && user ? (
        <>
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
            <button className="hamburger-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              ☰
            </button>
          </div>

          <Sidebar isOpen={mobileMenuOpen} closeMenu={() => setMobileMenuOpen(false)} />
        </>
      ) : (
        // Si NO es ruta de sistema, mostramos Navbar pública.
        // Si ES ruta de sistema pero NO hay usuario, no mostramos nada (el ProtectedRoute redirigirá)
        !isSystemRoute && <Navbar />
      )}

      {/* Contenedor Principal */}
      {/* Si es sistema Y hay usuario, aplicamos margen. Si no, ancho completo. */}
      <div className={isSystemRoute && user ? "system-content" : "public-content"}>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/" element={<Home />} />
          <Route path="/estado" element={<Status />} />
          <Route path="/login" element={<Login />} />

          {/* Rutas Protegidas */}
          <Route path="/sistema/home" element={
            <ProtectedRoute> <Dashboard /> </ProtectedRoute>
          } />
          
          <Route path="/sistema/motores" element={
            <ProtectedRoute> <Motores /> </ProtectedRoute>
          } />
          
          <Route path="/sistema/motores/nuevo" element={
            <ProtectedRoute> <MotorForm /> </ProtectedRoute>
          } />
          
          <Route path="/sistema/motores/editar/:id" element={
            <ProtectedRoute> <MotorForm /> </ProtectedRoute>
          } />
          
          <Route path="/sistema/motores/ver/:id" element={
            <ProtectedRoute> <MotorForm /> </ProtectedRoute>
          } />

          {/* 4. REDIRECCIÓN DE SEGURIDAD PARA LA RAÍZ "/sistema"
              Si alguien pone solo "/sistema", lo mandamos al home (o al login si no tiene permiso)
          */}
          <Route path="/sistema" element={<Navigate to="/sistema/home" replace />} />
          <Route path="/sistema/ajustes" element={<ProtectedRoute> <Ajustes /> </ProtectedRoute>} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;