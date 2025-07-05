// src/auth/PrivateRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { PropsWithChildren } from "react";

export default function PrivateRoute({ children }: PropsWithChildren<{}>) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
}
