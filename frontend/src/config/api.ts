// Resolve API base URL safely across environments.
// - Production/Preview (Vercel): set VITE_API_BASE to the Render backend URL.
// - Local dev: set VITE_API_BASE in .env.local or rely on default http://localhost:8000.
// Never ship LAN IPs in fallback.
const BUILD_API_RAW = import.meta.env.VITE_API_BASE as string | undefined;
// Trim and strip wrapping quotes to avoid mistakes like "https://..." from env UI
const BUILD_API = BUILD_API_RAW?.trim().replace(/^['"]|['"]$/g, '');

function runtimeResolveApiBase(): string {
    const inWindow = typeof window !== 'undefined';
    const host = inWindow ? window.location.hostname || '' : '';
    const protocol = inWindow ? window.location.protocol || 'http:' : 'http:';
    const isLocalHost =
        host === 'localhost' || host === '127.0.0.1' || host === '::1';
    const buildApiIsLocal =
        !!BUILD_API &&
        /^(https?:\/\/)?(localhost|127\.0\.0\.1|::1)/.test(BUILD_API);

    // If build provided a valid absolute URL, prefer it except when it points to localhost
    // but the app is accessed from a non-localhost host (e.g., phone on LAN). In that case,
    // override to the LAN host to avoid calling the phone's own localhost.
    if (BUILD_API && /^https?:\/\//.test(BUILD_API)) {
        if (
            inWindow &&
            !isLocalHost &&
            !host.includes('vercel.app') &&
            buildApiIsLocal
        ) {
            // Tunnel hosts (localtunnel, ngrok, cloudflared, etc): use empty base — Vite proxy handles routing
            if (
                host.includes('.loca.lt') ||
                host.includes('.ngrok') ||
                host.includes('.trycloudflare.com')
            ) {
                return '';
            }
            return `${protocol}//${host}:8000`.replace(/\/+$/, '');
        }
        return BUILD_API.replace(/\/+$/, '');
    }

    // If running locally from another device on the LAN (e.g., iPhone hitting http://<PC-IP>:5173),
    // prefer using that same hostname with backend port 8000.
    // Exception: tunnel hosts — Vite proxy handles routing, use empty base.
    if (inWindow && !isLocalHost && !host.includes('vercel.app')) {
        if (
            host.includes('.loca.lt') ||
            host.includes('.ngrok') ||
            host.includes('.trycloudflare.com')
        ) {
            return '';
        }
        return `${protocol}//${host}:8000`.replace(/\/+$/, '');
    }

    // If running on Vercel (preview/prod) and no valid build-time API, fall back to Render URL
    if (inWindow) {
        if (host.includes('vercel.app')) {
            return 'https://clinic-system-swzd.onrender.com';
        }
    }

    // Final fallback to localhost dev only.
    return (BUILD_API || 'http://localhost:8000').replace(/\/+$/, '');
}

export const API_BASE = runtimeResolveApiBase();

// Dev-only: expose API_BASE to help debug on mobile devices and ensure LAN resolution
if (import.meta.env.DEV && typeof window !== 'undefined') {
    type DebugWindow = Window & {
        __API_BASE?: string;
        __API_BASE_LOGGED?: boolean;
    };
    const w = window as DebugWindow;
    if (!w.__API_BASE_LOGGED) {
        w.__API_BASE = API_BASE;
        console.info('[api] API_BASE', API_BASE);
        w.__API_BASE_LOGGED = true;
    }
}
