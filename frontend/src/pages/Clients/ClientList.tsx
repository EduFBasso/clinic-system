// frontend\src\pages\ClientList.tsx
import { useEffect, useState } from "react";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";
import Navbar from "../../components/layout/Navbar";

interface Client {
  id: number;
  name: string;
  phone: string;
}

export default function ClientList() {
  const [clients, setClients] = useState<Client[]>([]);
  const { token } = useAuth();

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await api.get("/clients/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setClients(response.data);
      } catch (error) {
        console.error("Erro ao buscar clientes:", error);
      }
    };
    fetchClients();
  }, [token]);

  return (
    <>
      <Navbar />
      <div style={{ padding: "2rem" }}>
        <h2>👥 Lista de Clientes</h2>
        {clients.length === 0 ? (
          <p>Nenhum cliente encontrado.</p>
        ) : (
          <ul>
            {clients.map((client) => (
              <li key={client.id}>
                <strong>{client.name}</strong> - {client.phone}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
