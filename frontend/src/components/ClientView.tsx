import React from 'react';
import type { ClientData } from '../types/ClientData';
import styles from '../styles/components/ClientView.module.css';

interface ClientViewProps {
    client: ClientData;
}

const fieldLabels: Record<keyof ClientData, string> = {
    id: 'ID',
    first_name: 'Nome',
    last_name: 'Sobrenome',
    email: 'E-mail',
    phone: 'Telefone',
    cpf: 'CPF',
    address_street: 'Rua',
    address_number: 'Número',
    city: 'Cidade',
    state: 'Estado',
    postal_code: 'CEP',
    footwear_used: 'Calçado usado',
    sock_used: 'Meia usada',
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

const ClientView: React.FC<ClientViewProps> = ({ client }) => {
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
            {Object.entries(fieldLabels).map(([key, label]) => (
                <div className={styles.fieldRow} key={key}>
                    <span className={styles.fieldLabel}>{label}:</span>
                    <span className={styles.fieldValue}>
                        {String(client[key as keyof ClientData] ?? '-')}
                    </span>
                </div>
            ))}
        </div>
    );
};

export default ClientView;
