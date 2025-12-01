import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Status from './pages/Status';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Motores from './pages/Motores';
import MotorForm from './pages/MotorForm'; // <--- Importante que esto esté aquí

function App() {
  const location = useLocation();
  
  // Detectamos si estamos en la zona "/sistema" para cambiar el diseño
  const isSystemRoute = location.pathname.startsWith('/sistema');

  return (
    <div style={isSystemRoute ? { display: 'flex' } : {}}>
      
      {/* Menú Lateral (Sistema) o Menú Superior (Público) */}
      {isSystemRoute ? <Sidebar /> : <Navbar />}

      <div style={isSystemRoute ? { marginLeft: '250px', padding: '20px', width: '100%', background: '#f4f6f7', minHeight: '100vh' } : { width: '100%' }}>
        <Routes>
          {/* --- RUTAS PÚBLICAS --- */}
          <Route path="/" element={<Home />} />
          <Route path="/estado" element={<Status />} />
          <Route path="/login" element={<Login />} />

          {/* --- RUTAS DEL SISTEMA --- */}
          <Route path="/sistema/home" element={<Dashboard />} />
          
          {/* Rutas de Gestión de Motores */}
          <Route path="/sistema/motores" element={<Motores />} />
          <Route path="/sistema/motores/nuevo" element={<MotorForm />} />
          <Route path="/sistema/motores/editar/:id" element={<MotorForm />} />
          
          {/* 👇👇👇 ESTA ES LA LÍNEA QUE FALTABA O ESTABA MAL ESCRITA 👇👇👇 */}
          <Route path="/sistema/motores/ver/:id" element={<MotorForm />} /> 

        </Routes>
      </div>
    </div>
  );
}

export default App;