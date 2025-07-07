// frontend\src\pages\RegisterProfessional.tsx
import { useState } from "react";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";
import Navbar from "../../components/layout/Navbar";

export default function RegisterProfessional() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const { token } = useAuth();
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(
        "/professionals/",
        { name, email },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setSuccess(true);
      setName("");
      setEmail("");
    } catch (error) {
      console.error("Erro ao registrar profissional:", error);
      alert("Erro ao salvar. Verifique os dados ou a autorização.");
    }
  };

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 400, margin: "2rem auto" }}>
        <h2>👨‍⚕️ Cadastrar Profissional</h2>
        {success && (
          <p style={{ color: "green" }}>Profissional cadastrado com sucesso!</p>
        )}

        <form onSubmit={handleSubmit}>
          <label>Nome:</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
          />

          <label>Email:</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
          />

          <button type="submit" style={{ width: "100%", padding: "0.5rem" }}>
            Cadastrar
          </button>
        </form>
      </div>
    </>
  );
}
