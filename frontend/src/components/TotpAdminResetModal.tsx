import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import AppModal from './Modal';
import { API_BASE } from '../config/api';
import '../styles/modal-message.css';

interface ProfessionalOption {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
}

const TotpAdminResetModal: React.FC<Props> = ({ open, onClose }) => {
    const [professionals, setProfessionals] = useState<ProfessionalOption[]>(
        [],
    );
    const [loadingList, setLoadingList] = useState(false);
    const [selectedId, setSelectedId] = useState<number | ''>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [resetName, setResetName] = useState('');

    useEffect(() => {
        if (!open) return;
        setSelectedId('');
        setError('');
        setQrDataUrl('');
        setLoadingList(true);
        const token = localStorage.getItem('accessToken') ?? '';
        fetch(`${API_BASE}/register/professionals/`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.json())
            .then((data: ProfessionalOption[]) =>
                setProfessionals(Array.isArray(data) ? data : data),
            )
            .catch(() => setError('Erro ao carregar lista de profissionais.'))
            .finally(() => setLoadingList(false));
    }, [open]);

    async function handleReset() {
        if (!selectedId) {
            setError('Selecione um profissional.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const token = localStorage.getItem('accessToken') ?? '';
            const res = await fetch(
                `${API_BASE}/register/auth/totp/admin-reset/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ user_id: selectedId }),
                },
            );
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'Erro ao resetar autenticador.');
                return;
            }
            const dataUrl = await QRCode.toDataURL(data.otpauth_uri, {
                width: 240,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' },
            });
            setQrDataUrl(dataUrl);
            setResetName(
                `${data.professional.first_name} ${data.professional.last_name}`,
            );
        } catch {
            setError('Erro de conexão. Verifique o servidor.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <AppModal open={open} onClose={onClose} unmountOnClose>
            <div
                className='modal-message'
                style={{ minWidth: 300, maxWidth: 380 }}
            >
                {!qrDataUrl ? (
                    <>
                        <h3>Resetar Autenticador</h3>
                        <p
                            style={{
                                fontSize: 13,
                                marginBottom: 12,
                                color: '#555',
                            }}
                        >
                            Use quando o profissional trocou de aparelho ou
                            perdeu acesso ao Google Authenticator.
                        </p>
                        {error && (
                            <p
                                style={{
                                    color: 'crimson',
                                    marginBottom: 8,
                                    fontSize: 13,
                                }}
                            >
                                {error}
                            </p>
                        )}
                        {loadingList ? (
                            <p>Carregando...</p>
                        ) : (
                            <select
                                value={selectedId}
                                onChange={e =>
                                    setSelectedId(
                                        e.target.value
                                            ? Number(e.target.value)
                                            : '',
                                    )
                                }
                                style={{
                                    width: '100%',
                                    marginBottom: 12,
                                    padding: '6px 8px',
                                }}
                            >
                                <option value=''>
                                    Selecione o profissional
                                </option>
                                {professionals.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.first_name} {p.last_name} — {p.email}
                                    </option>
                                ))}
                            </select>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={onClose} style={{ flex: 1 }}>
                                Cancelar
                            </button>
                            <button
                                onClick={handleReset}
                                disabled={loading || !selectedId}
                                style={{ flex: 1 }}
                            >
                                {loading ? 'Resetando...' : 'Resetar'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <h3>Novo QR code</h3>
                        <p style={{ marginBottom: 8 }}>
                            Escaneie o código abaixo no Google Authenticator de{' '}
                            <strong>{resetName}</strong>.
                        </p>
                        <img
                            src={qrDataUrl}
                            alt='QR code TOTP'
                            style={{
                                display: 'block',
                                margin: '0 auto 12px',
                                width: 220,
                                height: 220,
                            }}
                        />
                        <p
                            style={{
                                fontSize: 12,
                                color: '#666',
                                marginBottom: 12,
                            }}
                        >
                            Este QR code não será exibido novamente.
                        </p>
                        <button onClick={onClose} style={{ width: '100%' }}>
                            Concluir
                        </button>
                    </>
                )}
            </div>
        </AppModal>
    );
};

export default TotpAdminResetModal;
