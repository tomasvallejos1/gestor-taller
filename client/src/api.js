import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4000/api', // Asegúrate de que el puerto sea el correcto
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