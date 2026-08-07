import { useEffect, useState } from 'react';

/**
 * Breakpoint reactivo desde JS.
 *
 * Para elegir entre dos estructuras distintas (tabla vs tarjetas) hace
 * falta decidir en el render, no en CSS: una media query puede ocultar
 * la tabla, pero igual la construye y la manda al DOM.
 */
export function useMediaQuery(consulta) {
  const [coincide, setCoincide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(consulta).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const alCambiar = (e) => setCoincide(e.matches);
    setCoincide(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, [consulta]);

  return coincide;
}

export const useEsMobile = () => useMediaQuery('(max-width: 768px)');
