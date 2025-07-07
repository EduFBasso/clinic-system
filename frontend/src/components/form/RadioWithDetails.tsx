// frontend\src\components\forms\RadioWithDetails.tsx
import { useState, useEffect } from "react";

interface RadioWithDetailsProps {
  label: string;
  name: string;
  value?: boolean;
  details?: string;
  onChange: (name: string, value: boolean, details?: string) => void;
  required?: boolean;
}

export default function RadioWithDetails({
  label,
  name,
  value = false,
  details = "",
  onChange,
  required = false,
}: RadioWithDetailsProps) {
  const [selected, setSelected] = useState<boolean>(value);
  const [detailText, setDetailText] = useState(details);

  useEffect(() => {
    onChange(name, selected, selected ? detailText : "");
  }, [selected, detailText]);

  const handleRadioChange = (val: boolean) => {
    setSelected(val);
    if (!val) setDetailText("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <label>
        {label}
        {required && <span style={{ color: "red" }}> *</span>}
      </label>
      <div style={{ display: "flex", gap: "1rem" }}>
        <label>
          <input
            type="radio"
            name={name}
            checked={selected === true}
            onChange={() => handleRadioChange(true)}
          />
          Sim
        </label>
        <label>
          <input
            type="radio"
            name={name}
            checked={selected === false}
            onChange={() => handleRadioChange(false)}
          />
          Não
        </label>
      </div>
      {selected && (
        <textarea
          placeholder="Descreva detalhes..."
          value={detailText}
          onChange={(e) => setDetailText(e.target.value)}
          rows={3}
        />
      )}
    </div>
  );
}