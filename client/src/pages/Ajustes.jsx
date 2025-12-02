import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import Modal from '../components/Modal';

const Ajustes = () => {
  const { user } = useContext(AuthContext); 
  const isSuper = user?.rol === 'super';

  // ESTADO DE PESTAÑAS (Default: perfil)
  const [activeTab, setActiveTab] = useState('perfil');

  // --- ESTADOS MI PERFIL ---
  const [profileData, setProfileData] = useState({
    nombre: user?.nombre || '',
    email: user?.email || '',
    password: '',
    confirmPassword: ''
  });

  // --- ESTADOS ADMIN (Usuarios) ---
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({ nombre: '', email: '', password: '', rol: 'editor' });
  const [editingId, setEditingId] = useState(null);
  const [refresh, setRefresh] = useState(false);

  // --- ESTADOS MODAL ---
  const [modalOpen, setModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // CARGAR USUARIOS (Solo si es Super y está en la pestaña usuarios)
  useEffect(() => {
    if (isSuper && activeTab === 'usuarios') {
      const fetchUsers = async () => {
        try {
          const { data } = await api.get('/auth/users');
          setUsers(data);
        } catch (error) {
          console.error("Error cargando usuarios:", error);
        }
      };
      fetchUsers();
    }
  }, [isSuper, activeTab, refresh]);

  // --- HANDLERS: MI PERFIL ---
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (profileData.password && profileData.password !== profileData.confirmPassword) {
      return alert("Las contraseñas no coinciden");
    }
    try {
      const { data } = await api.put('/auth/profile', {
        nombre: profileData.nombre,
        email: profileData.email,
        password: profileData.password || undefined 
      });
      alert("Perfil actualizado correctamente");
      localStorage.setItem('userInfo', JSON.stringify(data));
      window.location.reload(); 
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  // --- HANDLERS: GESTIÓN USUARIOS ---
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/auth/users/${editingId}`, { ...userForm, password: userForm.password || undefined });
        alert("Usuario actualizado");
      } else {
        await api.post('/auth/register', userForm);
        alert("Usuario creado exitosamente");
      }
      resetForm();
      setRefresh(!refresh); 
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const startEditing = (u) => {
    setEditingId(u._id);
    setUserForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol });
  };

  const resetForm = () => {
    setEditingId(null);
    setUserForm({ nombre: '', email: '', password: '', rol: 'editor' });
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await api.delete(`/auth/users/${userToDelete._id}`);
      setRefresh(!refresh);
      setModalOpen(false);
      if (editingId === userToDelete._id) resetForm();
    } catch (error) {
      alert("Error eliminando: " + error.message);
    }
  };

  // --- HANDLERS: BACKUPS ---
  const handleDownloadBackup = async () => {
    try {
      const response = await api.get('/backup/download', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `taller-backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert("Error descargando backup.");
    }
  };

  const handleTestEmail = async () => {
    if (!window.confirm("Esto enviará un backup ahora mismo a tu correo. ¿Continuar?")) return;
    try {
      alert("⏳ Enviando...");
      const { data } = await api.post('/backup/test-email');
      alert("✅ " + data.message);
    } catch (error) {
      alert("❌ Error: " + (error.response?.data?.message || error.message));
    }
  };

  // --- ESTILOS ---
  const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '5px', textTransform: 'uppercase', opacity: 0.8 };
  const inputStyle = { width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-main)' };
  
  // Estilos de Pestañas
  const tabContainerStyle = { display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border)' };
  const tabStyle = (isActive) => ({
    padding: '10px 20px',
    cursor: 'pointer',
    borderBottom: isActive ? '3px solid var(--accent)' : '3px solid transparent',
    color: isActive ? 'var(--accent)' : 'var(--text-light)',
    fontWeight: isActive ? '700' : '500',
    fontSize: '0.95rem',
    background: 'transparent',
    border: 'none',
    borderBottomWidth: '3px',
    borderBottomStyle: 'solid',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.8rem', marginBottom: '20px' }}>Configuración</h2>

      {/* --- PESTAÑAS DE NAVEGACIÓN --- */}
      <div style={tabContainerStyle}>
        <button style={tabStyle(activeTab === 'perfil')} onClick={() => setActiveTab('perfil')}>
          👤 Mi Perfil
        </button>
        
        {isSuper && (
          <>
            <button style={tabStyle(activeTab === 'usuarios')} onClick={() => setActiveTab('usuarios')}>
              👥 Usuarios
            </button>
            <button style={tabStyle(activeTab === 'backups')} onClick={() => setActiveTab('backups')}>
              💾 Backups
            </button>
          </>
        )}
      </div>

      {/* --- CONTENIDO DE PESTAÑAS --- */}
      <div className="card" style={{ padding: '30px' }}>
        
        {/* PESTAÑA 1: MI PERFIL */}
        {activeTab === 'perfil' && (
          <form onSubmit={handleProfileUpdate} style={{ maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>Datos Personales</h3>
            
            <label style={labelStyle}>Nombre</label>
            <input type="text" value={profileData.nombre} onChange={e => setProfileData({...profileData, nombre: e.target.value})} style={inputStyle} />
            
            <label style={labelStyle}>Email</label>
            <input type="email" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} style={inputStyle} />
            
            <div style={{ borderTop: '1px dashed var(--border)', margin: '20px 0', paddingTop: '20px' }}>
                <p style={{fontSize:'0.8rem', opacity:0.7, marginBottom:'15px'}}>Cambiar Contraseña (Opcional)</p>
                <label style={labelStyle}>Nueva Contraseña</label>
                <input type="password" placeholder="********" value={profileData.password} onChange={e => setProfileData({...profileData, password: e.target.value})} style={inputStyle} />
                
                <label style={labelStyle}>Confirmar Contraseña</label>
                <input type="password" placeholder="********" value={profileData.confirmPassword} onChange={e => setProfileData({...profileData, confirmPassword: e.target.value})} style={inputStyle} />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                GUARDAR CAMBIOS
            </button>
          </form>
        )}

        {/* PESTAÑA 2: GESTIÓN DE USUARIOS */}
        {activeTab === 'usuarios' && isSuper && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Gestión de Equipo</h3>
              <button className="btn btn-secondary" onClick={resetForm} style={{fontSize:'0.8rem'}}>Limpiar Formulario</button>
            </div>
            
            {/* Formulario Crear/Editar */}
            <div style={{ background: 'var(--bg-app)', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '15px', color: 'var(--accent)' }}>
                  {editingId ? '✏️ EDITAR USUARIO' : '+ CREAR NUEVO USUARIO'}
              </h4>
              <form onSubmit={handleUserSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'end' }}>
                <div><input required placeholder="Nombre" value={userForm.nombre} onChange={e => setUserForm({...userForm, nombre: e.target.value})} style={{...inputStyle, marginBottom:0}} /></div>
                <div><input required type="email" placeholder="Email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} style={{...inputStyle, marginBottom:0}} /></div>
                <div><input type="password" placeholder={editingId ? "Nueva clave (opcional)" : "Contraseña"} required={!editingId} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} style={{...inputStyle, marginBottom:0}} /></div>
                
                <div>
                  <select value={userForm.rol} onChange={e => setUserForm({...userForm, rol: e.target.value})} style={{...inputStyle, marginBottom:0, cursor:'pointer'}}>
                    <option value="editor">Editor (Técnico)</option>
                    <option value="lector">Lector (Solo Ver)</option>
                    <option value="super">Super Admin (IT)</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>
                    {editingId ? 'ACTUALIZAR' : 'CREAR'}
                </button>
              </form>
            </div>

            {/* Lista de Usuarios */}
            <div className="table-responsive">
              <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>USUARIO</th>
                    <th style={{ padding: '10px' }}>ROL</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: '600' }}>{u.nombre}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{u.email}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ 
                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold',
                          background: u.rol === 'super' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                          color: u.rol === 'super' ? '#38bdf8' : '#22c55e'
                        }}>
                          {u.rol === 'super' ? 'ADMIN' : u.rol.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {u._id !== user._id && (
                          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => startEditing(u)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: '1rem' }}>✏️</button>
                            <button onClick={() => { setUserToDelete(u); setModalOpen(true); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem' }}>🗑️</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: BACKUPS */}
        {activeTab === 'backups' && isSuper && (
          <div style={{ maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>Copias de Seguridad</h3>
            <p style={{ marginBottom: '30px', opacity: 0.8, lineHeight: '1.6' }}>
              El sistema realiza una copia automática todos los días a las 03:00 AM y la envía a tu correo.
              También puedes descargar una copia manual o probar el envío de correo aquí.
            </p>

            <div style={{ display: 'grid', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div>
                  <strong>Descarga Local</strong>
                  <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: 0 }}>Guardar archivo .json en esta PC</p>
                </div>
                <button onClick={handleDownloadBackup} className="btn btn-secondary">⬇️ Descargar</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div>
                  <strong>Prueba de Email</strong>
                  <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: 0 }}>Enviar copia ahora mismo al correo del sistema</p>
                </div>
                <button onClick={handleTestEmail} className="btn btn-primary">📧 Enviar Mail</button>
              </div>
            </div>
          </div>
        )}

      </div>

      <Modal 
        isOpen={modalOpen}
        type="danger"
        title="Eliminar Usuario"
        message={`¿Estás seguro de quitar el acceso a ${userToDelete?.nombre}?`}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmDeleteUser}
      />
    </div>
  );
};

export default Ajustes;