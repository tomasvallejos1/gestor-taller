import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Status from './pages/Status';
import Login from './pages/Login'; 

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/estado" element={<Status />} />
        <Route path="/login" element={<Login />} /> {/* <--- 2. Agregamos la ruta */}
        
        {/* Ruta temporal para cuando entremos al sistema */}
        <Route path="/sistema/home" element={<h2>Bienvenido al Panel de Control (Próximamente)</h2>} />
      </Routes>
    </>
  );
}

export default App;