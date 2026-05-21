// frontend\src\App.tsx

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from '../src/pages/Home';
// DesktopAgendaPage carregado de forma lazy; se falhar import (arquivo ausente na branch remota), renderiza Home.
import React from 'react';
import { on } from './events/bus';
import { SystemMessageModal } from './components/SystemMessageModal/SystemMessageModal';
const LazyDesktopAgenda: React.ComponentType = React.lazy(async () => {
    try {
        return (await import('./pages/DesktopAgendaPage')) as unknown as {
            default: React.ComponentType;
        };
    } catch {
        return { default: () => null } as { default: React.ComponentType };
    }
});
import ClientFormPage from './pages/Clients/ClientFormPage';
import AdminPage from './pages/AdminPage';
import { useEffect } from 'react';
import ensureDeviceSession from './services/sessions';
import ProductFormPage from './pages/Catalog/ProductFormPage';
import ServiceFormPage from './pages/Catalog/ServiceFormPage';
import ProductListPage from './pages/Catalog/ProductListPage';
import ServiceListPage from './pages/Catalog/ServiceListPage';
import ConsultaPage from './pages/ConsultaPage';
import OdontoArcadeSimplifiedPage from './pages/OdontoArcadeSimplifiedPage';
import {
    hydrateAgendaSettings,
    resetAgendaSettings,
} from './utils/agendaSettings';
import { ThemeProvider } from './contexts/ThemeContext';
import { getAccessToken } from './utils/auth/session';

function App() {
    const [sysMsg, setSysMsg] = React.useState<{
        text: string;
        type: 'success' | 'error' | 'info' | 'warning';
        autoCloseMs?: number;
    } | null>(null);

    useEffect(() => {
        // Pre-warm device session once app loads if token exists
        try {
            const token = getAccessToken();
            if (token) {
                ensureDeviceSession().catch(() => {});
                hydrateAgendaSettings().catch(() => {});
            } else {
                resetAgendaSettings();
            }
        } catch {
            /* noop */
        }

        const handleLogin = () => {
            hydrateAgendaSettings(true).catch(() => {});
        };
        const handleLogout = () => {
            resetAgendaSettings();
        };

        const disposeLogin = on('auth:login', handleLogin);
        const disposeLogout = on('auth:logout', handleLogout);

        return () => {
            disposeLogin();
            disposeLogout();
        };
    }, []);

    useEffect(() => {
        const disposeSystemMessage = on('systemMessage', detail => {
            if (!detail?.text) return;
            setSysMsg({
                text: String(detail.text),
                type: detail.type || 'info',
                autoCloseMs: detail.autoCloseMs,
            });
        });

        return () => {
            disposeSystemMessage();
        };
    }, []);

    return (
        <ThemeProvider>
            <Router>
                <Routes>
                    <Route path='/' element={<Home />} />
                    <Route path='/clients/new' element={<ClientFormPage />} />
                    <Route path='/clients/edit/:id' element={<ClientFormPage />} />
                    {/* AgendaPage removida: consolidamos em modais no Home */}
                    <Route path='/agenda' element={<Home />} />
                    <Route
                        path='/catalog/products/new'
                        element={<ProductFormPage />}
                    />
                    <Route
                        path='/catalog/products/:id'
                        element={<ProductFormPage />}
                    />
                    <Route
                        path='/catalog/services/new'
                        element={<ServiceFormPage />}
                    />
                    <Route
                        path='/catalog/services/:id'
                        element={<ServiceFormPage />}
                    />
                    <Route path='/catalog/products' element={<ProductListPage />} />
                    <Route path='/catalog/services' element={<ServiceListPage />} />
                    <Route path='/admin' element={<AdminPage />} />
                    <Route path='/consulta' element={<ConsultaPage />} />
                    <Route
                        path='/odonto/arcada/:clientId'
                        element={<OdontoArcadeSimplifiedPage />}
                    />
                    {/* Full-page scheduler for mobile */}
                    {/** Rota /schedule removida para unificar experiência via modais */}
                    {/* Rota /agenda/settings removida */}
                    {/* Desktop unified agenda page */}
                    <Route
                        path='/desktop'
                        element={
                            <React.Suspense fallback={<div />}>
                                <LazyDesktopAgenda />
                            </React.Suspense>
                        }
                    />
                </Routes>
                <SystemMessageModal
                    open={!!sysMsg}
                    message={sysMsg?.text || null}
                    type={sysMsg?.type || 'info'}
                    onClose={() => setSysMsg(null)}
                    autoCloseMs={sysMsg?.autoCloseMs ?? 10000}
                />
            </Router>
        </ThemeProvider>
    );
}

export default App;
