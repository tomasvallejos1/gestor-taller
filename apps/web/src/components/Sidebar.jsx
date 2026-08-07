import React, { useContext, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Wrench,
  Hammer,
  Users,
  FileText,
  Tags,
  Settings,
  Moon,
  Sun,
  MonitorUp,
  MonitorDown,
  LogOut
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { to: '/sistema/home', label: 'Panel', icon: LayoutDashboard },
  { to: '/sistema/reparaciones', label: 'Reparaciones', icon: Hammer },
  { to: '/sistema/motores', label: 'Motores', icon: Wrench },
  { to: '/sistema/clientes', label: 'Clientes', icon: Users },
  { to: '/sistema/presupuestos', label: 'Presupuestos', icon: FileText },
  // La lista de precios solo se llegaba desde un boton en la cabecera
  // de Presupuestos. Es una seccion propia --en el celular ya figura
  // en "Mas"-- y merece estar en el menu.
  { to: '/sistema/catalogo', label: 'Lista de precios', icon: Tags }
];

const Sidebar = ({ isOpen, closeMenu }) => {
  const { logout } = useContext(AuthContext);
  const { isDarkMode, toggleTheme } = useTheme();
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  const handleLogout = (e) => {
    e.preventDefault();
    closeMenu();
    logout();
  };

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // ignore fullscreen API errors
    }
    closeMenu();
  };

  const navLinkStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    borderRadius: '10px',
    textDecoration: 'none',
    color: isActive ? '#ffffff' : '#a8b2c1',
    background: isActive ? 'rgba(255, 255, 255, 0.10)' : 'transparent',
    border: isActive ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid transparent',
    fontSize: '0.92rem',
    fontWeight: 600,
    marginBottom: '8px'
  });

  const actionBtnStyle = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderRadius: '10px',
    padding: '10px 12px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)',
    color: '#e6e8ff',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit'
  };

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} style={{ padding: '18px 14px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '18px', padding: '10px 8px 16px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          <NavLink to="/sistema/home" onClick={closeMenu} style={{ textDecoration: 'none', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '11px',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--gradient-primary)',
                  color: 'white'
                }}
              >
                <Wrench size={18} />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem', letterSpacing: '0.04em' }}>BOBINADOS DAVID</strong>
                <small style={{ color: '#aeb5e8' }}>Panel operativo</small>
              </div>
            </div>
          </NavLink>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} style={navLinkStyle} onClick={closeMenu}>
                <Icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          <NavLink to="/sistema/informes" style={navLinkStyle} onClick={closeMenu}>
            <FileText size={16} />
            <span>Informes</span>
          </NavLink>
        </nav>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '14px', display: 'grid', gap: '8px' }}>
          <button onClick={toggleTheme} style={actionBtnStyle}>
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            {isDarkMode ? 'Modo claro' : 'Modo oscuro'}
          </button>

          <button onClick={toggleFullScreen} style={actionBtnStyle}>
            {isFullscreen ? <MonitorDown size={16} /> : <MonitorUp size={16} />}
            {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          </button>

          <NavLink
            to="/sistema/ajustes"
            style={({ isActive }) => ({
              ...navLinkStyle({ isActive }),
              marginBottom: 0,
              justifyContent: 'center'
            })}
            onClick={closeMenu}
          >
            <Settings size={16} />
            Ajustes
          </NavLink>

          <button
            onClick={handleLogout}
            style={{
              ...actionBtnStyle,
              borderColor: 'rgba(239, 68, 68, 0.35)',
              color: '#fecaca',
              background: 'rgba(239, 68, 68, 0.14)'
            }}
          >
            <LogOut size={16} />
            Cerrar sesion
          </button>
        </div>
      </aside>

      <div className={`overlay ${isOpen ? 'show' : ''}`} onClick={closeMenu} />
    </>
  );
};

export default Sidebar;
