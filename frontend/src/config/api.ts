// URL base da API: use Vite env var VITE_API_BASE in production, fallback to local dev address
export const API_BASE =
    import.meta.env.VITE_API_BASE || 'http://192.168.0.108:8000';
