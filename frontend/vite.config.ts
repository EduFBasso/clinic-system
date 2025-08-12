import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/register': {
                target: 'http://localhost:8000', // backend Django
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
