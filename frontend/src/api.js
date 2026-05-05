import axios from "axios";

const fallbackBaseUrl = window.location.hostname === "localhost" ? "http://localhost:5000" : "";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || fallbackBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
