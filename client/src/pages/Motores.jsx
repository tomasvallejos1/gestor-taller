import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api'; // Importamos la conexión que acabamos de crear

const Motores = () => {
  const [motores, setMotores] = useState([]);

  // Al cargar la página, pedimos los datos al backend
  useEffect(() => {
    cargarMotores();
  }, []);

  const cargarMotores = async () => {
    try {
      const respuesta = await api.get('/motores');
      setMotores(respuesta.data);
    } catch (error) {
      console.error("Error cargando motores:", error);
    }
  };

  return (
    <div>
      {/* Encabezado y Botón Crear (Página 5 PDF) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#2c3e50' }}>Gestión de Motores</h2>
        <Link to="/sistema/motores/nuevo" className="btn" style={{ background: '#27ae60' }}>
          + Crear Nueva Ficha
        </Link>
      </div>

      {/* Tabla de Motores */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left', color: '#7f8c8d' }}>
              <th style={{ padding: '10px' }}>MARCA</th>
              <th style={{ padding: '10px' }}>MODELO</th>
              <th style={{ padding: '10px' }}>HP</th>
              <th style={{ padding: '10px' }}>AMP</th>
              <th style={{ padding: '10px' }}>ESTADO</th>
              <th style={{ padding: '10px' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {motores.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                  No hay motores registrados aún.
                </td>
              </tr>
            ) : (
              motores.map((motor) => (
                <tr key={motor._id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{motor.marca}</td>
                  <td style={{ padding: '10px' }}>{motor.modelo}</td>
                  <td style={{ padding: '10px' }}>{motor.hp}</td>
                  <td style={{ padding: '10px' }}>{motor.amperaje}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      padding: '5px 10px', 
                      borderRadius: '15px', 
                      fontSize: '0.8rem',
                      background: motor.estado === 'Terminado' ? '#d4edda' : '#fff3cd',
                      color: motor.estado === 'Terminado' ? '#155724' : '#856404'
                    }}>
                      {motor.estado}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <Link to={`/sistema/motores/editar/${motor._id}`} style={{ color: '#3498db', marginRight: '10px', textDecoration: 'none' }}>Abrir</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Motores;