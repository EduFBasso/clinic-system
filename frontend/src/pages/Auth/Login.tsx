// frontend/src/pages/Auth/Login.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";
import type { Professional } from "../../types/models";

export default function Login() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { setToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchProfessionals() {
      try {
        const response = await api.get("/professionals-basic/");
        setProfessionals(response.data);
      } catch (err) {
        console.error("Erro ao buscar profissionais:", err);
        setError("Não foi possível carregar a lista de profissionais.");
      }
    }

    fetchProfessionals();
  }, []);

  const handleLogin = async () => {
    if (!selectedEmail || !code) {
      alert("Preencha o e-mail e o código.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/token/", {
        email: selectedEmail,
        code,
      });
      const accessToken = response.data.access;
      setToken(accessToken);
      navigate("/");
    } catch (err) {
      console.error("Erro ao efetuar login:", err);
      alert("Código inválido ou profissional não encontrado.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCode = async () => {
    if (!selectedEmail) {
      alert("Selecione um profissional primeiro.");
      return;
    }

    try {
      await api.post("/auth/request-code/", {
        email: selectedEmail,
      });
      alert("Código enviado com sucesso.");
    } catch (err) {
      console.error("Erro ao solicitar código:", err);
      alert("Erro ao enviar código. Verifique o email selecionado.");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "4rem auto" }}>
      <h2>Login de Profissional</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <label>Selecione seu nome:</label>
      <select
        value={selectedEmail}
        onChange={(e) => setSelectedEmail(e.target.value)}
        style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
      >
        <option value="">-- Escolha um profissional --</option>
        {professionals.map((prof) => (
          <option key={prof.id} value={prof.email}>
            {prof.first_name} {prof.last_name}
          </option>
        ))}
      </select>

      <button
        onClick={handleRequestCode}
        style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
      >
        Enviar código
      </button>

      <label>Código recebido:</label>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Digite o código"
        style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
      />

      <button
        onClick={handleLogin}
        style={{ width: "100%", padding: "0.5rem" }}
        disabled={loading}
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </div>
  );
}