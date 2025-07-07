// src/auth/AuthContext.tsx
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("access_token")
  );
  const navigate = useNavigate();

  const handleSetToken = (newToken: string | null) => {
    setToken(newToken);
    if (newToken) {
      localStorage.setItem("access_token", newToken);
    } else {
      localStorage.removeItem("access_token");
    }
  };

  const logout = () => {
    handleSetToken(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ token, setToken: handleSetToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro do AuthProvider");
  return context;
}