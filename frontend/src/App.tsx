// frontend\src\App.tsx

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from '../src/pages/Home';
import ClientFormPage from './pages/Clients/ClientFormPage';
import AgendaPage from './pages/AgendaPage';
import AgendaDetailsPage from './pages/AgendaDetailsPage';
import AgendaSettingsPage from './pages/AgendaSettingsPage';

function App() {
    return (
        <Router>
            <Routes>
                <Route path='/' element={<Home />} />
                <Route path='/clients/new' element={<ClientFormPage />} />
                <Route path='/clients/edit/:id' element={<ClientFormPage />} />
                <Route path='/agenda' element={<AgendaPage />} />
                <Route path='/agenda/details' element={<AgendaDetailsPage />} />
                <Route
                    path='/agenda/settings'
                    element={<AgendaSettingsPage />}
                />
            </Routes>
        </Router>
    );
}

export default App;
