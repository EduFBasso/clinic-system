// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Auth/Login";
import Dashboard from "./pages/Dashboard";
import ClientList from "./pages/Clients/ClientList";
import RegisterProfessional from "./pages/Auth/RegisterProfessional";
import NotFound from "./pages/NotFound";
import PrivateRoute from "./auth/PrivateRoute";
import { AuthProvider } from "./auth/AuthContext";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/clientes"
            element={
              <PrivateRoute>
                <ClientList />
              </PrivateRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PrivateRoute>
                <RegisterProfessional />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
