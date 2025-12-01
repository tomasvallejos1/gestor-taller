import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal'; // Asegúrate de tener el componente Modal creado

const Motores = () => {
  const [motores, setMotores] = useState([]);
  
  // Estados para el Modal de Eliminación
  const [modalDeleteOpen, setModalDeleteOpen] = useState(false);
  const [motorToDelete, setMotorToDelete] = useState(null);

  useEffect(() => {
    cargarMotores();
  }, []);

  const cargarMotores = async () => {
    try {
      const respuesta = await api.get('/motores');
      setMotores(respuesta.data);
    } catch (error) {
      console.error("Error al cargar motores:", error);
    }
  };

  // 1. Abrir Modal de Confirmación
  const clickDelete = (motor) => {
    setMotorToDelete(motor);
    setModalDeleteOpen(true);
  };

  // 2. Ejecutar Eliminación (Al confirmar en el Modal)
  const confirmDelete = async () => {
    if (!motorToDelete) return;

    // El backend acepta tanto el ID largo como el nroOrden, enviamos el ID único para asegurar
    // o el nroOrden si preferimos. Usaremos el _id para eliminación segura.
    try {
      await api.delete(`/motores/${motorToDelete._id}`);
      
      // Actualizamos la lista visualmente
      setMotores(motores.filter(m => m._id !== motorToDelete._id));
      
      // Cerramos modal y limpiamos selección
      setModalDeleteOpen(false);
      setMotorToDelete(null);
    } catch (error) {
      alert("Error al eliminar: " + error.message);
      setModalDeleteOpen(false);
    }
  };

  // --- ESTILOS (Inspirados en diseño limpio/industrial) ---
  const thStyle = { 
    textAlign: 'left', 
    padding: '16px', 
    color: '#64748b', 
    fontSize: '0.75rem', 
    textTransform: 'uppercase', 
    letterSpacing: '1px', 
    borderBottom: '2px solid #e2e8f0',
    backgroundColor: '#f8fafc'
  };
  
  const tdStyle = { 
    padding: '16px', 
    borderBottom: '1px solid #f1f5f9', 
    color: '#334155', 
    fontSize: '0.9rem',
    verticalAlign: 'middle'
  };

  const linkActionStyle = {
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '0.8rem',
    marginRight: '20px',
    transition: 'color 0.2s'
  };

  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', color: '#0f172a', margin: 0 }}>Inventario de Motores</h2>
          <p style={{ color: '#64748b', marginTop: '5px', fontSize: '0.9rem' }}>Gestión de fichas técnicas y equipos</p>
        </div>
        <Link to="/sistema/motores/nuevo" className="btn btn-primary" style={{ background: '#0f172a', color: 'white', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem' }}>
          + NUEVA FICHA
        </Link>
      </div>

      {/* Tabla Card */}
      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{...thStyle, width: '60px'}}>N°</th>
              <th style={thStyle}>Marca / Modelo</th>
              <th style={thStyle}>Potencia</th>
              <th style={thStyle}>Amperaje</th>
              <th style={{...thStyle, textAlign: 'right'}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {motores.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>
                  No hay fichas registradas. Crea la primera con el botón superior.
                </td>
              </tr>
            ) : (
              motores.map((motor) => {
                // Determinamos qué ID usar para el link (preferimos el número corto)
                const linkId = motor.nroOrden ? motor.nroOrden : motor._id;

                return (
                  <tr key={motor._id} style={{ transition: 'background 0.1s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                    {/* COLUMNA NÚMERO DE ORDEN */}
                    <td style={{...tdStyle, fontWeight: '700', color: '#0f172a'}}>
                      {motor.nroOrden ? `#${motor.nroOrden}` : '-'}
                    </td>

                    {/* COLUMNA MARCA */}
                    <td style={tdStyle}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{motor.marca}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{motor.modelo || 'S/Modelo'}</div>
                    </td>

                    {/* COLUMNA HP */}
                    <td style={tdStyle}>
                      <span style={{ background: '#e2e8f0', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '500' }}>
                        {motor.hp}
                      </span>
                    </td>

                    {/* COLUMNA AMP */}
                    <td style={tdStyle}>{motor.amperaje || '-'}</td>

                    {/* COLUMNA ACCIONES */}
                    <td style={{...tdStyle, textAlign: 'right'}}>
                      <Link to={`/sistema/motores/ver/${linkId}`} style={{...linkActionStyle, color: '#0284c7'}}>
                        VER
                      </Link>
                      
                      <Link to={`/sistema/motores/editar/${linkId}`} style={{...linkActionStyle, color: '#475569'}}>
                        EDITAR
                      </Link>
                      
                      <button 
                        onClick={() => clickDelete(motor)} 
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: '#ef4444', 
                          fontWeight: '600', 
                          fontSize: '0.8rem', 
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        ELIMINAR
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Confirmación */}
      <Modal 
        isOpen={modalDeleteOpen}
        type="danger"
        title="Eliminar Ficha Técnica"
        message={`¿Estás seguro de que deseas eliminar la ficha #${motorToDelete?.nroOrden || '?'} (${motorToDelete?.marca})? Esta acción es irreversible.`}
        onClose={() => setModalDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default Motores;