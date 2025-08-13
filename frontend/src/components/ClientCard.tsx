// frontend\src\components\ClientCard.tsx
import React from 'react';
import styles from '../styles/components/ClientCard.module.css';
import { FaEye, FaWhatsapp, FaEnvelope } from 'react-icons/fa';
import type { ClientData } from '../types/ClientData';

interface ClientCardProps {
    client: ClientData;
    onView: (client: ClientData) => void;
    onEdit: (client: ClientData) => void;
}

export default function ClientCard({
    client,
    onView,
    onEdit,
}: ClientCardProps) {
    return (
        <div className={styles.card}>
            <div className={styles.infoRow}>
                <span className={styles.label}>Nome:</span>
                <span className={styles.value}>
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
                <span className={styles.label}>Tel:</span>
                <span className={styles.value}>{client.phone}</span>
                <a
                    className={styles.iconButton}
                    title='WhatsApp'
                    href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    <FaWhatsapp />
                </a>
            </div>
            <div className={styles.infoRow}>
                <span className={styles.label}>E-mail:</span>
                <span className={styles.value}>{client.email}</span>
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
            <button
                className={styles.editButton}
                onClick={() => onEdit(client)}
            >
                Editar
            </button>
        </div>
    );
}
