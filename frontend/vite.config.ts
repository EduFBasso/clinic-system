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
        proxy: {
            '/register': {
                target: 'http://localhost:8000', // backend Django
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
