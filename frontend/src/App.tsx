import ClientList from "./pages/ClientList";
import PrivateRoute from "./auth/PrivateRoute";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// dentro de <Routes>:
<Route
  path="/clientes"
  element={
    <PrivateRoute>
      <ClientList />
    </PrivateRoute>
  }
/>