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
  const [loading, setLoading] = useState(!!id); // Empieza cargando solo si hay ID
  const [error, setError] = useState(null);

  // ESTADO INICIAL SEGURO (Previene fallos por datos undefined)
  const emptyForm = {
    nroOrden: '', 
    marca: '', modelo: '', hp: '', amperaje: '',
    tipo: '', capacitor: '', largoCarcasa: '', 
    diametroInterior: '', diametroExterior: '',
    observaciones: '', 
    arranque: { alambre: '', paso: '', vueltas: '', abertura: '' },
    trabajo: { alambre: '', paso: '', vueltas: '', abertura: '' },
    aislaciones: { alta: '', ancho: '', cantidad: '' }
  };

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (id) {
      const cargarDatos = async () => {
        try {
          // El controller nuevo acepta tanto "1" como "64a..."
          const res = await api.get(`/motores/${id}`);
          
          if (!res.data) throw new Error("Datos vacíos");

          // FUSIONAMOS con el estado vacío para garantizar que existan los objetos anidados
          setFormData(prev => ({
            ...emptyForm, // Base segura
            ...res.data,  // Datos del servidor
            // Aseguramos sub-objetos manualmente por si vienen null
            arranque: { ...emptyForm.arranque, ...(res.data.arranque || {}) },
            trabajo: { ...emptyForm.trabajo, ...(res.data.trabajo || {}) },
            aislaciones: { ...emptyForm.aislaciones, ...(res.data.aislaciones || {}) }
          }));

        } catch (err) {
          console.error("Error cargando:", err);
          setError("No se pudo cargar la ficha. El motor no existe o hubo un error de red.");
        } finally {
          setLoading(false);
        }
      };
      cargarDatos();
    }
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({ 
        ...prev, 
        [parent]: { ...prev[parent], [child]: value } 
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveClick = (e) => { e.preventDefault(); setModalOpen(true); };

  const confirmSave = async () => {
    try {
      if (isEditMode) await api.put(`/motores/${id}`, formData);
      else await api.post('/motores', formData);
      setModalOpen(false);
      navigate('/sistema/motores');
    } catch (err) {
      alert('Error: ' + err.message);
      setModalOpen(false);
    }
  };

  // --- RENDERIZADO DE CARGA Y ERROR ---
  if (loading) return (
    <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'50vh', flexDirection:'column'}}>
      <div style={{fontSize:'1.2rem', color:'#0f172a', fontWeight:'bold'}}>Cargando ficha...</div>
    </div>
  );

  if (error) return (
    <div style={{padding:'40px', textAlign:'center', color:'#ef4444'}}>
      <h3>⚠️ Ocurrió un error</h3>
      <p>{error}</p>
      <Link to="/sistema/motores" className="btn btn-secondary">Volver al listado</Link>
    </div>
  );

  // --- ESTILOS ---
  const sectionHeader = { borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px', marginTop: '10px', color: '#0f172a', fontSize: '1rem', fontWeight: '700' };
  const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' };
  const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: isViewMode ? '#f1f5f9' : 'white', boxSizing: 'border-box' };
  const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '60px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', color: '#0f172a', margin: 0 }}>
            {formData.nroOrden ? `FICHA N° ${formData.nroOrden}` : (isEditMode ? 'EDITAR' : 'NUEVA FICHA')}
          </h2>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {formData.marca || 'Sin Marca'} {formData.modelo}
          </span>
        </div>
        <Link to="/sistema/motores" className="btn btn-secondary" style={{textDecoration:'none', color:'#0f172a', border:'1px solid #ccc', padding:'8px 16px', borderRadius:'6px'}}>
          Volver
        </Link>
      </div>

      <form onSubmit={handleSaveClick} style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        
        {/* Usamos el operador ?. (Optional Chaining) para máxima seguridad */}

        <h3 style={sectionHeader}>Datos Generales</h3>
        <div style={grid3}>
          <div><label style={labelStyle}>Marca *</label><input required disabled={isViewMode} name="marca" value={formData.marca || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Modelo</label><input disabled={isViewMode} name="modelo" value={formData.modelo || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>HP *</label><input required disabled={isViewMode} name="hp" value={formData.hp || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Amperaje</label><input disabled={isViewMode} name="amperaje" value={formData.amperaje || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Capacitor</label><input disabled={isViewMode} name="capacitor" value={formData.capacitor || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Tipo</label><input disabled={isViewMode} name="tipo" value={formData.tipo || ''} onChange={handleChange} style={inputStyle} /></div>
        </div>

        <div style={grid3}>
          <div><label style={labelStyle}>Largo Carcasa</label><input disabled={isViewMode} name="largoCarcasa" value={formData.largoCarcasa || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Ø Interior</label><input disabled={isViewMode} name="diametroInterior" value={formData.diametroInterior || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Ø Exterior</label><input disabled={isViewMode} name="diametroExterior" value={formData.diametroExterior || ''} onChange={handleChange} style={inputStyle} /></div>
        </div>

        <h3 style={sectionHeader}>Bobinados</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {/* ARRANQUE */}
          <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '0.85rem', color: '#64748b', textTransform:'uppercase', marginTop:0 }}>Arranque</h4>
            <div style={{display:'grid', gap:'10px'}}>
              <div><label style={labelStyle}>Alambre</label><input disabled={isViewMode} name="arranque.alambre" value={formData.arranque?.alambre || ''} onChange={handleChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Paso</label><input disabled={isViewMode} name="arranque.paso" value={formData.arranque?.paso || ''} onChange={handleChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Vueltas</label><input disabled={isViewMode} name="arranque.vueltas" value={formData.arranque?.vueltas || ''} onChange={handleChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Abertura</label><input disabled={isViewMode} name="arranque.abertura" value={formData.arranque?.abertura || ''} onChange={handleChange} style={inputStyle} /></div>
            </div>
          </div>
          {/* TRABAJO */}
          <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '0.85rem', color: '#64748b', textTransform:'uppercase', marginTop:0 }}>Trabajo</h4>
            <div style={{display:'grid', gap:'10px'}}>
              <div><label style={labelStyle}>Alambre</label><input disabled={isViewMode} name="trabajo.alambre" value={formData.trabajo?.alambre || ''} onChange={handleChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Paso</label><input disabled={isViewMode} name="trabajo.paso" value={formData.trabajo?.paso || ''} onChange={handleChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Vueltas</label><input disabled={isViewMode} name="trabajo.vueltas" value={formData.trabajo?.vueltas || ''} onChange={handleChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Abertura</label><input disabled={isViewMode} name="trabajo.abertura" value={formData.trabajo?.abertura || ''} onChange={handleChange} style={inputStyle} /></div>
            </div>
          </div>
        </div>

        <h3 style={sectionHeader}>Detalles Finales</h3>
        <div style={grid3}>
           <div><label style={labelStyle}>Aislación Alta</label><input disabled={isViewMode} name="aislaciones.alta" value={formData.aislaciones?.alta || ''} onChange={handleChange} style={inputStyle} /></div>
           <div><label style={labelStyle}>Ancho</label><input disabled={isViewMode} name="aislaciones.ancho" value={formData.aislaciones?.ancho || ''} onChange={handleChange} style={inputStyle} /></div>
           <div><label style={labelStyle}>Cantidad</label><input disabled={isViewMode} name="aislaciones.cantidad" value={formData.aislaciones?.cantidad || ''} onChange={handleChange} style={inputStyle} /></div>
        </div>

        <label style={labelStyle}>Observaciones</label>
        <textarea disabled={isViewMode} name="observaciones" value={formData.observaciones || ''} onChange={handleChange} rows="3" style={{...inputStyle, resize:'vertical'}} />

        {!isViewMode && (
          <div style={{ marginTop: '30px', textAlign: 'right' }}>
            <button type="submit" className="btn btn-primary" style={{ background: '#0f172a', color: 'white', padding: '12px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
              {isEditMode ? 'Guardar Cambios' : 'Crear Ficha'}
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