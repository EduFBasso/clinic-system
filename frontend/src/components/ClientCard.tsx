// frontend\src\components\ClientCard.tsx
import React from 'react';
import styles from '../styles/components/ClientCard.module.css';
import { FaEye, FaWhatsapp, FaEnvelope } from 'react-icons/fa';
import type { ClientBasic } from '../types/ClientBasic';
import { formatPhone } from '../utils/formatPhone';
import '../styles/palette.css';

interface ClientCardProps {
    client: ClientBasic;
    onView: (client: ClientBasic) => void;
    onEdit: (client: ClientBasic) => void;
    selected?: boolean;
    onSelect?: () => void;
}

export default function ClientCard({
    client,
    onView,
    onEdit,
    selected,
    onSelect,
}: ClientCardProps) {
    return (
        <div
            className={styles.card}
            style={{
                background: selected
                    ? 'var(--color-selected-bg)'
                    : 'var(--color-bg-section)',
                border: selected
                    ? '2px solid var(--color-selected-border)'
                    : '1px solid var(--color-border)',
                boxShadow: selected
                    ? '0 0 8px 2px var(--color-selected-border)'
                    : '0 1px 4px rgba(0,0,0,0.08)',
                transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
                cursor: 'pointer',
            }}
            onClick={onSelect}
        >
            <div className={styles.infoRow}>
                <span
                    className={styles.label}
                    style={{
                        color: 'var(--color-primary)',
                        fontWeight: 'bold',
                    }}
                >
                    Nome:
                </span>
                <span
                    className={styles.value}
                    style={{ color: 'var(--color-text)' }}
                >
                    {client.first_name} {client.last_name}
                </span>
                <button
                    className={styles.iconButton}
                    title='Visualizar detalhes'
                    onClick={e => {
                        e.stopPropagation();
                        onView(client);
                    }}
                >
                    <FaEye />
                </button>
            </div>
            <div className={styles.infoRow}>
                <span
                    className={styles.label}
                    style={{
                        color: 'var(--color-primary)',
                        fontWeight: 'bold',
                    }}
                >
                    Tel:
                </span>
                <span
                    className={styles.value}
                    style={{ color: 'var(--color-text)' }}
                >
                    {formatPhone(client.phone)}
                </span>
                <a
                    className={styles.iconButton}
                    title='WhatsApp'
                    href={`https://wa.me/${
                        client.phone ? client.phone.replace(/\D/g, '') : ''
                    }`}
                    target='_blank'
                    rel='noopener noreferrer'
                    onClick={e => e.stopPropagation()}
                >
                    <FaWhatsapp />
                </a>
            </div>
            <div className={styles.infoRow}>
                <span
                    className={styles.label}
                    style={{
                        color: 'var(--color-primary)',
                        fontWeight: 'bold',
                    }}
                >
                    E-mail:
                </span>
                <span
                    className={styles.value}
                    style={{ color: 'var(--color-text)' }}
                >
                    {client.email}
                </span>
                <a
                    className={styles.iconButton}
                    title='E-mail'
                    href={`mailto:${client.email}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    onClick={e => e.stopPropagation()}
                >
                    <FaEnvelope />
                </a>
            </div>
            {/* Botão Editar removido para liberar espaço e priorizar seleção */}
        </div>
    );
}
