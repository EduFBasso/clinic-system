// frontend\src\components\forms\CheckboxGroupWithOther.tsx
import { useState, useEffect } from "react";

interface CheckboxGroupWithOtherProps {
  label: string;
  name: string;
  options: string[];
  selectedValues: string[];
  otherValue?: string;
  onChange: (name: string, values: string[], otherValue?: string) => void;
}

export default function CheckboxGroupWithOther({
  label,
  name,
  options,
  selectedValues,
  otherValue = "",
  onChange,
}: CheckboxGroupWithOtherProps) {
  const [selected, setSelected] = useState<string[]>(selectedValues || []);
  const [showOther, setShowOther] = useState(selected.includes("Outros"));
  const [other, setOther] = useState(otherValue);

  useEffect(() => {
    setShowOther(selected.includes("Outros"));
  }, [selected]);

  const handleCheckboxChange = (value: string) => {
    let newSelected: string[];
    if (selected.includes(value)) {
      newSelected = selected.filter((item) => item !== value);
    } else {
      newSelected = [...selected, value];
    }
    setSelected(newSelected);
    onChange(name, newSelected, other);
  };

  const handleOtherChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setOther(val);
    onChange(name, selected, val);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <label>{label}</label>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        {options.map((opt) => (
          <label key={opt}>
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => handleCheckboxChange(opt)}
            />
            {opt}
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={selected.includes("Outros")}
            onChange={() => handleCheckboxChange("Outros")}
          />
          Outros
        </label>
        {showOther && (
          <input
            type="text"
            placeholder="Descreva outros..."
            value={other}
            onChange={handleOtherChange}
          />
        )}
      </div>
    </div>
  );
}