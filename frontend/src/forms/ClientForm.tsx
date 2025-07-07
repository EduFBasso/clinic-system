// frontend\src\forms\ClientForm.tsx
import { useState } from "react";
import SectionWrapper from "../components/form/SectionWrapper";
import SelectWithOther from "../components/form/SelectWithOther";
import CheckboxGroupWithOther from "../components/form/CheckboxGroupWithOther";
import RadioWithDetails from "../components/form/RadioWithDetails";

interface ClientData {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  address_street: string;
  address_number: string;
  clinical_history: string[];
  clinical_history_other: string;
  footwear_used: string;
  footwear_other: string;
  takes_medication: boolean;
  medication_details: string;
}

interface ClientFormProps {
  onSubmit: (data: ClientData) => void;
  initialData?: Partial<ClientData>;
}

export default function ClientForm({ onSubmit, initialData = {} }: ClientFormProps) {
  const [form, setForm] = useState<ClientData>({
    first_name: initialData.first_name || "",
    last_name: initialData.last_name || "",
    phone: initialData.phone || "",
    email: initialData.email || "",
    city: initialData.city || "",
    state: initialData.state || "",
    address_street: initialData.address_street || "",
    address_number: initialData.address_number || "",
    clinical_history: initialData.clinical_history || [],
    clinical_history_other: initialData.clinical_history_other || "",
    footwear_used: initialData.footwear_used || "",
    footwear_other: initialData.footwear_other || "",
    takes_medication: initialData.takes_medication || false,
    medication_details: initialData.medication_details || "",
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <SectionWrapper title="Dados Pessoais">
        <input
          name="first_name"
          value={form.first_name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm({ ...form, first_name: e.target.value })
          }
          placeholder="Nome"
          required
        />
        <input
          name="last_name"
          value={form.last_name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm({ ...form, last_name: e.target.value })
          }
          placeholder="Sobrenome"
          required
        />
        <input
          name="phone"
          value={form.phone}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm({ ...form, phone: e.target.value })
          }
          placeholder="Telefone"
          required
        />
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm({ ...form, email: e.target.value })
          }
          placeholder="E-mail"
          required
        />
        <input
          name="city"
          value={form.city}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm({ ...form, city: e.target.value })
          }
          placeholder="Cidade"
          required
        />
        <input
          name="state"
          value={form.state}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm({ ...form, state: e.target.value })
          }
          placeholder="UF"
          maxLength={2}
          required
        />
        <input
          name="address_street"
          value={form.address_street}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm({ ...form, address_street: e.target.value })
          }
          placeholder="Rua"
          required
        />
        <input
          name="address_number"
          value={form.address_number}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm({ ...form, address_number: e.target.value })
          }
          placeholder="Número"
          required
        />
      </SectionWrapper>

      <SectionWrapper title="Histórico Clínico">
        <CheckboxGroupWithOther
          label="Comorbidades"
          name="clinical_history"
          options={["Diabetes", "Hipertensão", "Cardiopatia"]}
          selectedValues={form.clinical_history}
          otherValue={form.clinical_history_other}
          onChange={(
            name: string,
            selected: string[],
            other?: string
          ) => {
            setForm((prev) => ({
              ...prev,
              [name]: selected,
              clinical_history_other: selected.includes("Outros") ? other || "" : "",
            }));
          }}
        />

        <RadioWithDetails
          label="Faz uso de medicação contínua?"
          name="takes_medication"
          value={form.takes_medication}
          details={form.medication_details}
          onChange={(
            name: string,
            value: boolean,
            details?: string
          ) => {
            setForm((prev) => ({
              ...prev,
              [name]: value,
              medication_details: value ? details || "" : "",
            }));
          }}
        />
      </SectionWrapper>

      <SectionWrapper title="Calçado Mais Utilizado">
        <SelectWithOther
          label="Tipo de calçado"
          name="footwear_used"
          options={["Tênis", "Sandália", "Sapato social", "Salto alto", "Bico fino"]}
          value={form.footwear_used}
          otherValue={form.footwear_other}
          onChange={(
            name: string,
            selected: string,
            other?: string
          ) => {
            setForm((prev) => ({
              ...prev,
              [name]: selected,
              footwear_other: selected === "Outros" ? other || "" : "",
            }));
          }}
        />
      </SectionWrapper>

      <button type="submit">Salvar</button>
    </form>
  );
}