import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar'; 
import Home from './pages/Home';
import Status from './pages/Status';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  const location = useLocation();
  // Detectamos si estamos dentro de la zona "/sistema"
  const isSystemRoute = location.pathname.startsWith('/sistema');

  return (
    <div style={isSystemRoute ? { display: 'flex' } : {}}>
      
      {/* LÓGICA DE VISUALIZACIÓN:
          - Si estamos en sistema -> Muestra Sidebar
          - Si NO estamos en sistema -> Muestra Navbar público
      */}
      
      {isSystemRoute ? (
        <Sidebar /> 
      ) : (
        <Navbar />
      )}

      {/* Contenedor Principal */}
      <div style={isSystemRoute ? { marginLeft: '250px', padding: '20px', width: '100%', background: '#f4f6f7', minHeight: '100vh' } : { width: '100%' }}>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/" element={<Home />} />
          <Route path="/estado" element={<Status />} />
          <Route path="/login" element={<Login />} />

          {/* Rutas Privadas del Sistema */}
          <Route path="/sistema/home" element={<Dashboard />} />
          
          {/* Aquí agregaremos las otras rutas del menú poco a poco */}
          <Route path="/sistema/motores" element={<h2>Gestión de Motores (Próximamente)</h2>} />
        </Routes>
      </div>
    </div>
  );
}

export default App;