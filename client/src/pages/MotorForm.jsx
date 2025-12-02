import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import { AuthContext } from '../context/AuthContext';

const MotorForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  
  const canEdit = user?.rol === 'super' || user?.rol === 'editor';
  const isViewMode = location.pathname.includes('/ver/');
  const isEditMode = id && !isViewMode;
  const isReadOnly = isViewMode || !canEdit;

  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState(null);

  // Estados fotos
  const [newImages, setNewImages] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);

  const safeStructure = {
    nroOrden: '', marca: '', modelo: '', hp: '', amperaje: '',
    tipo: '', capacitor: '', largoCarcasa: '', 
    diametroInterior: '', diametroExterior: '',
    observaciones: '', 
    arranque: { alambre: '', paso: '', vueltas: '', abertura: '' },
    trabajo: { alambre: '', paso: '', vueltas: '', abertura: '' },
    aislaciones: { alta: '', ancho: '', cantidad: '' },
    fotos: []
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
    if (isReadOnly) return;
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleImageChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImageFiles(prev => [...prev, ...filesArray]);
      const filesURL = filesArray.map(file => URL.createObjectURL(file));
      setNewImages(prev => [...prev, ...filesURL]);
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
      const formDataToSend = new FormData();
      formDataToSend.append('data', JSON.stringify(formData));
      imageFiles.forEach(file => { formDataToSend.append('imagenes', file); });
      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (isEditMode) await api.put(`/motores/${id}`, formDataToSend, config);
      else await api.post('/motores', formDataToSend, config);
      
      setModalOpen(false);
      navigate('/sistema/motores');
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
      setModalOpen(false);
    }
  };

  if (loading) return <div style={{padding:'40px', textAlign:'center'}}>Cargando...</div>;
  if (error) return <div style={{padding:'40px', textAlign:'center', color:'red'}}>{error}</div>;

  // --- ESTILOS VISUALES ---
  const sectionHeader = { borderBottom: '2px solid currentColor', paddingBottom: '8px', marginBottom: '20px', marginTop: '10px', fontSize: '1.1rem', fontWeight: '700', letterSpacing: '-0.5px', opacity: 0.9 };
  const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8 };
  
  // Input sin fondo fijo (deja que el CSS global decida)
  const inputStyle = { 
    width: '100%', padding: '12px', borderRadius: '6px', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '0.95rem',
    transition: 'all 0.2s', fontWeight: isReadOnly ? '500' : '400', cursor: isReadOnly ? 'default' : 'text', 
    pointerEvents: isReadOnly ? 'none' : 'auto' 
  };

  const cardTitleStyle = { fontSize: '0.85rem', textTransform: 'uppercase', marginTop: 0, fontWeight: '800', borderBottom: '1px solid', paddingBottom: '10px', textAlign: 'center', letterSpacing: '1px', borderColor: 'rgba(150,150,150,0.2)' };
  const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '60px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', margin: 0, fontWeight: '800' }}>
            {formData.nroOrden ? `FICHA #${formData.nroOrden}` : (isEditMode ? 'EDITAR FICHA' : 'NUEVA FICHA')}
          </h2>
          <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>{formData.marca} {formData.modelo}</span>
        </div>
        <Link to="/sistema/motores" className="btn btn-secondary">Volver</Link>
      </div>

      {/* CAMBIO AQUÍ: className="card" y borramos background:'white' */}
      <form onSubmit={handleSaveClick} className="card" style={{ padding: '40px' }}>
        
        <h3 style={sectionHeader}>1. Identificación del Equipo</h3>
        <div style={grid3}>
          <div><label style={labelStyle}>Marca *</label><input required readOnly={isReadOnly} name="marca" value={formData.marca || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Modelo</label><input readOnly={isReadOnly} name="modelo" value={formData.modelo || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Potencia *</label><input required readOnly={isReadOnly} name="hp" value={formData.hp || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Amperaje</label><input readOnly={isReadOnly} name="amperaje" value={formData.amperaje || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Capacitor</label><input readOnly={isReadOnly} name="capacitor" value={formData.capacitor || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Tipo</label><input readOnly={isReadOnly} name="tipo" value={formData.tipo || ''} onChange={handleChange} style={inputStyle} /></div>
        </div>

        <div style={grid3}>
          <div><label style={labelStyle}>Largo Carcasa</label><input readOnly={isReadOnly} name="largoCarcasa" value={formData.largoCarcasa || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Ø Interior</label><input readOnly={isReadOnly} name="diametroInterior" value={formData.diametroInterior || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Ø Exterior</label><input readOnly={isReadOnly} name="diametroExterior" value={formData.diametroExterior || ''} onChange={handleChange} style={inputStyle} /></div>
        </div>

        <h3 style={sectionHeader}>2. Datos de Bobinado</h3>
        <div className="grid-responsive-2" style={{ marginBottom: '40px' }}>
          
          <div style={{ padding: '20px', borderRadius: '8px', border:'1px solid rgba(150,150,150,0.2)' }}>
            <h4 style={cardTitleStyle}>Arranque</h4>
            <div style={{display:'grid', gap:'15px'}}>
              <div><label style={labelStyle}>Alambre</label><input readOnly={isReadOnly} name="arranque.alambre" value={formData.arranque?.alambre || ''} onChange={handleChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Paso</label><input readOnly={isReadOnly} name="arranque.paso" value={formData.arranque?.paso || ''} onChange={handleChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Vueltas</label><input readOnly={isReadOnly} name="arranque.vueltas" value={formData.arranque?.vueltas || ''} onChange={handleChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Abertura</label><input readOnly={isReadOnly} name="arranque.abertura" value={formData.arranque?.abertura || ''} onChange={handleChange} style={inputStyle} /></div>
            </div>
          </div>

          <div style={{ padding: '20px', borderRadius: '8px', border:'1px solid rgba(150,150,150,0.2)' }}>
            <h4 style={cardTitleStyle}>Trabajo</h4>
            <div style={{display:'grid', gap:'15px'}}>
              <div><label style={labelStyle}>Alambre</label><input readOnly={isReadOnly} name="trabajo.alambre" value={formData.trabajo?.alambre || ''} onChange={handleChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Paso</label><input readOnly={isReadOnly} name="trabajo.paso" value={formData.trabajo?.paso || ''} onChange={handleChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Vueltas</label><input readOnly={isReadOnly} name="trabajo.vueltas" value={formData.trabajo?.vueltas || ''} onChange={handleChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Abertura</label><input readOnly={isReadOnly} name="trabajo.abertura" value={formData.trabajo?.abertura || ''} onChange={handleChange} style={inputStyle} /></div>
            </div>
          </div>
        </div>

        <h3 style={sectionHeader}>3. Aislaciones</h3>
        <div style={grid3}>
           <div><label style={labelStyle}>Largo</label><input readOnly={isReadOnly} name="aislaciones.alta" value={formData.aislaciones?.alta || ''} onChange={handleChange} style={inputStyle} /></div>
           <div><label style={labelStyle}>Ancho</label><input readOnly={isReadOnly} name="aislaciones.ancho" value={formData.aislaciones?.ancho || ''} onChange={handleChange} style={inputStyle} /></div>
           <div><label style={labelStyle}>Cantidad</label><input readOnly={isReadOnly} name="aislaciones.cantidad" value={formData.aislaciones?.cantidad || ''} onChange={handleChange} style={inputStyle} /></div>
        </div>

        {/* FOTOS (Si las hay) */}
        <h3 style={sectionHeader}>4. Fotos</h3>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {formData.fotos?.map((fotoUrl, index) => (
                <div key={index} style={{ width: '100px', height: '100px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #555' }}>
                    <img src={fotoUrl} alt="Motor" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
            ))}
            {newImages.map((url, index) => (
                <div key={`new-${index}`} style={{ width: '100px', height: '100px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #38bdf8' }}>
                    <img src={url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                </div>
            ))}
            {!isReadOnly && (
                <label style={{ width: '100px', height: '100px', borderRadius: '8px', border: '2px dashed gray', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0.7 }}>
                    <span style={{ fontSize: '24px' }}>📷</span>
                    <input type="file" multiple accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </label>
            )}
        </div>

        <label style={labelStyle}>Observaciones</label>
        <textarea readOnly={isReadOnly} name="observaciones" value={formData.observaciones || ''} onChange={handleChange} rows="4" style={{...inputStyle, resize:'vertical'}} />

        {!isReadOnly && (
          <div style={{ marginTop: '40px', textAlign: 'right', borderTop:'1px solid rgba(150,150,150,0.2)', paddingTop:'20px' }}>
            <button type="submit" className="btn btn-primary">
              {isEditMode ? 'GUARDAR CAMBIOS' : 'CREAR FICHA'}
            </button>
          </div>
        )}

        {!isViewMode && !canEdit && (
           <div style={{ marginTop: '30px', padding: '15px', border: '1px solid #ef4444', borderRadius: '6px', textAlign: 'center', color: '#ef4444' }}>
             🚫 No tienes permisos para modificar fichas.
           </div>
        )}

      </form>

      <Modal 
        isOpen={modalOpen}
        title={isEditMode ? "Confirmar Edición" : "Confirmar Creación"}
        message={isEditMode ? "¿Guardar cambios?" : "¿Crear ficha?"}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmSave}
      />
    </div>
  );
};

export default MotorForm;