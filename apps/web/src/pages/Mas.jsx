import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Moon, Sun, LogOut, ChevronRight, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Modal from '../components/Modal';
import { DESTINOS, GRUPOS, puedeVer } from '../lib/accesos';

/**
 * Lo que no entra en la barra de abajo.
 *
 * Es la pantalla "Mas" del celular, pero la ruta existe siempre: en
 * escritorio se llega por el sidebar y no hace falta, aunque tampoco
 * molesta que ande.
 *
 * La lista sale de lib/accesos.js, el mismo catalogo que usan los
 * accesos directos del panel. Estaba duplicada, y una seccion nueva
 * habia que acordarse de sumarla en los dos lados.
 */

const Mas = () => {
  const { logout, perfil, esEditor } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [confirmarSalida, setConfirmarSalida] = useState(false);

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

      {GRUPOS.map((grupo) => {
        // Un lector no ve precios: mostrarle la seccion y que despues le
        // rebote por RLS es peor que no mostrarsela.
        const items = DESTINOS.filter((d) => d.grupo === grupo && puedeVer(d, esEditor));
        if (items.length === 0) return null;

        return (
          <div key={grupo}>
            <div style={tituloGrupo}>{grupo}</div>
            <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
              {items.map((item, i, arr) => {
                const Icono = item.icon;
                return (
                  <Link key={item.id} to={item.to}
                    style={{ ...fila, borderBottom: i === arr.length - 1 ? 'none' : fila.borderBottom }}>
                    <span style={icono}><Icono size={17} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>{item.label}</span>
                      <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-light)' }}>{item.ayuda}</span>
                    </span>
                    <ChevronRight size={17} style={{ color: 'var(--text-light)', flexShrink: 0 }} />
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

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
