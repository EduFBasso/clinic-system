import React from 'react';
import type { ClientData } from '../types/ClientData';
import styles from '../styles/components/ClientView.module.css';
import { formatPhone } from '../utils/formatPhone';
import { formatDOBWithAge } from '../utils/dateOfBirth';

interface ClientViewProps {
    client: ClientData & {
        address_number?: string | null;
        date_of_birth?: string | null;
    };
}

const fieldOrder: Array<keyof ClientData> = [
    'first_name',
    'last_name',
    'sex',
    'phone',
    'email',
    'date_of_birth',
    'profession',
    'rg',
    'document_type',
    'document_number',
    'marital_status',
    'nationality',
];

const fieldLabels: Partial<Record<keyof ClientData, string>> = {
    first_name: 'Nome',
    last_name: 'Sobrenome',
    sex: 'Sexo',
    phone: 'Telefone',
    email: 'E-mail',
    date_of_birth: 'Data de Nascimento',
    profession: 'Profissão',
    rg: 'RG',
    document_type: 'Tipo de documento',
    document_number: 'Número do documento',
    marital_status: 'Estado civil',
    nationality: 'Nacionalidade',
};

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

const ClientView: React.FC<ClientViewProps> = ({ client }) => {
    const photoUrl = client.photo || null;
    const initials = React.useMemo(() => {
        const fn = String(client.first_name || '').trim();
        const ln = String(client.last_name || '').trim();
        const a = fn ? fn[0] : '';
        const b = ln ? ln[0] : '';
        return (a + b || 'C').toUpperCase();
    }, [client.first_name, client.last_name]);

    return (
        <div
            className={styles.clientViewCard}
            style={{
                background: 'var(--color-selected-bg)',
                border: '2px solid var(--color-selected-border)',
                boxShadow: '0 0 8px 2px var(--color-selected-border)',
                borderRadius: '12px',
                padding: '32px 24px',
                transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
            }}
        >
            <div className={styles.headerRow}>
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
                        aria-hidden
                        title={`${client.first_name} ${client.last_name}`}
                    >
                        {initials}
                    </div>
                )}
                <div style={{ minWidth: 0 }}>
                    <div
                        className={styles.clientName}
                        title={`${client.first_name} ${client.last_name}`}
                    >
                        {client.first_name} {client.last_name}
                    </div>
                </div>
            </div>

            <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Código:</span>
                <span className={styles.fieldValue}>{client.id}</span>
            </div>

            {fieldOrder.map(k => {
                const label = fieldLabels[k];
                if (!label) return null;

                const raw = client[k];
                const isEmpty = raw === null || raw === undefined || raw === '';
                if (isEmpty) return null;

                let value: string;
                if (k === 'date_of_birth') {
                    value = formatDOBWithAge(raw as string) || '-';
                } else if (k === 'phone') {
                    value = formatPhone(String(raw));
                } else if (k === 'sex') {
                    value = SEX_LABELS[raw as string] ?? String(raw);
                } else if (k === 'marital_status') {
                    value = MARITAL_LABELS[raw as string] ?? String(raw);
                } else if (k === 'document_type') {
                    value = DOC_TYPE_LABELS[raw as string] ?? String(raw);
                } else {
                    value = String(raw);
                }

                return (
                    <div className={styles.fieldRow} key={k}>
                        <span className={styles.fieldLabel}>{label}:</span>
                        <span className={styles.fieldValue}>{value}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default ClientView;

interface ClientViewProps {
    client: ClientData & {
        address_number?: string | null;
        date_of_birth?: string | null; // pode vir ISO ou dd/mm/YYYY
    };
}

// Definimos uma lista ordenada e labels; campos com render customizado tratados adiante
// Nota: ID (código) exibido manualmente antes desta lista para permitir label customizado "Código".
const fieldOrder: Array<keyof ClientData> = [
    'first_name',
    'last_name',
    'date_of_birth',
    'phone',
    'email',
    'profession',
    'address',
    'neighborhood',
    'city',
    'state',
    'postal_code',
    'sport_activity',
    'academic_activity',
    'takes_medication',
    'had_surgery',
    'is_pregnant',
    'pain_sensitivity',
    'clinical_history',
    'plantar_view_left',
    'plantar_view_right',
    'dermatological_pathologies_left',
    'dermatological_pathologies_right',
    'nail_changes_left',
    'nail_changes_right',
    'deformities_left',
    'deformities_right',
    'sensitivity_test',
    'other_procedures',
];

const fieldLabels: Partial<Record<keyof ClientData, string>> = {
    first_name: 'Nome',
    last_name: 'Sobrenome',
    date_of_birth: 'Data de Nascimento',
    email: 'E-mail',
    phone: 'Telefone',
    profession: 'Profissão',
    address: 'Endereço',
    neighborhood: 'Bairro',
    city: 'Cidade',
    state: 'Estado',
    postal_code: 'CEP',
    sport_activity: 'Pratica esportes?',
    academic_activity: 'Pratica academia?',
    takes_medication: 'Toma medicação?',
    had_surgery: 'Já fez cirurgia?',
    is_pregnant: 'Está grávida?',
    pain_sensitivity: 'Sensibilidade à dor',
    clinical_history: 'Histórico clínico',
    plantar_view_left: 'Vista plantar (pé esquerdo)',
    plantar_view_right: 'Vista plantar (pé direito)',
    dermatological_pathologies_left: 'Patologias dermatológicas (pé esquerdo)',
    dermatological_pathologies_right: 'Patologias dermatológicas (pé direito)',
    nail_changes_left: 'Alterações ungueais (pé esquerdo)',
    nail_changes_right: 'Alterações ungueais (pé direito)',
    deformities_left: 'Deformidades (pé esquerdo)',
    deformities_right: 'Deformidades (pé direito)',
    sensitivity_test: 'Teste de sensibilidade',
    other_procedures: 'Outros procedimentos / Observações',
};

function formatBirthAndAge(raw?: string | null): string {
    const formatted = formatDOBWithAge(raw);
    return formatted || '-';
}

function formatAddress(address?: string, number?: string): string {
    const a = (address || '').trim();
    const n = (number || '').trim();
    if (!a && !n) return '-';
    if (a && n) return `${a}, Nº ${n}`;
    return a || `Nº ${n}`;
}

const ClientView: React.FC<ClientViewProps> = ({ client }) => {
    const photoUrl = client.photo || null;
    const initials = React.useMemo(() => {
        const fn = String(client.first_name || '').trim();
        const ln = String(client.last_name || '').trim();
        const a = fn ? fn[0] : '';
        const b = ln ? ln[0] : '';
        return (a + b || 'C').toUpperCase();
    }, [client.first_name, client.last_name]);
    return (
        <div
            className={styles.clientViewCard}
            style={{
                background: 'var(--color-selected-bg)',
                border: '2px solid var(--color-selected-border)',
                boxShadow: '0 0 8px 2px var(--color-selected-border)',
                borderRadius: '12px',
                padding: '32px 24px',
                transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
            }}
        >
            {/* Foto do cliente (se houver) */}
            <div className={styles.headerRow}>
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
                        aria-hidden
                        title={`${client.first_name} ${client.last_name}`}
                    >
                        {initials}
                    </div>
                )}
                <div style={{ minWidth: 0 }}>
                    <div
                        className={styles.clientName}
                        title={`${client.first_name} ${client.last_name}`}
                    >
                        {client.first_name} {client.last_name}
                    </div>
                </div>
            </div>
            <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Código:</span>
                <span className={styles.fieldValue}>{client.id}</span>
            </div>
            {fieldOrder.map(k => {
                const label = fieldLabels[k];
                if (!label) return null; // segurança
                let value: string;
                if (k === 'date_of_birth') {
                    value = formatBirthAndAge(
                        client.date_of_birth || undefined,
                    );
                } else if (k === 'address') {
                    // Endereço + número
                    value = formatAddress(
                        client.address,
                        client.address_number || undefined,
                    );
                } else if (k === 'is_pregnant') {
                    const v = client.is_pregnant;
                    value = v === true ? 'Sim' : v === false ? 'Não' : '-';
                } else if (k === 'phone') {
                    const raw = (client.phone || '').toString();
                    value = raw ? formatPhone(raw) : '-';
                } else {
                    value = String((client[k] as unknown) ?? '-');
                }
                const labelSuffix = label.trim().endsWith('?') ? '' : ':';
                return (
                    <div className={styles.fieldRow} key={k}>
                        <span className={styles.fieldLabel}>
                            {label}
                            {labelSuffix}
                        </span>
                        <span className={styles.fieldValue}>{value}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default ClientView;
