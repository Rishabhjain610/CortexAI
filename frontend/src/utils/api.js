import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000', // Or your production URL
  withCredentials: true,
});

export default api;
