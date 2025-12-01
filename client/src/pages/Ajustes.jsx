import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import Modal from '../components/Modal';

const Ajustes = () => {
  const { user } = useContext(AuthContext); 
  
  // Estados Perfil
  const [profileData, setProfileData] = useState({
    nombre: user?.nombre || '',
    email: user?.email || '',
    password: '',
    confirmPassword: ''
  });

  // Estados Admin (Usuarios)
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({ nombre: '', email: '', password: '', rol: 'editor' });
  const [editingId, setEditingId] = useState(null); // ID del usuario que se está editando
  const [refresh, setRefresh] = useState(false); 

  // Estados Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  useEffect(() => {
    if (user?.rol === 'super') {
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
  }, [user, refresh]);

  // --- HANDLER: MI PERFIL ---
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

  // --- HANDLER: CREAR O EDITAR USUARIO ---
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        // MODO EDICIÓN
        await api.put(`/auth/users/${editingId}`, {
            ...userForm,
            password: userForm.password || undefined // Si está vacío no se envía
        });
        alert("Usuario actualizado");
      } else {
        // MODO CREACIÓN
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
    setUserForm({ 
        nombre: u.nombre, 
        email: u.email, 
        password: '', // La contraseña no se trae por seguridad
        rol: u.rol 
    });
    // Scroll suave hacia el formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      if (editingId === userToDelete._id) resetForm(); // Si estaba editando al que borró
    } catch (error) {
      alert("Error eliminando: " + error.message);
    }
  };

  // --- ESTILOS ---
  const headerStyle = { fontSize: '1.5rem', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px' };
  const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#64748b', marginBottom: '5px', textTransform: 'uppercase' };
  const inputStyle = { width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #cbd5e1' };

  // Botón Principal Estilizado
  const fancyButtonStyle = {
    width: '100%',
    padding: '12px',
    background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.5px',
    boxShadow: '0 4px 6px rgba(15, 23, 42, 0.2)',
    transition: 'transform 0.1s, box-shadow 0.1s',
    marginTop: '10px'
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.75rem', color: '#0f172a', marginBottom: '30px' }}>Configuración del Sistema</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '30px' }}>
        
        {/* === TARJETA 1: MI PERFIL === */}
        <div className="card">
          <h3 style={headerStyle}>👤 Mi Perfil</h3>
          <form onSubmit={handleProfileUpdate}>
            <label style={labelStyle}>Nombre</label>
            <input type="text" value={profileData.nombre} onChange={e => setProfileData({...profileData, nombre: e.target.value})} style={inputStyle} />
            
            <label style={labelStyle}>Email</label>
            <input type="email" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} style={inputStyle} />
            
            <div style={{ borderTop: '1px dashed #cbd5e1', margin: '20px 0', paddingTop: '20px' }}>
                <p style={{fontSize:'0.8rem', color:'#94a3b8', marginBottom:'15px'}}>Cambiar Contraseña (Opcional)</p>
                <label style={labelStyle}>Nueva Contraseña</label>
                <input type="password" placeholder="********" value={profileData.password} onChange={e => setProfileData({...profileData, password: e.target.value})} style={inputStyle} />
                
                <label style={labelStyle}>Confirmar Contraseña</label>
                <input type="password" placeholder="********" value={profileData.confirmPassword} onChange={e => setProfileData({...profileData, confirmPassword: e.target.value})} style={inputStyle} />
            </div>

            <button type="submit" style={fancyButtonStyle}>
                GUARDAR CAMBIOS
            </button>
          </form>
        </div>

        {/* === TARJETA 2: GESTIÓN DE USUARIOS (Solo Super Admin) === */}
        {user?.rol === 'super' && (
          <div className="card">
            <h3 style={headerStyle}>👥 Gestión de Usuarios (IT)</h3>
            
            {/* Formulario Crear/Editar Usuario */}
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h4 style={{ fontSize: '0.9rem', color: '#0f172a', margin: 0 }}>
                    {editingId ? '✏️ EDITAR USUARIO' : '+ CREAR NUEVO USUARIO'}
                </h4>
                {editingId && (
                    <button onClick={resetForm} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}>
                        Cancelar Edición
                    </button>
                )}
              </div>

              <form onSubmit={handleUserSubmit} style={{ display: 'grid', gap: '10px' }}>
                <input required placeholder="Nombre Completo" value={userForm.nombre} onChange={e => setUserForm({...userForm, nombre: e.target.value})} style={{...inputStyle, marginBottom:0}} />
                <input required type="email" placeholder="Correo electrónico" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} style={{...inputStyle, marginBottom:0}} />
                <input 
                    type="password" 
                    placeholder={editingId ? "Nueva contraseña (opcional)" : "Contraseña"} 
                    required={!editingId} // Obligatoria solo al crear
                    value={userForm.password} 
                    onChange={e => setUserForm({...userForm, password: e.target.value})} 
                    style={{...inputStyle, marginBottom:0}} 
                />
                
                <select value={userForm.rol} onChange={e => setUserForm({...userForm, rol: e.target.value})} style={{...inputStyle, marginBottom:0, cursor:'pointer'}}>
                  <option value="editor">Editor (Técnico)</option>
                  <option value="lector">Lector (Solo Ver)</option>
                  <option value="super">Super Admin (IT)</option>
                </select>

                <button type="submit" style={{ ...fancyButtonStyle, background: editingId ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : fancyButtonStyle.background }}>
                    {editingId ? 'ACTUALIZAR USUARIO' : 'CREAR USUARIO'}
                </button>
              </form>
            </div>

            {/* Lista de Usuarios */}
            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', textAlign: 'left', color:'#64748b' }}>
                    <th style={{ padding: '10px', fontSize:'0.75rem', textTransform:'uppercase' }}>Usuario</th>
                    <th style={{ padding: '10px', fontSize:'0.75rem', textTransform:'uppercase' }}>Rol</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: '600', color:'#0f172a' }}>{u.nombre}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{u.email}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ 
                          padding: '4px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold',
                          background: u.rol === 'super' ? '#e0f2fe' : (u.rol === 'editor' ? '#dcfce7' : '#f1f5f9'),
                          color: u.rol === 'super' ? '#0369a1' : (u.rol === 'editor' ? '#15803d' : '#475569')
                        }}>
                          {u.rol === 'super' ? 'ADMIN' : u.rol.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {u._id !== user._id && (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {/* BOTÓN EDITAR */}
                            <button 
                                onClick={() => startEditing(u)}
                                title="Editar"
                                style={{ border: 'none', background: '#f1f5f9', padding:'6px 10px', borderRadius:'4px', cursor: 'pointer', color: '#475569', fontSize: '1rem' }}
                            >
                                ✏️
                            </button>

                            {/* BOTÓN ELIMINAR */}
                            <button 
                                onClick={() => { setUserToDelete(u); setModalOpen(true); }}
                                title="Eliminar"
                                style={{ border: 'none', background: '#fee2e2', padding:'6px 10px', borderRadius:'4px', cursor: 'pointer', color: '#ef4444', fontSize: '1rem' }}
                            >
                                🗑️
                            </button>
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