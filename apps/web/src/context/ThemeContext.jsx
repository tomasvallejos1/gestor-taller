import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  // 1. Leemos la preferencia guardada o definimos falso (modo claro) por defecto
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // 2. Cada vez que cambia el estado, actualizamos el HTML y el localStorage
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    // Se apagan las transiciones mientras cambian las variables del
    // tema. Animar un color que sale de una variable que acaba de
    // cambiar deja el valor viejo pegado: bordes y fondos se quedaban
    // en claro con el resto de la pagina ya en oscuro.
    document.body.classList.add('sin-transiciones');
    setIsDarkMode((v) => !v);
    // Dos cuadros: uno para que se aplique el tema, otro para devolver
    // las transiciones sin que alcancen a animar el cambio.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => document.body.classList.remove('sin-transiciones'));
    });
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};