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
}

export default function ClientCard({
    client,
    onView,
    onEdit,
}: ClientCardProps) {
    return (
        <div
            className={styles.card}
            style={{
                background: 'var(--color-bg-section)',
                borderColor: 'var(--color-border)',
            }}
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
                    onClick={() => onView(client)}
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
                >
                    <FaEnvelope />
                </a>
            </div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: '12px',
                }}
            >
                <button
                    className={styles.editButton}
                    onClick={() => onEdit(client)}
                    style={{
                        background: 'var(--color-primary)',
                        color: 'var(--color-bg-section)',
                    }}
                >
                    Editar
                </button>
            </div>
        </div>
    );
}
