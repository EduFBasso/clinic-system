// Resolve API base: prefer compile-time VITE_API_BASE, but if the build didn't embed
// it (or points to a local dev address), fall back at runtime. This helps when
// the deployed static site was built without the env var or in a different root.
const BUILD_API = import.meta.env.VITE_API_BASE as string | undefined;

function runtimeResolveApiBase(): string {
    // If build provided a valid absolute URL, use it.
    if (BUILD_API && BUILD_API.startsWith('http')) return BUILD_API;

    // Runtime: if we're running inside Vercel preview/prod domain, prefer the
    // known backend on Render. This covers cases where the static bundle was
    // deployed but not rebuilt with VITE_API_BASE set.
    if (typeof window !== 'undefined') {
        const host = window.location.hostname || '';
        if (host.includes('vercel.app') || host.endsWith('.vercel.sh')) {
            return 'https://clinic-system-swzd.onrender.com';
        }
    }

    // Final fallback to local dev machine address used in development.
    return BUILD_API || 'http://192.168.0.108:8000';
}

export const API_BASE = runtimeResolveApiBase();
