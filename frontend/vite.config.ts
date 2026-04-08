import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    // Prevent duplicated React instances in monorepo/workspaces scenarios
    resolve: {
        dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
        include: ['react', 'react-dom'],
    },
    server: {
        host: true,
        port: 5173,
        strictPort: true,
        allowedHosts: true,
        proxy: {
            '/register': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                secure: false,
            },
            '/agenda': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                secure: false,
                bypass(req) {
                    // Proxy only real API calls (/agenda/appointments/, etc.)
                    // React route /agenda or /agenda?... → serve index.html
                    const url = req.url ?? '';
                    if (url.startsWith('/agenda/')) return null; // proxy
                    return '/index.html'; // SPA fallback
                },
            },
            '/anamnesis': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                secure: false,
            },
            '/inventory': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                secure: false,
            },
            '/token': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                secure: false,
            },
            '/sessions': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                secure: false,
            },
            '/health': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                secure: false,
            },
            '/media': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
