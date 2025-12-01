import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';

const Motores = () => {
  // Estado de datos crudos (del servidor)
  const [motores, setMotores] = useState([]);
  
  // Estado de datos filtrados (lo que se ve en pantalla)
  const [filteredMotores, setFilteredMotores] = useState([]);

  // Estados de Filtros
  const [filters, setFilters] = useState({
    global: '', // Búsqueda general
    nroOrden: '',
    marca: '',
    modelo: '',
    hp: '',
    tipo: ''
  });

  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest', 'id_asc', 'id_desc'

  // Estados Modal
  const [modalDeleteOpen, setModalDeleteOpen] = useState(false);
  const [motorToDelete, setMotorToDelete] = useState(null);

  useEffect(() => {
    cargarMotores();
  }, []);

  // Cada vez que cambien los filtros o el orden, ejecutamos el filtrado
  useEffect(() => {
    applyFilters();
  }, [motores, filters, sortOrder]);

  const cargarMotores = async () => {
    try {
      const respuesta = await api.get('/motores');
      setMotores(respuesta.data);
      setFilteredMotores(respuesta.data); // Inicialmente mostramos todo
    } catch (error) {
      console.error("Error al cargar motores:", error);
    }
  };

  // --- LÓGICA DE FILTRADO Y ORDENAMIENTO ---
  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const clearFilters = () => {
    setFilters({ global: '', nroOrden: '', marca: '', modelo: '', hp: '', tipo: '' });
    setSortOrder('newest');
  };

  const applyFilters = () => {
    let result = [...motores];

    // 1. Filtrado Campo por Campo
    if (filters.nroOrden) {
      result = result.filter(m => m.nroOrden?.toString().includes(filters.nroOrden));
    }
    if (filters.marca) {
      result = result.filter(m => m.marca.toLowerCase().includes(filters.marca.toLowerCase()));
    }
    if (filters.modelo) {
      result = result.filter(m => m.modelo?.toLowerCase().includes(filters.modelo.toLowerCase()));
    }
    if (filters.hp) {
      result = result.filter(m => m.hp.toLowerCase().includes(filters.hp.toLowerCase()));
    }
    if (filters.tipo) {
      result = result.filter(m => m.tipo?.toLowerCase().includes(filters.tipo.toLowerCase()));
    }

    // 2. Ordenamiento
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      const idA = a.nroOrden || 0;
      const idB = b.nroOrden || 0;

      switch (sortOrder) {
        case 'newest': return dateB - dateA; // Más nuevos primero
        case 'oldest': return dateA - dateB; // Más viejos primero
        case 'id_desc': return idB - idA;    // ID más alto primero
        case 'id_asc': return idA - idB;     // ID más bajo primero
        default: return 0;
      }
    });

    setFilteredMotores(result);
  };

  // --- LÓGICA DE ELIMINACIÓN ---
  const clickDelete = (motor) => {
    setMotorToDelete(motor);
    setModalDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!motorToDelete) return;
    try {
      await api.delete(`/motores/${motorToDelete._id}`);
      const nuevosMotores = motores.filter(m => m._id !== motorToDelete._id);
      setMotores(nuevosMotores); // Esto disparará el useEffect de filtros y actualizará la tabla
      setModalDeleteOpen(false);
      setMotorToDelete(null);
    } catch (error) {
      alert("Error al eliminar: " + error.message);
      setModalDeleteOpen(false);
    }
  };

  // --- ESTILOS ---
  const thStyle = { textAlign: 'left', padding: '16px', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' };
  const tdStyle = { padding: '16px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: '0.9rem', verticalAlign: 'middle' };
  const inputSearchStyle = { padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' };
  const labelSearchStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '5px', textTransform: 'uppercase' };

  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', color: '#0f172a', margin: 0 }}>Inventario de Motores</h2>
          <p style={{ color: '#64748b', marginTop: '5px', fontSize: '0.9rem' }}>Gestión de fichas técnicas y equipos</p>
        </div>
        <Link to="/sistema/motores/nuevo" className="btn btn-primary" style={{ background: '#0f172a', color: 'white', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem' }}>
          + NUEVA FICHA
        </Link>
      </div>

      {/* --- PANEL DE BÚSQUEDA AVANZADA --- */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '25px' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#334155', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filtros de Búsqueda</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', alignItems: 'end' }}>
          
          <div>
            <label style={labelSearchStyle}>N° Ficha</label>
            <input name="nroOrden" value={filters.nroOrden} onChange={handleFilterChange} placeholder="Ej: 5" style={inputSearchStyle} />
          </div>

          <div>
            <label style={labelSearchStyle}>Marca</label>
            <input name="marca" value={filters.marca} onChange={handleFilterChange} placeholder="Ej: Siemens" style={inputSearchStyle} />
          </div>

          <div>
            <label style={labelSearchStyle}>Modelo</label>
            <input name="modelo" value={filters.modelo} onChange={handleFilterChange} placeholder="Modelo..." style={inputSearchStyle} />
          </div>

          <div>
            <label style={labelSearchStyle}>Potencia (HP)</label>
            <input name="hp" value={filters.hp} onChange={handleFilterChange} placeholder="Ej: 5.5" style={inputSearchStyle} />
          </div>

          <div>
            <label style={labelSearchStyle}>Tipo</label>
            <input name="tipo" value={filters.tipo} onChange={handleFilterChange} placeholder="Ej: Trifásico" style={inputSearchStyle} />
          </div>

          <div>
            <label style={labelSearchStyle}>Ordenar Por</label>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={inputSearchStyle}>
              <option value="newest">Más Nuevos Agregados</option>
              <option value="oldest">Más Antiguos</option>
              <option value="id_desc">ID más alto</option>
              <option value="id_asc">ID más bajo</option>
            </select>
          </div>

        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={clearFilters} style={{ padding: '8px 16px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#475569', fontWeight: '600' }}>
            Limpiar Filtros
          </button>
          <button onClick={applyFilters} style={{ padding: '8px 20px', background: '#0284c7', border: 'none', borderRadius: '6px', cursor: 'pointer', color: 'white', fontWeight: '600' }}>
            Buscar
          </button>
        </div>
      </div>

      {/* --- TABLA DE RESULTADOS --- */}
      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{...thStyle, width: '60px'}}>N°</th>
              <th style={thStyle}>Marca / Modelo</th>
              <th style={thStyle}>Potencia</th>
              <th style={thStyle}>Tipo</th>
              <th style={{...thStyle, textAlign: 'right'}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredMotores.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>
                  {motores.length === 0 ? "No hay fichas registradas." : "No se encontraron resultados con estos filtros."}
                </td>
              </tr>
            ) : (
              filteredMotores.map((motor) => {
                const linkId = motor.nroOrden ? motor.nroOrden : motor._id;
                return (
                  <tr key={motor._id} style={{ transition: 'background 0.1s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                    <td style={{...tdStyle, fontWeight: '700', color: '#0f172a'}}>
                      {motor.nroOrden ? `#${motor.nroOrden}` : '-'}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{motor.marca}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{motor.modelo || '-'}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ background: '#e2e8f0', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '500' }}>
                        {motor.hp}
                      </span>
                    </td>
                    <td style={tdStyle}>{motor.tipo || '-'}</td>
                    <td style={{...tdStyle, textAlign: 'right'}}>
                      <Link to={`/sistema/motores/ver/${linkId}`} style={{ fontWeight: '600', color: '#0284c7', marginRight: '15px', textDecoration: 'none', fontSize: '0.8rem' }}>VER</Link>
                      <Link to={`/sistema/motores/editar/${linkId}`} style={{ fontWeight: '600', color: '#475569', marginRight: '15px', textDecoration: 'none', fontSize: '0.8rem' }}>EDITAR</Link>
                      <button onClick={() => clickDelete(motor)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>ELIMINAR</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* Contador de Resultados */}
      <div style={{ marginTop: '10px', textAlign: 'right', color: '#64748b', fontSize: '0.85rem' }}>
        Mostrando {filteredMotores.length} de {motores.length} registros
      </div>

      <Modal 
        isOpen={modalDeleteOpen}
        type="danger"
        title="Eliminar Ficha Técnica"
        message={`¿Estás seguro de que deseas eliminar la ficha #${motorToDelete?.nroOrden}?`}
        onClose={() => setModalDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default Motores;