// frontend/src/contexts/ThemeContext.tsx
//
// Persistência de tema por profissional via backend:
//   - No login, o objeto `loggedProfessional` já vem com `ui_theme` do servidor.
//   - setTheme() aplica imediatamente no DOM, atualiza loggedProfessional no
//     localStorage e envia PATCH /register/professionals/me/ de forma assíncrona.
//   - Todos os dispositivos do mesmo profissional ficam sincronizados no próximo login.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_BASE } from '../config/api';

export type AppTheme = 'blue' | 'green' | 'pink' | 'black';

const VALID_THEMES: AppTheme[] = ['blue', 'green', 'pink', 'black'];
const DEFAULT_THEME: AppTheme = 'blue';

const THEME_META_COLOR: Record<AppTheme, string> = {
    blue: '#004aad',
    green: '#15803d',
    pink: '#be185d',
    black: '#0d1117',
};

function applyThemeMetaColor(theme: AppTheme) {
    if (typeof document === 'undefined') return;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute('content', THEME_META_COLOR[theme]);
        return;
    }
    const created = document.createElement('meta');
    created.setAttribute('name', 'theme-color');
    created.setAttribute('content', THEME_META_COLOR[theme]);
    document.head.appendChild(created);
}

function applyThemeToDom(theme: AppTheme) {
    document.documentElement.setAttribute('data-theme', theme);
    applyThemeMetaColor(theme);
}

function readThemeFromStorage(): AppTheme {
    try {
        const raw = localStorage.getItem('loggedProfessional');
        if (!raw) return DEFAULT_THEME;
        const prof = JSON.parse(raw) as { ui_theme?: string };
        if (prof.ui_theme && (VALID_THEMES as string[]).includes(prof.ui_theme)) {
            return prof.ui_theme as AppTheme;
        }
    } catch {
        /* noop */
    }
    return DEFAULT_THEME;
}

/** Salva ui_theme no objeto loggedProfessional em cache (sem network). */
function patchStoredTheme(theme: AppTheme) {
    try {
        const raw = localStorage.getItem('loggedProfessional');
        if (!raw) return;
        const prof = JSON.parse(raw) as Record<string, unknown>;
        prof.ui_theme = theme;
        localStorage.setItem('loggedProfessional', JSON.stringify(prof));
    } catch {
        /* noop */
    }
}

/** Envia PATCH /register/professionals/me/ { ui_theme } de forma silenciosa. */
function persistThemeToBackend(theme: AppTheme) {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    fetch(`${API_BASE}/register/professionals/me/`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ui_theme: theme }),
    }).catch(() => {
        // Silencioso: falha de rede não deve bloquear a UI
    });
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface ThemeContextValue {
    theme: AppTheme;
    setTheme: (theme: AppTheme) => void;
}

const ThemeContextStrict = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<AppTheme>(() => {
        const loaded = readThemeFromStorage();
        applyThemeToDom(loaded);
        return loaded;
    });

    // Sincroniza quando login/logout ou outra aba atualiza o localStorage
    useEffect(() => {
        const sync = () => {
            const loaded = readThemeFromStorage();
            setThemeState(loaded);
            applyThemeToDom(loaded);
        };

        window.addEventListener('auth:login', sync);
        window.addEventListener('auth:logout', sync);
        window.addEventListener('storage', sync);

        return () => {
            window.removeEventListener('auth:login', sync);
            window.removeEventListener('auth:logout', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const setTheme = useCallback((newTheme: AppTheme) => {
        setThemeState(newTheme);
        applyThemeToDom(newTheme);
        patchStoredTheme(newTheme);
        persistThemeToBackend(newTheme);
    }, []);

    return (
        <ThemeContextStrict.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContextStrict.Provider>
    );
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContextStrict);
    if (!ctx) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return ctx;
}
