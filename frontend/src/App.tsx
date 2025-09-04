// frontend\src\App.tsx

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from '../src/pages/Home';
import ClientFormPage from './pages/Clients/ClientFormPage';

function App() {
    return (
        <Router>
            <Routes>
                <Route path='/' element={<Home />} />
                <Route path='/clients/new' element={<ClientFormPage />} />
                <Route path='/clients/edit/:id' element={<ClientFormPage />} />
                {/* AgendaPage removida: consolidamos em modais no Home */}
                <Route path='/agenda' element={<Home />} />
                {/* Rota /agenda/settings removida */}
            </Routes>
        </Router>
    );
}

export default App;
