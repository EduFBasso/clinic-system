// frontend\src\App.tsx

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from '../src/pages/Home';
import ClientListPage from './pages/Clients/ClientListPage';
import ClientFormPage from './pages/Clients/ClientFormPage';

function App() {
    return (
        <Router>
            <Routes>
                <Route path='/' element={<Home />} />
                <Route path='/clients' element={<ClientListPage />} />
                <Route path='/clients/new' element={<ClientFormPage />} />
                {/* Futuramente: <Route path='/clients/:id/edit' element={<ClientFormPage />} /> */}
            </Routes>
        </Router>
    );
}

export default App;
