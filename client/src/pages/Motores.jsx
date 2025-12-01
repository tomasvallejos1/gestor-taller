import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import { AuthContext } from '../context/AuthContext';

const Motores = () => {
  const { user } = useContext(AuthContext);
  const canEdit = user?.rol === 'super' || user?.rol === 'editor';

  const [motores, setMotores] = useState([]);
  const [filteredMotores, setFilteredMotores] = useState([]);

  // Estados de Filtros
  const [filters, setFilters] = useState({
    nroOrden: '',
    marca: '',
    modelo: '',
    hp: '',
    tipo: ''
  });

  const [sortOrder, setSortOrder] = useState('newest');

  // Estados Modal
  const [modalDeleteOpen, setModalDeleteOpen] = useState(false);
  const [motorToDelete, setMotorToDelete] = useState(null);

  useEffect(() => {
    cargarMotores();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [motores, filters, sortOrder]);

  const cargarMotores = async () => {
    try {
      const respuesta = await api.get('/motores');
      setMotores(respuesta.data);
      setFilteredMotores(respuesta.data);
    } catch (error) {
      console.error("Error al cargar motores:", error);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const clearFilters = () => {
    setFilters({ nroOrden: '', marca: '', modelo: '', hp: '', tipo: '' });
    setSortOrder('newest');
  };

  const applyFilters = () => {
    let result = [...motores];

    if (filters.nroOrden) result = result.filter(m => m.nroOrden?.toString().includes(filters.nroOrden));
    if (filters.marca) result = result.filter(m => m.marca.toLowerCase().includes(filters.marca.toLowerCase()));
    if (filters.modelo) result = result.filter(m => m.modelo?.toLowerCase().includes(filters.modelo.toLowerCase()));
    if (filters.hp) result = result.filter(m => m.hp.toLowerCase().includes(filters.hp.toLowerCase()));
    if (filters.tipo) result = result.filter(m => m.tipo?.toLowerCase().includes(filters.tipo.toLowerCase()));

    result.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      const idA = a.nroOrden || 0;
      const idB = b.nroOrden || 0;

      switch (sortOrder) {
        case 'newest': return dateB - dateA;
        case 'oldest': return dateA - dateB;
        case 'id_desc': return idB - idA;
        case 'id_asc': return idA - idB;
        default: return 0;
      }
    });

    setFilteredMotores(result);
  };

  const clickDelete = (motor) => {
    setMotorToDelete(motor);
    setModalDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!motorToDelete) return;
    try {
      await api.delete(`/motores/${motorToDelete._id}`);
      const nuevosMotores = motores.filter(m => m._id !== motorToDelete._id);
      setMotores(nuevosMotores);
      setModalDeleteOpen(false);
      setMotorToDelete(null);
    } catch (error) {
      alert("Error al eliminar: " + error.message);
      setModalDeleteOpen(false);
    }
  };

  // --- ESTILOS ---
  const thStyle = { textAlign: 'left', padding: '16px', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '16px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: '0.9rem', verticalAlign: 'middle' };
  const inputSearchStyle = { padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' };
  const labelSearchStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '5px', textTransform: 'uppercase' };

  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', color: '#0f172a', margin: 0 }}>Inventario de Motores</h2>
          <p style={{ color: '#64748b', marginTop: '5px', fontSize: '0.9rem' }}>Gestión de fichas técnicas y equipos</p>
        </div>
        
        {/* SOLO MOSTRAR SI TIENE PERMISO DE EDICIÓN */}
        {canEdit && (
          <Link to="/sistema/motores/nuevo" className="btn btn-primary" style={{ background: '#0f172a', color: 'white', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem' }}>
            + NUEVA FICHA
          </Link>
        )}
      </div>

      {/* --- PANEL DE BÚSQUEDA --- */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '25px' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#334155', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filtros</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px', alignItems: 'end' }}>
          
          <div><label style={labelSearchStyle}>N° Ficha</label><input name="nroOrden" value={filters.nroOrden} onChange={handleFilterChange} placeholder="Ej: 5" style={inputSearchStyle} /></div>
          <div><label style={labelSearchStyle}>Marca</label><input name="marca" value={filters.marca} onChange={handleFilterChange} placeholder="Ej: Siemens" style={inputSearchStyle} /></div>
          <div><label style={labelSearchStyle}>Modelo</label><input name="modelo" value={filters.modelo} onChange={handleFilterChange} placeholder="Modelo..." style={inputSearchStyle} /></div>
          <div><label style={labelSearchStyle}>Potencia</label><input name="hp" value={filters.hp} onChange={handleFilterChange} placeholder="Ej: 5.5" style={inputSearchStyle} /></div>
          <div><label style={labelSearchStyle}>Tipo</label><input name="tipo" value={filters.tipo} onChange={handleFilterChange} placeholder="Ej: Trifásico" style={inputSearchStyle} /></div>
          
          <div>
            <label style={labelSearchStyle}>Ordenar</label>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={inputSearchStyle}>
              <option value="newest">Más Nuevos</option>
              <option value="oldest">Más Antiguos</option>
              <option value="id_desc">ID más alto</option>
              <option value="id_asc">ID más bajo</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={clearFilters} className="btn" style={{ padding: '8px 16px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#475569', fontWeight: '600' }}>
            Limpiar
          </button>
          <button onClick={applyFilters} className="btn" style={{ padding: '8px 20px', background: '#0284c7', border: 'none', borderRadius: '6px', cursor: 'pointer', color: 'white', fontWeight: '600' }}>
            Buscar
          </button>
        </div>
      </div>

      {/* --- TABLA DE RESULTADOS --- */}
      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <div className="table-responsive">
          <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{...thStyle, width: '50px'}}>N°</th>
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
                    {motores.length === 0 ? "No hay fichas registradas." : "No se encontraron resultados."}
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
                        {/* SIEMPRE VISIBLE */}
                        <Link to={`/sistema/motores/ver/${linkId}`} style={{ fontWeight: '600', color: '#0284c7', marginRight: '15px', textDecoration: 'none', fontSize: '0.8rem' }}>VER</Link>
                        
                        {/* SOLO VISIBLE SI TIENE PERMISO */}
                        {canEdit && (
                          <>
                            <Link to={`/sistema/motores/editar/${linkId}`} style={{ fontWeight: '600', color: '#475569', marginRight: '15px', textDecoration: 'none', fontSize: '0.8rem' }}>EDITAR</Link>
                            <button onClick={() => clickDelete(motor)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>ELIMINAR</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div style={{ marginTop: '10px', textAlign: 'right', color: '#64748b', fontSize: '0.85rem' }}>
        Mostrando {filteredMotores.length} registros
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