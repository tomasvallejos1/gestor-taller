import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, X, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  DESTINOS, GRUPOS, MAXIMO, leerAccesos, guardarAccesos, destinoDe, puedeVer,
} from '../lib/accesos';

/**
 * Accesos directos del panel.
 *
 * En el celular todo lo que no entra en la barra de abajo esta a dos
 * toques: "Mas" y despues la seccion. Para lo que uno abre veinte veces
 * por dia eso es un toque de mas, y cada taller usa otras cuatro cosas.
 * De ahi que sea configurable en vez de una lista fija elegida por mi.
 */
const AccesosDirectos = () => {
  const { esEditor } = useAuth();
  const [ids, setIds] = useState(leerAccesos);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(ids);

  const disponibles = DESTINOS.filter((d) => puedeVer(d, esEditor));
  const elegidos = ids.map(destinoDe).filter((d) => d && puedeVer(d, esEditor));

  useEffect(() => {
    if (!editando) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape') setEditando(false); };
    document.addEventListener('keydown', alTeclear);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = previo;
    };
  }, [editando]);

  const abrir = () => { setBorrador(ids); setEditando(true); };

  const alternar = (id) => setBorrador((b) => (
    b.includes(id) ? b.filter((x) => x !== id) : (b.length >= MAXIMO ? b : [...b, id])
  ));

  const confirmar = () => {
    setIds(borrador);
    guardarAccesos(borrador);
    setEditando(false);
  };

  return (
    <section className="accesos">
      <div className="accesos__cab">
        <h3 className="accesos__titulo">Accesos directos</h3>
        <button type="button" onClick={abrir} className="accesos__editar">
          <Pencil size={14} /> Editar
        </button>
      </div>

      {elegidos.length === 0 ? (
        <button type="button" onClick={abrir} className="accesos__vacio">
          Elegí las secciones que usás todos los días.
        </button>
      ) : (
        <div className="accesos__grilla">
          {elegidos.map((d) => {
            const Icono = d.icon;
            return (
              <Link key={d.id} to={d.to} className="acceso">
                <span className="acceso__icono"><Icono size={20} /></span>
                <span className="acceso__label">{d.corto}</span>
              </Link>
            );
          })}
        </div>
      )}

      {editando && (
        <div className="hoja" role="dialog" aria-modal="true" aria-label="Elegir accesos directos">
          {/* El fondo cierra, pero no es el unico modo: tambien hay una
              X y la tecla Escape. */}
          <button type="button" className="hoja__fondo" aria-label="Cerrar"
            onClick={() => setEditando(false)} />

          <div className="hoja__panel">
            <div className="hoja__cab">
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Accesos directos</h3>
              <button type="button" onClick={() => setEditando(false)}
                className="hoja__cerrar" aria-label="Cerrar sin guardar">
                <X size={19} />
              </button>
            </div>

            <p className="hoja__ayuda">
              Hasta {MAXIMO}. Aparecen arriba de todo en el panel.
              {borrador.length >= MAXIMO && ' Ya llegaste al máximo: sacá uno para agregar otro.'}
            </p>

            <div className="hoja__cuerpo">
              {GRUPOS.map((grupo) => {
                const delGrupo = disponibles.filter((d) => d.grupo === grupo);
                if (delGrupo.length === 0) return null;
                return (
                  <div key={grupo}>
                    <div className="hoja__grupo">{grupo}</div>
                    {delGrupo.map((d) => {
                      const Icono = d.icon;
                      const puesto = borrador.includes(d.id);
                      const lleno = !puesto && borrador.length >= MAXIMO;
                      return (
                        <button key={d.id} type="button" onClick={() => alternar(d.id)}
                          className={`hoja__item${puesto ? ' hoja__item--puesto' : ''}`}
                          disabled={lleno} aria-pressed={puesto}>
                          <span className="acceso__icono"><Icono size={17} /></span>
                          <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                            <span style={{ display: 'block', fontWeight: 600 }}>{d.label}</span>
                            <span className="hoja__item-ayuda">{d.ayuda}</span>
                          </span>
                          <span className={`tilde${puesto ? ' tilde--si' : ''}`}>
                            {puesto && <Check size={14} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="hoja__pie">
              <button type="button" className="btn btn-secondary" onClick={() => setEditando(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmar}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AccesosDirectos;
