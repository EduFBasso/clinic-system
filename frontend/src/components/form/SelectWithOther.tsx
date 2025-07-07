// frontend\src\components\forms\SelectWithOther.tsx
import { useState, useEffect } from "react";

interface SelectWithOtherProps {
  label: string;
  name: string;
  options: string[];
  value?: string;
  otherValue?: string;
  onChange: (name: string, value: string, otherValue?: string) => void;
  required?: boolean;
}

export default function SelectWithOther({
  label,
  name,
  options,
  value = "",
  otherValue = "",
  onChange,
  required = false,
}: SelectWithOtherProps) {
  const [selected, setSelected] = useState(value);
  const [showOther, setShowOther] = useState(value === "Outros");

  useEffect(() => {
    setShowOther(selected === "Outros");
  }, [selected]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    setSelected(selectedValue);
    onChange(name, selectedValue);
  };

  const handleOtherChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(name, selected, e.target.value);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <label>
        {label}
        {required && <span style={{ color: "red" }}> *</span>}
      </label>
      <select name={name} value={selected} onChange={handleChange} required={required}>
        <option value="">Selecione</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        <option value="Outros">Outros</option>
      </select>
      {showOther && (
        <input
          type="text"
          value={otherValue}
          onChange={handleOtherChange}
          placeholder="Descreva aqui..."
        />
      )}
    </div>
  );
}