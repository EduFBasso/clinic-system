import React, { useEffect, useState } from "react";
import api from "../api/api";
import Navbar from "../components/Navbar";

interface Client {
  id: number;
  nome: string;
  email: string;
  telefone: string;
}

export default function ClientList() {
  const [clientes, setClientes] = useState<Client[]>([]);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    api
      .get("/clients/")
      .then((res) => setClientes(res.data))
      .catch((err) => console.error("Erro:", err));
  }, []);

  const filtrados = clientes.filter((c) =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div>
      <Navbar />
      <div style={{ padding: "2rem" }}>
        <h2>Clientes</h2>
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{
            padding: "0.5rem",
            width: "100%",
            maxWidth: "300px",
            marginBottom: "1rem",
          }}
        />
        <ul>
          {filtrados.map((c) => (
            <li key={c.id}>
              <strong>{c.nome}</strong> – {c.email} – {c.telefone}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}