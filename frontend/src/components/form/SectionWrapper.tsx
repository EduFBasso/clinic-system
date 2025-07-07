// frontend\src\components\forms\SectionWrapper.tsx
import type { ReactNode } from "react";

interface SectionWrapperProps {
  title: string;
  children: ReactNode;
}

export default function SectionWrapper({ title, children }: SectionWrapperProps) {
  return (
    <section
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        padding: "1rem",
        marginBottom: "1.5rem",
        backgroundColor: "#fafafa",
      }}
    >
      <h3
        style={{
          marginBottom: "1rem",
          color: "#333",
          fontSize: "1.1rem",
          borderBottom: "1px solid #ccc",
          paddingBottom: "0.25rem",
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}