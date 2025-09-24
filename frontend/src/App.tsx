// frontend\src\App.tsx

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from '../src/pages/Home';
import DesktopAgendaPage from './pages/DesktopAgendaPage';
import ClientFormPage from './pages/Clients/ClientFormPage';
import { ServerTimeProvider } from './contexts/ServerTimeContext';

function App() {
    return (
        <ServerTimeProvider>
            <Router>
                <Routes>
                    <Route path='/' element={<Home />} />
                    <Route path='/clients/new' element={<ClientFormPage />} />
                    <Route
                        path='/clients/edit/:id'
                        element={<ClientFormPage />}
                    />
                    {/* AgendaPage removida: consolidamos em modais no Home */}
                    <Route path='/agenda' element={<Home />} />
                    {/* Full-page scheduler for mobile */}
                    {/** Rota /schedule removida para unificar experiência via modais */}
                    {/* Rota /agenda/settings removida */}
                    {/* Desktop unified agenda page */}
                    <Route path='/desktop' element={<DesktopAgendaPage />} />
                </Routes>
            </Router>
        </ServerTimeProvider>
    );
}

export default App;
