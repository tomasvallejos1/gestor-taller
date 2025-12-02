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

  const [filters, setFilters] = useState({
    nroMotor: '', marca: '', modelo: '', hp: '', tipo: ''
  });

  const [sortOrder, setSortOrder] = useState('newest');
  const [modalDeleteOpen, setModalDeleteOpen] = useState(false);
  const [motorToDelete, setMotorToDelete] = useState(null);

  useEffect(() => { cargarMotores(); }, []);
  useEffect(() => { applyFilters(); }, [motores, filters, sortOrder]);

  const cargarMotores = async () => {
    try {
      const res = await api.get('/motores');
      setMotores(res.data);
      setFilteredMotores(res.data);
    } catch (error) { console.error(error); }
  };

  const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });
  
  const clearFilters = () => {
    setFilters({ nroMotor: '', marca: '', modelo: '', hp: '', tipo: '' });
    setSortOrder('newest');
  };

  const applyFilters = () => {
    let result = [...motores];
    if (filters.nroMotor) result = result.filter(m => m.nroMotor?.toString().includes(filters.nroMotor));
    if (filters.marca) result = result.filter(m => m.marca.toLowerCase().includes(filters.marca.toLowerCase()));
    if (filters.modelo) result = result.filter(m => m.modelo?.toLowerCase().includes(filters.modelo.toLowerCase()));
    if (filters.hp) result = result.filter(m => m.hp.toLowerCase().includes(filters.hp.toLowerCase()));
    if (filters.tipo) result = result.filter(m => m.tipo?.toLowerCase().includes(filters.tipo.toLowerCase()));

    result.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      const idA = a.nroMotor || 0;
      const idB = b.nroMotor || 0;
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

  const clickDelete = (motor) => { setMotorToDelete(motor); setModalDeleteOpen(true); };
  
  const confirmDelete = async () => {
    if (!motorToDelete) return;
    try {
      await api.delete(`/motores/${motorToDelete._id}`);
      setMotores(motores.filter(m => m._id !== motorToDelete._id));
      setModalDeleteOpen(false);
    } catch (error) { alert(error.message); setModalDeleteOpen(false); }
  };

  // --- ESTILOS ---
  // Nota: Quitamos colores fijos para que el CSS controle el blanco/negro
  const thStyle = { textAlign: 'left', padding: '16px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '16px', fontSize: '1rem', verticalAlign: 'middle' }; // Aumenté fontSize a 1rem
  const inputSearchStyle = { padding: '8px 12px', borderRadius: '6px', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' };
  const labelSearchStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '5px', textTransform: 'uppercase' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Inventario</h2>
          <p style={{ marginTop: '5px', fontSize: '0.9rem', opacity: 0.8 }}>Gestión de equipos</p>
        </div>
        {canEdit && (
          <Link to="/sistema/motores/nuevo" className="btn btn-primary" style={{ padding: '10px 20px', borderRadius: '6px', textDecoration: 'none', fontWeight: '700', fontSize: '0.9rem' }}>
            + NUEVA FICHA
          </Link>
        )}
      </div>

      <div className="card" style={{ marginBottom: '25px', padding: '20px' }}>
        <h4 style={{ margin: '0 0 15px 0', fontSize: '0.9rem', textTransform: 'uppercase' }}>Filtros</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px', alignItems: 'end' }}>
          <div><label style={labelSearchStyle}>N° Ficha</label><input name="nroMotor" value={filters.nroMotor} onChange={handleFilterChange} placeholder="Ej: 5" style={inputSearchStyle} /></div>
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
          {/* BOTONES IGUALES (Secondary) */}
          <button onClick={clearFilters} className="btn btn-secondary" style={{fontWeight: '600'}}>Limpiar</button>
          <button onClick={applyFilters} className="btn btn-secondary" style={{fontWeight: '600', border: '1px solid currentColor'}}>Buscar</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                <tr><td colSpan="5" style={{ padding: '50px', textAlign: 'center', opacity: 0.6 }}>Sin resultados.</td></tr>
              ) : (
                filteredMotores.map((motor) => {
                  const linkId = motor.nroMotor ? motor.nroMotor : motor._id;
                  return (
                    <tr key={motor._id} style={{ transition: 'background 0.1s' }}>
                      <td style={{...tdStyle, fontWeight: '800'}}>
                        {motor.nroMotor ? `#${motor.nroMotor}` : '-'}
                      </td>
                      <td style={tdStyle}>
                        {/* Sin color fijo, tomará el blanco del CSS */}
                        <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{motor.marca}</div>
                        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>{motor.modelo || '-'}</div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontWeight: '700', border: '1px solid currentColor', opacity: 0.9 }}>
                          {motor.hp}
                        </span>
                      </td>
                      <td style={tdStyle}>{motor.tipo || '-'}</td>
                      <td style={{...tdStyle, textAlign: 'right'}}>
                        <Link to={`/sistema/motores/ver/${linkId}`} style={{ fontWeight: '700', marginRight: '15px', textDecoration: 'none', fontSize: '0.85rem' }}>VER</Link>
                        {canEdit && (
                          <>
                            <Link to={`/sistema/motores/editar/${linkId}`} style={{ fontWeight: '700', marginRight: '15px', textDecoration: 'none', fontSize: '0.85rem' }}>EDITAR</Link>
                            <button onClick={() => clickDelete(motor)} style={{ background: 'none', border: 'none', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>ELIMINAR</button>
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
      
      <div style={{ marginTop: '10px', textAlign: 'right', fontSize: '0.85rem', opacity: 0.7 }}>
        Mostrando {filteredMotores.length} registros
      </div>

      <Modal isOpen={modalDeleteOpen} type="danger" title="Eliminar Ficha" message={`¿Borrar ficha #${motorToDelete?.nroMotor}?`} onClose={() => setModalDeleteOpen(false)} onConfirm={confirmDelete} />
    </div>
  );
};

export default Motores;