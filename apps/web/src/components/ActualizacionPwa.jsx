import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import Button from './ui/Button';

/**
 * Avisa cuando hay una version nueva de la app instalada.
 *
 * El service worker se actualiza solo en segundo plano (registerType:
 * 'autoUpdate' en vite.config.js), pero la pestaña abierta sigue
 * corriendo el JS viejo hasta que alguien navega o recarga. Forzar el
 * reload apenas esta lista la version nueva cortaria a alguien a mitad
 * de cargar un presupuesto o revisar una ficha; este banner deja que
 * decida cuando.
 *
 * offlineReady se ignora a proposito: es informativo ("ya se puede usar
 * sin conexion") y no una decision que alguien necesite tomar. Avisarlo
 * seria ruido.
 */
const ActualizacionPwa = () => {
  const {
    needRefresh: [necesitaActualizar, setNecesitaActualizar],
    updateServiceWorker,
  } = useRegisterSW();

  if (!necesitaActualizar) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 'calc(10px + env(safe-area-inset-top, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 10px 10px 16px',
        borderRadius: '999px',
        background: 'var(--accent)',
        color: '#fff',
        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        maxWidth: 'calc(100vw - 24px)',
      }}
    >
      <span style={{ fontSize: 'var(--txt-sm)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        Hay una versión nueva
      </span>
      <Button
        size="sm"
        onClick={() => updateServiceWorker(true)}
        style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', flexShrink: 0 }}
      >
        <RefreshCw size={13} /> Actualizar
      </Button>
      <button
        type="button"
        onClick={() => setNecesitaActualizar(false)}
        aria-label="Cerrar aviso de actualización"
        style={{
          background: 'none', border: 'none', color: '#fff', opacity: 0.8,
          cursor: 'pointer', padding: '4px', display: 'grid', placeItems: 'center', flexShrink: 0,
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
};

export default ActualizacionPwa;
