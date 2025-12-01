import axios from 'axios';

const api = axios.create({
  baseURL: 'http://192.168.0.22:4000/api', // La dirección de tu servidor backend (accesible desde la red)
});

export default api;