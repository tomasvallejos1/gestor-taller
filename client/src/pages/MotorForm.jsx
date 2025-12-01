import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';

const MotorForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  
  const isViewMode = location.pathname.includes('/ver/');
  const isEditMode = id && !isViewMode;

  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState(null);

  // ESTRUCTURA SEGURA
  const safeStructure = {
    nroOrden: '', marca: '', modelo: '', hp: '', amperaje: '',
    tipo: '', capacitor: '', largoCarcasa: '', 
    diametroInterior: '', diametroExterior: '',
    observaciones: '', 
    arranque: { alambre: '', paso: '', vueltas: '', abertura: '' },
    trabajo: { alambre: '', paso: '', vueltas: '', abertura: '' },
    aislaciones: { alta: '', ancho: '', cantidad: '' }
  };

  const [formData, setFormData] = useState(safeStructure);

  useEffect(() => {
    if (id) {
      const cargarDatos = async () => {
        try {
          const res = await api.get(`/motores/${id}`);
          const data = res.data;
          if (!data) throw new Error("Sin datos");

          setFormData({
            ...safeStructure,
            ...data,
            arranque: data.arranque || safeStructure.arranque,
            trabajo: data.trabajo || safeStructure.trabajo,
            aislaciones: data.aislaciones || safeStructure.aislaciones
          });
        } catch (err) {
          console.error(err);
          setError("No se pudo cargar la ficha.");
        } finally {
          setLoading(false);
        }
      };
      cargarDatos();
    }
  }, [id]);

  const handleChange = (e) => {
    if (isViewMode) return;
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveClick = (e) => {
    e.preventDefault();
    if (!formData.marca?.trim() || !formData.hp?.trim()) {
      alert("⚠️ Faltan Marca o Potencia.");
      return;
    }
    setModalOpen(true);
  };

  const confirmSave = async () => {
    try {
      if (isEditMode) await api.put(`/motores/${id}`, formData);
      else await api.post('/motores', formData);
      setModalOpen(false);
      navigate('/sistema/motores');
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
      setModalOpen(false);
    }
  };

  if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#64748b'}}>Cargando...</div>;
  if (error) return <div style={{padding:'40px', textAlign:'center', color:'#ef4444'}}>{error}</div>;

  // --- ESTILOS ---
  const sectionHeader = { 
    borderBottom: '2px solid #e2e8f0', 
    paddingBottom: '8px', 
    marginBottom: '20px', 
    marginTop: '10px', 
    color: '#0f172a', 
    fontSize: '1.1rem', 
    fontWeight: '700',
    letterSpacing: '-0.5px'
  };

  const labelStyle = { 
    display: 'block', 
    marginBottom: '6px', 
    fontWeight: '600', 
    fontSize: '0.75rem', 
    color: '#64748b', 
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  const inputStyle = { 
    width: '100%', 
    padding: '12px', 
    borderRadius: '6px', 
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    fontSize: '0.95rem',
    transition: 'all 0.2s',
    border: isViewMode ? '1px solid #f1f5f9' : '1px solid #cbd5e1', 
    background: '#ffffff', 
    color: isViewMode ? '#1e293b' : '#0f172a', 
    fontWeight: isViewMode ? '500' : '400', 
    cursor: isViewMode ? 'default' : 'text', 
    pointerEvents: isViewMode ? 'none' : 'auto' 
  };

  // Estilo específico para los títulos de las tarjetas (Centrados)
  const cardTitleStyle = {
    fontSize: '0.85rem', 
    color: '#334155', 
    textTransform: 'uppercase', 
    marginTop: 0, 
    fontWeight: '800', 
    borderBottom: '1px solid #e2e8f0', 
    paddingBottom: '10px',
    textAlign: 'center', // <--- CENTRADO
    letterSpacing: '1px'
  };

  const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' };
  const cardStyle = { background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 20px -5px rgba(0, 0, 0, 0.05)' };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '60px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', color: '#0f172a', margin: 0, fontWeight: '800' }}>
            {formData.nroOrden ? `FICHA TÉCNICA #${formData.nroOrden}` : (isEditMode ? 'EDITAR FICHA' : 'NUEVA FICHA')}
          </h2>
          <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
            {formData.marca} {formData.modelo}
          </span>
        </div>
        <Link to="/sistema/motores" className="btn btn-secondary" style={{textDecoration:'none', color:'#0f172a', border:'1px solid #cbd5e1', padding:'8px 16px', borderRadius:'6px', background:'white'}}>
          Volver
        </Link>
      </div>

      <form onSubmit={handleSaveClick} style={cardStyle}>
        
        <h3 style={sectionHeader}>1. Identificación del Equipo</h3>
        <div style={grid3}>
          <div><label style={labelStyle}>Marca *</label><input required readOnly={isViewMode} name="marca" value={formData.marca || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Modelo</label><input readOnly={isViewMode} name="modelo" value={formData.modelo || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Potencia (HP) *</label><input required readOnly={isViewMode} name="hp" value={formData.hp || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Amperaje</label><input readOnly={isViewMode} name="amperaje" value={formData.amperaje || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Capacitor</label><input readOnly={isViewMode} name="capacitor" value={formData.capacitor || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Tipo</label><input readOnly={isViewMode} name="tipo" value={formData.tipo || ''} onChange={handleChange} style={inputStyle} /></div>
        </div>

        <div style={grid3}>
          <div><label style={labelStyle}>Largo Carcasa</label><input readOnly={isViewMode} name="largoCarcasa" value={formData.largoCarcasa || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Ø Interior</label><input readOnly={isViewMode} name="diametroInterior" value={formData.diametroInterior || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Ø Exterior</label><input readOnly={isViewMode} name="diametroExterior" value={formData.diametroExterior || ''} onChange={handleChange} style={inputStyle} /></div>
        </div>

        <h3 style={sectionHeader}>2. Datos de Bobinado</h3>
        <div className="grid-responsive">
          
          {/* Tarjeta Arranque */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border:'1px solid #e2e8f0' }}>
            <h4 style={cardTitleStyle}>Arranque</h4>
            <div style={{display:'grid', gap:'15px'}}>
              <div><label style={labelStyle}>Alambre</label><input readOnly={isViewMode} name="arranque.alambre" value={formData.arranque?.alambre || ''} onChange={handleChange} style={{...inputStyle, background:'white'}} /></div>
              <div><label style={labelStyle}>Paso</label><input readOnly={isViewMode} name="arranque.paso" value={formData.arranque?.paso || ''} onChange={handleChange} style={{...inputStyle, background:'white'}} /></div>
              <div><label style={labelStyle}>Vueltas</label><input readOnly={isViewMode} name="arranque.vueltas" value={formData.arranque?.vueltas || ''} onChange={handleChange} style={{...inputStyle, background:'white'}} /></div>
              <div><label style={labelStyle}>Abertura</label><input readOnly={isViewMode} name="arranque.abertura" value={formData.arranque?.abertura || ''} onChange={handleChange} style={{...inputStyle, background:'white'}} /></div>
            </div>
          </div>

          {/* Tarjeta Trabajo */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border:'1px solid #e2e8f0' }}>
            <h4 style={cardTitleStyle}>Trabajo</h4>
            <div style={{display:'grid', gap:'15px'}}>
              <div><label style={labelStyle}>Alambre</label><input readOnly={isViewMode} name="trabajo.alambre" value={formData.trabajo?.alambre || ''} onChange={handleChange} style={{...inputStyle, background:'white'}} /></div>
              <div><label style={labelStyle}>Paso</label><input readOnly={isViewMode} name="trabajo.paso" value={formData.trabajo?.paso || ''} onChange={handleChange} style={{...inputStyle, background:'white'}} /></div>
              <div><label style={labelStyle}>Vueltas</label><input readOnly={isViewMode} name="trabajo.vueltas" value={formData.trabajo?.vueltas || ''} onChange={handleChange} style={{...inputStyle, background:'white'}} /></div>
              <div><label style={labelStyle}>Abertura</label><input readOnly={isViewMode} name="trabajo.abertura" value={formData.trabajo?.abertura || ''} onChange={handleChange} style={{...inputStyle, background:'white'}} /></div>
            </div>
          </div>
        </div>

        <h3 style={sectionHeader}>3. Aislaciones y Detalles</h3>
        <div style={grid3}>
           {/* CAMBIO AQUI: Label cambiado a 'Largo' */}
           <div><label style={labelStyle}>Largo</label><input readOnly={isViewMode} name="aislaciones.alta" value={formData.aislaciones?.alta || ''} onChange={handleChange} style={inputStyle} /></div>
           
           <div><label style={labelStyle}>Ancho</label><input readOnly={isViewMode} name="aislaciones.ancho" value={formData.aislaciones?.ancho || ''} onChange={handleChange} style={inputStyle} /></div>
           <div><label style={labelStyle}>Cantidad</label><input readOnly={isViewMode} name="aislaciones.cantidad" value={formData.aislaciones?.cantidad || ''} onChange={handleChange} style={inputStyle} /></div>
        </div>

        <label style={labelStyle}>Observaciones</label>
        <textarea readOnly={isViewMode} name="observaciones" value={formData.observaciones || ''} onChange={handleChange} rows="4" style={{...inputStyle, resize:'vertical'}} />

        {!isViewMode && (
          <div style={{ marginTop: '40px', textAlign: 'right', borderTop:'1px solid #e2e8f0', paddingTop:'20px' }}>
            <button type="submit" className="btn btn-primary" style={{ background: '#0f172a', color: 'white', padding: '12px 30px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight:'600' }}>
              {isEditMode ? 'GUARDAR CAMBIOS' : 'CREAR FICHA'}
            </button>
          </div>
        )}

      </form>

      <Modal 
        isOpen={modalOpen}
        title={isEditMode ? "Confirmar Edición" : "Confirmar Creación"}
        message={isEditMode ? "¿Guardar cambios en esta ficha?" : "¿Crear nueva ficha de motor?"}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmSave}
      />
    </div>
  );
};

export default MotorForm;