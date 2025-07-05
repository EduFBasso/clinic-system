import Navbar from "../components/Navbar";

export default function Dashboard() {
  return (
    <div>
      <Navbar />
      <section style={{ padding: "2rem" }}>
        <h2>Bem-vindo ao sistema!</h2>
        <p>Escolha uma opção acima para começar.</p>
      </section>
    </div>
  );
}