// Resolve API base URL safely across environments.
// - Production/Preview (Vercel): set VITE_API_BASE to the Render backend URL.
// - Local dev: set VITE_API_BASE in .env.local or rely on default http://localhost:8000.
// Never ship LAN IPs in fallback.
const BUILD_API_RAW = import.meta.env.VITE_API_BASE as string | undefined;
const BUILD_API = BUILD_API_RAW?.trim();

function runtimeResolveApiBase(): string {
    // If build provided a valid absolute URL, use it (normalized without trailing slashes).
    if (BUILD_API && /^https?:\/\//.test(BUILD_API)) {
        return BUILD_API.replace(/\/+$/, '');
    }

    // Final fallback to localhost dev only.
    return (BUILD_API || 'http://localhost:8000').replace(/\/+$/, '');
}

export const API_BASE = runtimeResolveApiBase();
