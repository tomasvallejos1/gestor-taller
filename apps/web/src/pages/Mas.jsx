import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Hammer, FileText, Tags, Settings, BarChart3, Moon, Sun,
  LogOut, ChevronRight, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Modal from '../components/Modal';

/**
 * Lo que no entra en la barra de abajo.
 *
 * Es la pantalla "Mas" del celular, pero la ruta existe siempre: en
 * escritorio se llega por el sidebar y no hace falta, aunque tampoco
 * molesta que ande.
 */

const SECCIONES = [
  {
    titulo: 'Taller',
    items: [
      { to: '/sistema/reparaciones', label: 'Reparaciones', ayuda: 'Ordenes abiertas y cerradas', icon: Hammer },
    ],
  },
  {
    titulo: 'Facturacion',
    rol: 'editor',
    items: [
      { to: '/sistema/presupuestos', label: 'Presupuestos', ayuda: 'Cotizaciones y PDF para el cliente', icon: FileText },
      { to: '/sistema/catalogo', label: 'Lista de precios', ayuda: 'Trabajos frecuentes y su precio', icon: Tags },
    ],
  },
  {
    titulo: 'Sistema',
    items: [
      { to: '/sistema/informes', label: 'Informes', ayuda: 'Estadisticas del taller', icon: BarChart3 },
      { to: '/sistema/ajustes', label: 'Ajustes', ayuda: 'Tu perfil, usuarios y datos del taller', icon: Settings },
    ],
  },
];

const Mas = () => {
  const { logout, perfil, esEditor } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  // Un lector no ve precios: mostrarle la seccion y que despues le rebote
  // por RLS es peor que no mostrarsela.
  const puede = (rol) => (rol !== 'editor' ? true : Boolean(esEditor));

  const fila = {
    display: 'flex', alignItems: 'center', gap: '13px',
    padding: '14px 16px', minHeight: '58px',
    color: 'inherit', textDecoration: 'none',
    borderBottom: '1px solid var(--border)',
  };
  const icono = {
    width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
    display: 'grid', placeItems: 'center',
    background: 'var(--gradient-soft, var(--accent-tint-strong))',
    color: 'var(--accent)',
  };
  const tituloGrupo = {
    fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.09em', color: 'var(--text-light)',
    margin: '22px 4px 8px',
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.6rem', margin: '0 0 4px' }}>Mas</h2>
      <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginTop: 0 }}>
        {perfil?.nombre ? `Hola, ${perfil.nombre}.` : ''} Todo lo que no entra abajo.
      </p>

      {SECCIONES.filter((s) => puede(s.rol)).map((seccion) => (
        <div key={seccion.titulo}>
          <div style={tituloGrupo}>{seccion.titulo}</div>
          <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
            {seccion.items.map((item, i, arr) => {
              const Icono = item.icon;
              const { to, label, ayuda } = item;
              return (
              <Link key={to} to={to}
                style={{ ...fila, borderBottom: i === arr.length - 1 ? 'none' : fila.borderBottom }}>
                <span style={icono}><Icono size={17} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{label}</span>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-light)' }}>{ayuda}</span>
                </span>
                <ChevronRight size={17} style={{ color: 'var(--text-light)', flexShrink: 0 }} />
              </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div style={tituloGrupo}>Preferencias</div>
      <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
        <button type="button" onClick={toggleTheme}
          style={{ ...fila, width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
          <span style={icono}>{isDarkMode ? <Sun size={17} /> : <Moon size={17} />}</span>
          <span style={{ flex: 1, fontWeight: 600 }}>
            {isDarkMode ? 'Modo claro' : 'Modo oscuro'}
          </span>
        </button>

        <button type="button" onClick={() => setConfirmarSalida(true)}
          style={{ ...fila, width: '100%', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left', color: 'var(--danger)' }}>
          <span style={{ ...icono, background: 'rgba(239,68,68,0.12)', color: 'var(--danger)' }}>
            <LogOut size={17} />
          </span>
          <span style={{ flex: 1, fontWeight: 600 }}>Cerrar sesion</span>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', margin: '20px 0 6px', fontSize: '0.78rem', color: 'var(--text-light)' }}>
        <ShieldCheck size={13} />
        Bobinados David · Venado Tuerto
      </div>

      <Modal
        isOpen={confirmarSalida}
        type="danger"
        title="Cerrar sesion"
        message="Vas a tener que volver a entrar con tu correo y contraseña."
        onClose={() => setConfirmarSalida(false)}
        onConfirm={logout}
      />
    </div>
  );
};

export default Mas;
