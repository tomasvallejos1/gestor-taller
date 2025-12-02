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
  const [loading, setLoading] = useState(!!id); // Carga inicial de datos
  const [isSaving, setIsSaving] = useState(false); // <--- NUEVO: Carga al guardar
  const [error, setError] = useState(null);

  // Estados fotos
  const [newImages, setNewImages] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  
  // Lightbox
  const [selectedImage, setSelectedImage] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState('center center');

  const safeStructure = {
    nroMotor: '', marca: '', modelo: '', hp: '', amperaje: '',
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

  // --- FUNCIÓN DE GUARDADO BLINDADA ---
  const confirmSave = async () => {
    if (isSaving) return; // Si ya está guardando, ignorar clics extra

    setIsSaving(true); // Bloquear botón inmediatamente

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
      setModalOpen(false); // Solo cerramos modal si hubo error
    } finally {
      setIsSaving(false); // Desbloquear al final
    }
  };

  // --- LIGHTBOX LOGIC ---
  const handleImageClick = (e) => {
    e.stopPropagation();
    if (isZoomed) {
      setIsZoomed(false);
    } else {
      const { left, top, width, height } = e.target.getBoundingClientRect();
      const x = ((e.clientX - left) / width) * 100;
      const y = ((e.clientY - top) / height) * 100;
      setZoomOrigin(`${x}% ${y}%`);
      setIsZoomed(true);
    }
  };

  const closeLightbox = () => {
    setSelectedImage(null);
    setIsZoomed(false);
  };

  if (loading) return <div style={{padding:'40px', textAlign:'center'}}>Cargando...</div>;
  if (error) return <div style={{padding:'40px', textAlign:'center', color:'#ef4444'}}>{error}</div>;

  // --- ESTILOS ---
  const sectionHeader = { borderLeft: '4px solid #38bdf8', paddingLeft: '15px', marginBottom: '25px', marginTop: '10px', fontSize: '1.2rem', fontWeight: '800', letterSpacing: '-0.5px', color: 'var(--text-main)' };
  const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: '700', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.7 };
  const inputStyle = { width: '100%', padding: '12px 15px', borderRadius: '8px', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '1rem', transition: 'all 0.2s', border: isReadOnly ? '1px solid transparent' : '1px solid #cbd5e1', background: isReadOnly ? 'rgba(100,100,100,0.05)' : '#ffffff', color: 'inherit', fontWeight: isReadOnly ? '600' : '400', cursor: isReadOnly ? 'default' : 'text', pointerEvents: isReadOnly ? 'none' : 'auto' };
  const subCardStyle = { padding: '25px', borderRadius: '12px', border:'1px solid rgba(150,150,150,0.2)', background: 'rgba(56, 189, 248, 0.03)' };
  const cardTitleStyle = { fontSize: '0.9rem', textTransform: 'uppercase', marginTop: 0, fontWeight: '900', borderBottom: '2px solid rgba(56, 189, 248, 0.2)', paddingBottom: '15px', textAlign: 'center', letterSpacing: '1px', marginBottom: '20px', color: '#38bdf8' };
  const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '60px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: '#38bdf8', color: '#0f172a', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '800' }}>
            {formData.nroMotor || '+'}
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0, fontWeight: '800', lineHeight: '1.1' }}>
              {isEditMode ? 'EDITAR MOTOR' : (formData.nroMotor ? 'FICHA TÉCNICA' : 'NUEVO INGRESO')}
            </h2>
            <span style={{ fontSize: '0.9rem', opacity: 0.7, fontWeight: '500' }}>
              {formData.marca || 'Marca'} • {formData.modelo || 'Modelo'}
            </span>
          </div>
        </div>
        <Link to="/sistema/motores" className="btn btn-secondary" style={{fontWeight: '600'}}>
          ← Volver
        </Link>
      </div>

      <form onSubmit={handleSaveClick} className="card" style={{ padding: '40px' }}>
        
        <h3 style={sectionHeader}>Identificación del Equipo</h3>
        <div style={grid3}>
          <div><label style={labelStyle}>Marca</label><input required readOnly={isReadOnly} name="marca" value={formData.marca || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Modelo</label><input readOnly={isReadOnly} name="modelo" value={formData.modelo || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Potencia (HP)</label><input required readOnly={isReadOnly} name="hp" value={formData.hp || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Amperaje</label><input readOnly={isReadOnly} name="amperaje" value={formData.amperaje || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Capacitor</label><input readOnly={isReadOnly} name="capacitor" value={formData.capacitor || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Tipo</label><input readOnly={isReadOnly} name="tipo" value={formData.tipo || ''} onChange={handleChange} style={inputStyle} /></div>
        </div>

        <div style={grid3}>
          <div><label style={labelStyle}>Largo Carcasa</label><input readOnly={isReadOnly} name="largoCarcasa" value={formData.largoCarcasa || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Ø Interior</label><input readOnly={isReadOnly} name="diametroInterior" value={formData.diametroInterior || ''} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={labelStyle}>Ø Exterior</label><input readOnly={isReadOnly} name="diametroExterior" value={formData.diametroExterior || ''} onChange={handleChange} style={inputStyle} /></div>
        </div>

        <h3 style={sectionHeader}>Datos de Bobinado</h3>
        <div className="grid-responsive-2" style={{ marginBottom: '40px' }}>
          <div style={subCardStyle}>
            <h4 style={cardTitleStyle}>ARRANQUE</h4>
            <div style={{display:'grid', gap:'15px'}}>
              <div><label style={labelStyle}>Alambre</label><input readOnly={isReadOnly} name="arranque.alambre" value={formData.arranque?.alambre || ''} onChange={handleChange} style={{...inputStyle, background: 'var(--bg-app)'}} /></div>
              <div><label style={labelStyle}>Paso</label><input readOnly={isReadOnly} name="arranque.paso" value={formData.arranque?.paso || ''} onChange={handleChange} style={{...inputStyle, background: 'var(--bg-app)'}} /></div>
              <div><label style={labelStyle}>Vueltas</label><input readOnly={isReadOnly} name="arranque.vueltas" value={formData.arranque?.vueltas || ''} onChange={handleChange} style={{...inputStyle, background: 'var(--bg-app)'}} /></div>
              <div><label style={labelStyle}>Abertura</label><input readOnly={isReadOnly} name="arranque.abertura" value={formData.arranque?.abertura || ''} onChange={handleChange} style={{...inputStyle, background: 'var(--bg-app)'}} /></div>
            </div>
          </div>
          <div style={subCardStyle}>
            <h4 style={cardTitleStyle}>TRABAJO</h4>
            <div style={{display:'grid', gap:'15px'}}>
              <div><label style={labelStyle}>Alambre</label><input readOnly={isReadOnly} name="trabajo.alambre" value={formData.trabajo?.alambre || ''} onChange={handleChange} style={{...inputStyle, background: 'var(--bg-app)'}} /></div>
              <div><label style={labelStyle}>Paso</label><input readOnly={isReadOnly} name="trabajo.paso" value={formData.trabajo?.paso || ''} onChange={handleChange} style={{...inputStyle, background: 'var(--bg-app)'}} /></div>
              <div><label style={labelStyle}>Vueltas</label><input readOnly={isReadOnly} name="trabajo.vueltas" value={formData.trabajo?.vueltas || ''} onChange={handleChange} style={{...inputStyle, background: 'var(--bg-app)'}} /></div>
              <div><label style={labelStyle}>Abertura</label><input readOnly={isReadOnly} name="trabajo.abertura" value={formData.trabajo?.abertura || ''} onChange={handleChange} style={{...inputStyle, background: 'var(--bg-app)'}} /></div>
            </div>
          </div>
        </div>

        <h3 style={sectionHeader}>Aislaciones y Medidas</h3>
        <div style={grid3}>
           <div><label style={labelStyle}>Largo</label><input readOnly={isReadOnly} name="aislaciones.alta" value={formData.aislaciones?.alta || ''} onChange={handleChange} style={inputStyle} /></div>
           <div><label style={labelStyle}>Ancho</label><input readOnly={isReadOnly} name="aislaciones.ancho" value={formData.aislaciones?.ancho || ''} onChange={handleChange} style={inputStyle} /></div>
           <div><label style={labelStyle}>Cantidad</label><input readOnly={isReadOnly} name="aislaciones.cantidad" value={formData.aislaciones?.cantidad || ''} onChange={handleChange} style={inputStyle} /></div>
        </div>

        <h3 style={sectionHeader}>Registro Fotográfico</h3>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '30px' }}>
            {formData.fotos?.map((fotoUrl, index) => (
                <div key={index} style={{ width: '120px', height: '120px', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--border)', boxShadow: '0 4px 6px rgba(0,0,0,0.2)', cursor: 'zoom-in' }}>
                    <img src={fotoUrl} alt="Motor" onClick={(e) => { setSelectedImage(fotoUrl); setIsZoomed(false); }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
            ))}
            {newImages.map((url, index) => (
                <div key={`new-${index}`} style={{ width: '120px', height: '120px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #38bdf8', cursor: 'zoom-in' }}>
                    <img src={url} alt="Preview" onClick={(e) => { setSelectedImage(url); setIsZoomed(false); }} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                </div>
            ))}
            {!isReadOnly && (
                <label style={{ width: '120px', height: '120px', borderRadius: '12px', border: '2px dashed var(--text-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0.7, background: 'rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '2rem' }}>+</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>AGREGAR</span>
                    <input type="file" multiple accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </label>
            )}
        </div>

        <h3 style={sectionHeader}>Observaciones Técnicas</h3>
        <textarea readOnly={isReadOnly} name="observaciones" value={formData.observaciones || ''} onChange={handleChange} rows="4" style={{...inputStyle, resize:'vertical', minHeight: '100px'}} />

        {!isReadOnly && (
          <div style={{ marginTop: '40px', textAlign: 'right', borderTop:'1px solid var(--border)', paddingTop:'20px' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '15px 40px', fontSize: '1.1rem', borderRadius: '8px' }}>
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

      {/* Se pasa isSaving como isLoading al Modal para bloquear el botón */}
      <Modal 
        isOpen={modalOpen}
        isLoading={isSaving} // <--- CLAVE PARA EVITAR DOBLE CLICK
        title={isEditMode ? "Confirmar Edición" : "Confirmar Creación"}
        message={isEditMode ? "¿Guardar cambios en esta ficha?" : "¿Crear nueva ficha de motor?"}
        onClose={() => !isSaving && setModalOpen(false)} // No cerrar si está guardando
        onConfirm={confirmSave}
      />

      {selectedImage && (
        <div 
          onClick={closeLightbox}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.95)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, backdropFilter: 'blur(5px)',
            cursor: 'zoom-out'
          }}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={closeLightbox} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer', zIndex: 10001, width: '50px', height: '50px', borderRadius: '50%' }}>✕</button>
            <img 
              src={selectedImage} 
              alt="Full Size" 
              onClick={handleImageClick} 
              style={{ 
                maxWidth: '95%', maxHeight: '90vh', borderRadius: '4px', 
                boxShadow: '0 0 30px rgba(0,0,0,0.8)',
                transition: 'transform 0.25s ease',
                transform: isZoomed ? 'scale(2.5)' : 'scale(1)',
                transformOrigin: zoomOrigin,
                cursor: isZoomed ? 'zoom-out' : 'zoom-in'
              }} 
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default MotorForm;