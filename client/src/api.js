import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4000/api', // La dirección de tu servidor backend
});

export default api;