// frontend\src\App.tsx

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from '../src/pages/Home';
// DesktopAgendaPage carregado de forma lazy; se falhar import (arquivo ausente na branch remota), renderiza Home.
import React from 'react';
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
import { useEffect } from 'react';
import ensureDeviceSession from './services/sessions';

function App() {
    useEffect(() => {
        // Pre-warm device session once app loads if token exists
        try {
            const token = localStorage.getItem('accessToken');
            if (token) ensureDeviceSession().catch(() => {});
        } catch {
            /* noop */
        }
    }, []);
    return (
        <Router>
            <Routes>
                <Route path='/' element={<Home />} />
                <Route path='/clients/new' element={<ClientFormPage />} />
                <Route path='/clients/edit/:id' element={<ClientFormPage />} />
                {/* AgendaPage removida: consolidamos em modais no Home */}
                <Route path='/agenda' element={<Home />} />
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
        </Router>
    );
}

export default App;
