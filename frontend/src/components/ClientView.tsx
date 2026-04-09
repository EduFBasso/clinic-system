import React, { useEffect, useState } from 'react';
import type { ClientData } from '../types/ClientData';
import type {
    AnamnesisField,
    AnamnesisResponse,
} from '../types/AnamnesisTypes';
import styles from '../styles/components/ClientView.module.css';
import { formatPhone } from '../utils/formatPhone';
import { formatDOBWithAge } from '../utils/dateOfBirth';
import { formatCpf, formatCnpj, formatRg, formatCep } from '../utils/formatCpf';
import { API_BASE } from '../config/api';
import { useAnamnesisFields } from '../hooks/useAnamnesisFields';

interface ClientViewProps {
    client: ClientData & {
        address_number?: string | null;
        date_of_birth?: string | null;
    };
}

// ── label maps ──────────────────────────────────────────────────────────────

const SEX_LABELS: Record<string, string> = {
    masculino: 'Masculino',
    feminino: 'Feminino',
    outro: 'Outro',
    nao_informado: 'Prefiro não informar',
};

const MARITAL_LABELS: Record<string, string> = {
    solteiro: 'Solteiro(a)',
    casado: 'Casado(a)',
    divorciado: 'Divorciado(a)',
    viuvo: 'Viúvo(a)',
    uniao_estavel: 'União estável',
};

const DOC_TYPE_LABELS: Record<string, string> = {
    cpf: 'CPF',
    cnpj: 'CNPJ',
};

// ── helper: format a raw client field value ──────────────────────────────────

function formatField(
    k: keyof ClientData,
    raw: unknown,
    client: ClientData,
): string {
    if (k === 'date_of_birth') return formatDOBWithAge(raw as string) || '-';
    if (k === 'phone') return formatPhone(String(raw));
    if (k === 'sex') return SEX_LABELS[raw as string] ?? String(raw);
    if (k === 'marital_status')
        return MARITAL_LABELS[raw as string] ?? String(raw);
    if (k === 'document_type')
        return DOC_TYPE_LABELS[raw as string] ?? String(raw);
    if (k === 'document_number') {
        return client.document_type === 'cnpj'
            ? formatCnpj(String(raw))
            : formatCpf(String(raw));
    }
    if (k === 'rg') return formatRg(String(raw));
    if (k === 'postal_code') return formatCep(String(raw));
    return String(raw);
}

// ── sub-component: a read-only section panel ─────────────────────────────────

