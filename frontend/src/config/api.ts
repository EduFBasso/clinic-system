// Resolve API base URL safely across environments.
// - Production/Preview (Vercel): set VITE_API_BASE to the Render backend URL.
// - Local dev: set VITE_API_BASE in .env.local or rely on default http://localhost:8000.
// Never ship LAN IPs in fallback.
const BUILD_API_RAW = import.meta.env.VITE_API_BASE as string | undefined;
// Trim and strip wrapping quotes to avoid mistakes like "https://..." from env UI
const BUILD_API = BUILD_API_RAW?.trim().replace(/^['"]|['"]$/g, '');

function runtimeResolveApiBase(): string {
    // If build provided a valid absolute URL, use it (normalized without trailing slashes).
    if (BUILD_API && /^https?:\/\//.test(BUILD_API)) {
        return BUILD_API.replace(/\/+$/, '');
    }

    // If running on Vercel (preview/prod) and no valid build-time API, fall back to Render URL
    if (typeof window !== 'undefined') {
        const host = window.location.hostname || '';
        if (host.includes('vercel.app')) {
            return 'https://clinic-system-swzd.onrender.com';
        }
    }

    // Final fallback to localhost dev only.
    return (BUILD_API || 'http://localhost:8000').replace(/\/+$/, '');
}

export const API_BASE = runtimeResolveApiBase();
