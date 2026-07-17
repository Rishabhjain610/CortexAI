import axios from 'axios';

// Central Axios client instance setup: port 8000 ke Gateway server se credentials cookies (session tracking) ke sath baat karega.
const api = axios.create({
  baseURL: 'http://localhost:8000', // Backend Gateway base API URL
  withCredentials: true,
});

export default api;
