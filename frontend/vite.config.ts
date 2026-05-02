import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

function resolveGitCommit() {
    const envCommit =
        process.env.VITE_APP_COMMIT ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.GIT_COMMIT_SHA;
    if (envCommit && envCommit.trim()) {
        return envCommit.trim().slice(0, 12);
    }

    try {
        return execSync('git rev-parse --short=12 HEAD', {
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .toString()
            .trim();
    } catch {
        return 'N/D';
    }
}

const buildCommit = resolveGitCommit();
const buildTime = process.env.VITE_BUILD_TIME || new Date().toISOString();

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    define: {
        'import.meta.env.VITE_APP_COMMIT': JSON.stringify(buildCommit),
        'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
    },
    build: {
        chunkSizeWarningLimit: 1000, // KB — aviso só acima de 1MB
        cssMinify: 'esbuild', // avoid lightningcss linux native binary issue on Vercel/CI
    },
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
            '/odonto': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                secure: false,
                bypass(req) {
                    // Proxy only real API calls (/odonto/procedures/, /odonto/arcades/, etc.)
                    // React route /odonto/... → serve index.html
                    const url = req.url ?? '';
                    if (
                        url.startsWith('/odonto/procedures/') ||
                        url.startsWith('/odonto/arcades/') ||
                        url.startsWith('/odonto/teeth/') ||
                        url.startsWith('/odonto/surfaces/')
                    ) {
                        return null; // proxy
                    }
                    return '/index.html'; // SPA fallback
                },
            },
        },
    },
});
