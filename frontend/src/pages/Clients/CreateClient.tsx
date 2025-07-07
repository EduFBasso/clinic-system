// frontend\src\pages\Clients\CreateClient.tsx
import { useEffect, useState } from "react";
import type { Client } from "../../types/models";
// frontend\src\types\models.ts


import api from "../../api/api"; // axios.create()

export default function ClientList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClients() {
      try {
        const response = await api.get("/clients/");
        setClients(response.data);
      } catch (error) {
        console.error("Erro ao buscar clientes:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchClients();
  }, []);

  if (loading) {
    return <p>Carregando clientes...</p>;
  }

  return (
    <div>
      <h2>Lista de Clientes</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={cell}>Nome</th>
            <th style={cell}>CPF</th>
            <th style={cell}>Telefone</th>
            {/* Ações futuras: editar, excluir */}
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id}>
              <td style={cell}>{client.name}</td>
              <td style={cell}>{client.cpf}</td>
              <td style={cell}>{client.phone}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cell = {
  padding: "0.5rem",
  borderBottom: "1px solid #ddd",
};