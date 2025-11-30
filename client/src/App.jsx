import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Status from './pages/Status';

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/estado" element={<Status />} />
        {/* Aquí agregaremos el Login después */}
        <Route path="/login" element={<h2 style={{textAlign:'center', marginTop:'50px'}}>Próximamente: Login</h2>} />
      </Routes>
    </>
  );
}

export default App;