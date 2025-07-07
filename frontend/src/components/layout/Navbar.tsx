// frontend\src\components\Navbar.tsx
import { useAuth } from "../../auth/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav style={{ display: "flex", justifyContent: "space-between", padding: "1rem", background: "#eee" }}>
      <h3 style={{ margin: 0, cursor: "pointer" }} onClick={() => navigate("/")}>
        Clinic System 🩺
      </h3>
      <button onClick={logout}>Sair</button>
    </nav>
  );
}
