import axios from 'axios';

// Si existe la variable VITE_API_URL úsala, sino usa localhost
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: baseURL,
});

// Antes de que salga cualquier petición, este código se ejecuta:
api.interceptors.request.use(
  (config) => {
    // 1. Buscamos al usuario guardado en el navegador
    const userInfo = localStorage.getItem('userInfo');

    // 2. Si existe, sacamos el token
    if (userInfo) {
      const { token } = JSON.parse(userInfo);
      
      // 3. Lo pegamos en la cabecera "Authorization" como un pase VIP
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;