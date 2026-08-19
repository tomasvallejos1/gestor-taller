import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Hoja inferior.
 *
 * Sube desde abajo en el telefono, donde esta el pulgar; en pantalla
 * grande se centra como un dialogo comun (lo resuelve el CSS).
 *
 * Es la forma correcta para un formulario corto en el celular: el
 * contenido de atras no se mueve, las acciones quedan fijas al pie a
 * la altura de la mano, y cerrar es un gesto conocido. Un formulario
 * desplegado en medio de la lista empuja todo lo que hay abajo y deja
 * al que estaba mirando una orden sin saber a donde se le fue.
 *
 * Se cierra de tres formas --fondo, X y Escape-- porque cada una es la
 * que a alguien le sale primero.
 */
const Hoja = ({ titulo, ayuda, etiqueta, pie, onCerrar, children }) => {
  const panel = useRef(null);

  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', alTeclear);

    // Sin esto, arrastrar dentro de la hoja scrollea la pagina de atras
    // y al cerrar aparece otra parte de la lista.
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // El foco entra al panel: si se queda en el boton que abrio la
    // hoja, tabular recorre la lista de atras en vez del formulario.
    panel.current?.focus();

    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = previo;
    };
  }, [onCerrar]);

  return (
    <div className="hoja" role="dialog" aria-modal="true" aria-label={etiqueta ?? titulo}>
      <button type="button" className="hoja__fondo" aria-label="Cerrar" onClick={onCerrar} />

      <div className="hoja__panel" ref={panel} tabIndex={-1}>
        <div className="hoja__cab">
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{titulo}</h3>
          <button type="button" onClick={onCerrar} className="hoja__cerrar" aria-label="Cerrar">
            <X size={19} />
          </button>
        </div>

        {ayuda ? <p className="hoja__ayuda">{ayuda}</p> : null}

        <div className="hoja__cuerpo">{children}</div>

        {pie ? <div className="hoja__pie">{pie}</div> : null}
      </div>
    </div>
  );
};

export default Hoja;
