// src/api/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000", // ajuste se for usar outro host
});

export default api;