function ViewSection({
    eyebrow,
    title,
    rows,
}: {
    eyebrow: string;
    title: string;
    rows: { label: string; value: string }[];
}) {
    if (rows.length === 0) return null;
    return (
        <section data-theme='blue' className={styles.section}>
            <div className={styles.sectionInner}>
                <header className={styles.sectionHeader}>
                    <span className={styles.eyebrow}>{eyebrow}</span>
                    <h2 className={styles.sectionTitle}>{title}</h2>
                </header>
                <div className={styles.fieldGrid}>
                    {rows.map(({ label, value }) => (
                        <div className={styles.fieldRow} key={label}>
                            <span className={styles.fieldLabel}>{label}</span>
                            <span className={styles.fieldValue}>{value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── main component ───────────────────────────────────────────────────────────

const ClientView: React.FC<ClientViewProps> = ({ client }) => {
    const photoUrl = client.photo || null;
    const initials = React.useMemo(() => {
        const fn = String(client.first_name || '').trim();
        const ln = String(client.last_name || '').trim();
        return ((fn[0] ?? '') + (ln[0] ?? '') || 'C').toUpperCase();
    }, [client.first_name, client.last_name]);

    // Load anamnesis fields (schema) and responses (values for this client)
    const { fields } = useAnamnesisFields();
    const [responses, setResponses] = useState<AnamnesisResponse[]>([]);

    useEffect(() => {
        if (!client.id) return;
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        fetch(`${API_BASE}/anamnesis/responses/?client=${client.id}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => (r.ok ? r.json() : []))
            .then((data: AnamnesisResponse[]) => setResponses(data))
            .catch(() => {
                /* silent */
            });
    }, [client.id]);

    // Build a map fieldId → value for quick lookup
    const responseMap = React.useMemo(() => {
        const m: Record<number, string> = {};
        responses.forEach(r => {
            if (r.field !== null) m[r.field] = r.value;
        });
        return m;
    }, [responses]);

    // ── Dados Pessoais rows ──────────────────────────────────────────────────
    const personalFields: Array<[keyof ClientData, string]> = [
        ['first_name', 'Nome'],
        ['last_name', 'Sobrenome'],
        ['sex', 'Sexo'],
        ['phone', 'Telefone'],
        ['email', 'E-mail'],
        ['date_of_birth', 'Data de Nascimento'],
        ['profession', 'Profissão'],
        ['rg', 'RG'],
        ['document_type', 'Tipo de documento'],
        ['document_number', 'Número do documento'],
        ['marital_status', 'Estado civil'],
        ['nationality', 'Nacionalidade'],
    ];

    const personalRows = personalFields
        .filter(([k]) => {
            const v = client[k];
            return v !== null && v !== undefined && v !== '';
        })
        .map(([k, label]) => ({
            label,
            value: formatField(k, client[k], client as ClientData),
        }));

    // Add Código at the top
    if (client.id) {
        personalRows.unshift({ label: 'Código', value: String(client.id) });
    }

    // ── Endereço rows ────────────────────────────────────────────────────────
    const addressFields: Array<[keyof ClientData, string]> = [
        ['postal_code', 'CEP'],
        ['address', 'Rua'],
        ['address_number', 'Número'],
        ['neighborhood', 'Bairro'],
        ['city', 'Cidade'],
        ['state', 'Estado'],
    ];

    const addressRows = addressFields
        .filter(([k]) => {
            const v = client[k];
            return v !== null && v !== undefined && v !== '';
        })
        .map(([k, label]) => ({
            label,
            value: formatField(k, client[k], client as ClientData),
        }));

    // ── Anamnese sectors ─────────────────────────────────────────────────────
    const sectorMap = new Map<
        string,
        { order: number; fields: AnamnesisField[] }
    >();
    for (const f of fields) {
        if (!sectorMap.has(f.sector)) {
            sectorMap.set(f.sector, { order: f.sector_order, fields: [] });
        }
        sectorMap.get(f.sector)!.fields.push(f);
    }
    const sectors = Array.from(sectorMap.entries()).sort(
        (a, b) => a[1].order - b[1].order,
    );

    return (
        <div className={styles.viewRoot}>
            {/* ── Header: avatar + nome ── */}
            <div data-theme='blue' className={styles.headerCard}>
                {photoUrl ? (
                    <img
                        src={photoUrl}
                        alt={`Foto de ${client.first_name} ${client.last_name}`}
                        className={styles.avatar}
                        loading='lazy'
                        decoding='async'
                        onError={ev => {
                            try {
                                (
                                    ev.currentTarget as HTMLImageElement
                                ).style.display = 'none';
                            } catch {
                                /* noop */
                            }
                        }}
                    />
                ) : (
                    <div
                        className={styles.avatarFallback}
                        data-avatar-fallback
                        aria-hidden
                    >
                        {initials}
                    </div>
                )}
                <div>
                    <div className={styles.clientName}>
                        {client.first_name} {client.last_name}
                    </div>
                    {client.phone && (
                        <div className={styles.clientSubtitle}>
                            {formatPhone(String(client.phone))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Dados Pessoais ── */}
            <ViewSection
                eyebrow='Visualização'
                title='Dados Pessoais'
                rows={personalRows}
            />

            {/* ── Endereço ── */}
            <ViewSection
                eyebrow='Visualização'
                title='Endereço'
                rows={addressRows}
            />

            {/* ── Anamnese ── */}
            {fields.length > 0 && (
                <section data-theme='blue' className={styles.section}>
                    <div className={styles.sectionInner}>
                        <header className={styles.sectionHeader}>
                            <span className={styles.eyebrow}>Visualização</span>
                            <h2 className={styles.sectionTitle}>Anamnese</h2>
                        </header>
                        {sectors.map(
                            ([sectorName, { fields: sectorFields }]) => {
                                const sectorRows = sectorFields
                                    .sort((a, b) => a.order - b.order)
                                    .filter(
                                        f =>
                                            responseMap[f.id] !== undefined &&
                                            responseMap[f.id] !== '',
                                    )
                                    .map(f => ({
                                        label: f.label,
                                        value: responseMap[f.id],
                                    }));
                                if (sectorRows.length === 0) return null;
                                return (
                                    <div
                                        key={sectorName}
                                        className={styles.anamnesisGroup}
                                    >
                                        <h3
                                            className={
                                                styles.anamnesisGroupTitle
                                            }
                                        >
                                            {sectorName}
                                        </h3>
                                        <div className={styles.fieldGrid}>
                                            {sectorRows.map(
                                                ({ label, value }) => (
                                                    <div
                                                        className={
                                                            styles.fieldRow
                                                        }
                                                        key={label}
                                                    >
                                                        <span
                                                            className={
                                                                styles.fieldLabel
                                                            }
                                                        >
                                                            {label}
                                                        </span>
                                                        <span
                                                            className={
                                                                styles.fieldValue
                                                            }
                                                        >
                                                            {value}
                                                        </span>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                );
                            },
                        )}
                    </div>
                </section>
            )}
        </div>
    );
};

export default ClientView;
