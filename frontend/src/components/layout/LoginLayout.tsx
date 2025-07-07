// frontend\src\components\layout\LoginLayout.tsx
import type { ReactNode } from "react";

interface LoginLayoutProps {
  children: ReactNode;
}

export default function LoginLayout({ children }: LoginLayoutProps) {
  return (
    <div style={styles.container}>
      <div style={styles.left}>
        <h1 style={styles.title}>Sistema da Clínica</h1>
        <p style={styles.subtitle}>Bem-vindo(a) ao seu espaço profissional</p>
      </div>
      <div style={styles.right}>
        {children}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    flexDirection: "row" as const,
  },
  left: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    padding: "4rem 2rem",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "center",
  },
  right: {
    flex: 1,
    padding: "4rem 2rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: "2.5rem",
    marginBottom: "1rem",
  },
  subtitle: {
    fontSize: "1.2rem",
    color: "#666",
    textAlign: "center" as const,
    maxWidth: "300px",
  },
};