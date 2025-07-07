// frontend\src\components\layout\DashboardLayout.tsx
import Navbar from "../layout/Navbar"; // Certifique-se que este já está pronto
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <div style={styles.container}>
      <Navbar />
      <main style={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    minHeight: "100vh",
  },
  content: {
    flex: 1,
    padding: "2rem",
    backgroundColor: "#f9f9f9",
  },
};