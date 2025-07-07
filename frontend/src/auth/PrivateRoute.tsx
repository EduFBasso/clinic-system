// src/auth/PrivateRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { ReactNode } from "react"; // ✅ novo import

export default function PrivateRoute({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
}