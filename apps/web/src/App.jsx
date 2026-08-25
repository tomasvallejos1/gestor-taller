import React, { Suspense, lazy, useState } from 'react';
import { Routes, Route, useLocation, Link, Navigate } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import BarraMobile from './components/BarraMobile';
import ProtectedRoute from './components/ProtectedRoute';
import ActualizacionPwa from './components/ActualizacionPwa';
import Esqueleto from './components/Esqueleto';

/*
 * Las paginas se bajan cuando se visitan.
 *
 * Antes todo viajaba en un solo archivo de 726 KB: entrar a ver el
 * estado de una orden implicaba descargar tambien el alta de fichas, el
 * formulario de presupuestos y la pantalla de ajustes. En el taller eso
 * se paga en la pantalla en blanco del arranque, con la señal que haya.
 *
 * Quedan directas las tres que se pintan primero --el landing, el login
 * y el panel--: hacerlas diferidas agrega un viaje justo antes de lo
 * unico que el usuario esta esperando ver.
 */
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ComingSoon from './pages/ComingSoon';

const Status = lazy(() => import('./pages/Status'));
const Informes = lazy(() => import('./pages/Informes'));
const Motores = lazy(() => import('./pages/Motores'));
const MotorForm = lazy(() => import('./pages/MotorForm'));
const FichaMotor = lazy(() => import('./pages/FichaMotor'));
const Ajustes = lazy(() => import('./pages/Ajustes'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Reparaciones = lazy(() => import('./pages/Reparaciones'));
const ReparacionDetalle = lazy(() => import('./pages/ReparacionDetalle'));
const NuevoMotor = lazy(() => import('./pages/NuevoMotor'));
const Mas = lazy(() => import('./pages/Mas'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const NuevaClave = lazy(() => import('./pages/NuevaClave'));
const Presupuestos = lazy(() => import('./pages/Presupuestos'));
const PresupuestoForm = lazy(() => import('./pages/PresupuestoForm'));
const PresupuestoPublico = lazy(() => import('./pages/PresupuestoPublico'));
const Catalogo = lazy(() => import('./pages/Catalogo'));
const RemitoForm = lazy(() => import('./pages/RemitoForm'));
const RemitoPublico = lazy(() => import('./pages/RemitoPublico'));
const Facturas = lazy(() => import('./pages/Facturas'));


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
      <Suspense fallback={<Esqueleto tipo="pagina" />}>
        <Routes>
          <Route path="/p/:token" element={<PresupuestoPublico />} />
          <Route path="/r/:token" element={<RemitoPublico />} />
        </Routes>
      </Suspense>
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
        <Suspense fallback={<Esqueleto tipo="pagina" />}>
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
          {/* Ver y editar son dos pantallas distintas. Compartian el
              formulario con los campos apagados, y leer una ficha --que
              es lo que se hace todo el dia-- significaba recorrer veinte
              casilleros grises, la mayoria vacios, para encontrar un
              numero. */}
          <Route path="/sistema/motores/ver/:id" element={<ProtectedRoute> <FichaMotor /> </ProtectedRoute>} />

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
          <Route path="/sistema/informes" element={<ProtectedRoute> <Informes /> </ProtectedRoute>} />

          <Route path="/sistema" element={<Navigate to="/sistema/home" replace />} />
        </Routes>
        </Suspense>
      </div>
    </div>
  );
}

export default App;