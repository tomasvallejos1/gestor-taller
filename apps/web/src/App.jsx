import React, { useState } from 'react';
import { Routes, Route, useLocation, Link, Navigate } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import BarraMobile from './components/BarraMobile';
import ProtectedRoute from './components/ProtectedRoute';
import ActualizacionPwa from './components/ActualizacionPwa';

import Home from './pages/Home';
import Status from './pages/Status';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Motores from './pages/Motores';
import MotorForm from './pages/MotorForm';
import Ajustes from './pages/Ajustes';
import Clientes from './pages/Clientes';
import Reparaciones from './pages/Reparaciones';
import ReparacionDetalle from './pages/ReparacionDetalle';
import NuevoMotor from './pages/NuevoMotor';
import Mas from './pages/Mas';
import ComingSoon from './pages/ComingSoon';
import ForgotPassword from './pages/ForgotPassword';
import NuevaClave from './pages/NuevaClave';
import Presupuestos from './pages/Presupuestos';
import PresupuestoForm from './pages/PresupuestoForm';
import PresupuestoPublico from './pages/PresupuestoPublico';
import Catalogo from './pages/Catalogo';
import RemitoForm from './pages/RemitoForm';
import RemitoPublico from './pages/RemitoPublico';
import Facturas from './pages/Facturas';

function App() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSystemRoute = location.pathname.startsWith('/sistema');

  // El presupuesto y el remito compartidos se ven sin nada alrededor: el
  // cliente abre el link desde WhatsApp y tiene que ver el documento, no
  // el sitio.
  if (location.pathname.startsWith('/p/') || location.pathname.startsWith('/r/')) {
    return (
      <Routes>
        <Route path="/p/:token" element={<PresupuestoPublico />} />
        <Route path="/r/:token" element={<RemitoPublico />} />
      </Routes>
    );
  }

  return (
    <div className="app-container">
      <ActualizacionPwa />

      {isSystemRoute && user ? (
        <>
          {/* Cabecera del celular. Ya no lleva hamburguesa: la navegacion
              esta en la barra de abajo, al alcance del pulgar. */}
          <div className="mobile-header">
            <Link
              to="/sistema/home"
              onClick={() => setMobileMenuOpen(false)}
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'white',
                  background: 'var(--gradient-primary)'
                }}
              >
                <Wrench size={16} />
              </span>
              <h3 style={{ margin: 0, cursor: 'pointer', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>
                Bobinados David
              </h3>
            </Link>

          </div>

          <Sidebar isOpen={mobileMenuOpen} closeMenu={() => setMobileMenuOpen(false)} />
          <BarraMobile />
        </>
      ) : (
        !isSystemRoute && <Navbar />
      )}

      <div className={isSystemRoute && user ? 'system-content' : 'public-content'}>
        <Routes>
          {/* PÚBLICAS */}
          <Route path="/" element={<Home />} />
          <Route path="/estado" element={<Status />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          {/* Destino del link que manda Supabase por correo */}
          <Route path="/nueva-clave" element={<NuevaClave />} />

          {/* PRIVADAS */}
          <Route path="/sistema/home" element={<ProtectedRoute> <Dashboard /> </ProtectedRoute>} />
          
          <Route path="/sistema/motores" element={<ProtectedRoute> <Motores /> </ProtectedRoute>} />
          {/* El alta arranca eligiendo entre cargar a mano o escanear la
              ficha; el escaneo vive adentro de este mismo flujo. */}
          <Route path="/sistema/motores/nuevo" element={<ProtectedRoute requiere="editor"> <NuevoMotor /> </ProtectedRoute>} />
          <Route path="/sistema/motores/editar/:id" element={<ProtectedRoute> <MotorForm /> </ProtectedRoute>} />
          <Route path="/sistema/motores/ver/:id" element={<ProtectedRoute> <MotorForm /> </ProtectedRoute>} />

          {/* La seccion de fichas ya no existe: quedo integrada en el alta.
              Los links viejos van al alta en vez de dar 404. */}
          <Route path="/sistema/fichas" element={<Navigate to="/sistema/motores/nuevo" replace />} />
          <Route path="/sistema/fichas/revisar/:id" element={<Navigate to="/sistema/motores/nuevo" replace />} />

          <Route path="/sistema/mas" element={<ProtectedRoute> <Mas /> </ProtectedRoute>} />

          <Route path="/sistema/ajustes" element={<ProtectedRoute> <Ajustes /> </ProtectedRoute>} />

          {/* Presupuestos maneja precios: solo editor y super. RLS lo
              bloquea igual, pero mejor no mostrar una pantalla vacia. */}
          <Route path="/sistema/presupuestos" element={<ProtectedRoute requiere="editor"> <Presupuestos /> </ProtectedRoute>} />
          <Route path="/sistema/presupuestos/nuevo" element={<ProtectedRoute requiere="editor"> <PresupuestoForm /> </ProtectedRoute>} />
          <Route path="/sistema/presupuestos/:id" element={<ProtectedRoute requiere="editor"> <PresupuestoForm /> </ProtectedRoute>} />
          <Route path="/sistema/catalogo" element={<ProtectedRoute requiere="editor"> <Catalogo /> </ProtectedRoute>} />
          {/* Antes redirigia a presupuestos porque la facturacion no
              existia. Ahora es el listado de facturas emitidas. */}
          <Route path="/sistema/facturacion" element={<ProtectedRoute requiere="editor"> <Facturas /> </ProtectedRoute>} />

          <Route path="/sistema/reparaciones" element={<ProtectedRoute> <Reparaciones /> </ProtectedRoute>} />
          <Route path="/sistema/reparaciones/:id" element={<ProtectedRoute> <ReparacionDetalle /> </ProtectedRoute>} />
          <Route path="/sistema/remitos/:id" element={<ProtectedRoute requiere="editor"> <RemitoForm /> </ProtectedRoute>} />
          <Route path="/sistema/clientes" element={<ProtectedRoute> <Clientes /> </ProtectedRoute>} />
          <Route path="/sistema/informes" element={<ProtectedRoute> <ComingSoon title="Informes y Estadísticas" /> </ProtectedRoute>} />

          <Route path="/sistema" element={<Navigate to="/sistema/home" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;