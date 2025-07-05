import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Navbar() {
  const { setToken } = useAuth();
  const navigate = useNavigate();

  const logout = () => {
    setToken(null);
    navigate("/login");
  };

  return (
    <nav
      style={{
        background: "#1976D2",
        padding: "1rem",
        color: "white",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <h2 style={{ margin: 0 }}>Sistema da Clínica</h2>
      <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
        <Link to="/" style={{ color: "white", textDecoration: "none" }}>
          🏠 Início
        </Link>
        <Link to="/clientes" style={{ color: "white", textDecoration: "none" }}>
          👤 Clientes
        </Link>
        <button
          onClick={logout}
          style={{
            background: "white",
            color: "#1976D2",
            border: "none",
            padding: "0.5rem 1rem",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Sair
        </button>
      </div>
    </nav>
  );
}