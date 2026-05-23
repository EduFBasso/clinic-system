import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { AppModal } from '../Modal/Modal';
import { API_BASE } from '../../config/api';
import '../../styles/modal-message.css';
import { getAccessToken } from '../../utils/auth/session';

interface Props {
    open: boolean;
    onClose: () => void;
}

type Step = 'form' | 'qr';

interface FormData {
    email: string;
    first_name: string;
    last_name: string;
    display_name: string;
    password: string;
    specialty: string;
    register_number: string;
    phone: string;
    city: string;
    state: string;
}

const SPECIALTY_OPTIONS = [
    { value: '', label: 'Sem especialidade' },
    { value: 'Odontologia', label: 'Odontologia' },
    { value: 'Podologia', label: 'Podologia' },
    { value: 'Outro', label: 'Outro' },
];

const EMPTY_FORM: FormData = {
    email: '',
    first_name: '',
    last_name: '',
    display_name: '',
    password: '',
    specialty: '',
    register_number: '',
    phone: '',
    city: '',
    state: '',
};

export const ProfessionalCreateModal: React.FC<Props> = ({ open, onClose }) => {
    const [step, setStep] = useState<Step>('form');
    const [form, setForm] = useState<FormData>(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [createdName, setCreatedName] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Reset when modal opens
    useEffect(() => {
        if (open) {
            setStep('form');
            setForm(EMPTY_FORM);
            setError('');
            setQrDataUrl('');
        }
    }, [open]);

    // Generate QR image when otpauth_uri is available
    useEffect(() => {
        if (step === 'qr' && qrDataUrl === '' && canvasRef.current) {
            // qrDataUrl is set from the API response — render it into the canvas
        }
    }, [step, qrDataUrl]);

    function handleChange(
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (
            !form.email ||
            !form.first_name ||
            !form.last_name ||
            !form.password
        ) {
            setError('E-mail, nome, sobrenome e senha são obrigatórios.');
            return;
        }
        setLoading(true);
        try {
            const token = getAccessToken();
            const res = await fetch(
                `${API_BASE}/register/auth/professional-create/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(form),
                },
            );
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'Erro ao criar profissional.');
                return;
            }
            // Generate QR code from otpauth_uri
            const dataUrl = await QRCode.toDataURL(data.otpauth_uri, {
                width: 240,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' },
            });
            setQrDataUrl(dataUrl);
            setCreatedName(
                `${data.professional.first_name} ${data.professional.last_name}`,
            );
            setStep('qr');
        } catch {
            setError('Erro de conexão. Verifique o servidor.');
        } finally {
            setLoading(false);
        }
    }

    function handleClose() {
        onClose();
    }

    return (
        <AppModal open={open} onClose={handleClose} unmountOnClose>
            <div
                className='modal-message'
                style={{ minWidth: 300, maxWidth: 400 }}
            >
                {step === 'form' ? (
                    <>
                        <h3>Novo Profissional</h3>
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
                        <form
                            onSubmit={handleSubmit}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                            }}
                        >
                            <input
                                name='first_name'
                                placeholder='Nome *'
                                value={form.first_name}
                                onChange={handleChange}
                                autoComplete='off'
                                required
                            />
                            <input
                                name='last_name'
                                placeholder='Sobrenome *'
                                value={form.last_name}
                                onChange={handleChange}
                                autoComplete='off'
                                required
                            />
                            <input
                                name='email'
                                type='email'
                                placeholder='E-mail *'
                                value={form.email}
                                onChange={handleChange}
                                autoComplete='off'
                                required
                            />
                            <input
                                name='password'
                                type='password'
                                placeholder='Senha temporária *'
                                value={form.password}
                                onChange={handleChange}
                                autoComplete='new-password'
                                required
                            />
                            <input
                                name='display_name'
                                placeholder='Nome de exibição para clientes (ex: Podóloga Regiane)'
                                value={form.display_name}
                                onChange={handleChange}
                                autoComplete='off'
                            />
                            <select
                                name='specialty'
                                value={form.specialty}
                                onChange={handleChange}
                            >
                                {SPECIALTY_OPTIONS.map(option => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <input
                                name='register_number'
                                placeholder='Registro profissional'
                                value={form.register_number}
                                onChange={handleChange}
                                autoComplete='off'
                            />
                            <input
                                name='phone'
                                placeholder='Telefone'
                                value={form.phone}
                                onChange={handleChange}
                                autoComplete='off'
                            />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    name='city'
                                    placeholder='Cidade'
                                    value={form.city}
                                    onChange={handleChange}
                                    autoComplete='off'
                                    style={{ flex: 1 }}
                                />
                                <input
                                    name='state'
                                    placeholder='UF'
                                    value={form.state}
                                    onChange={handleChange}
                                    autoComplete='off'
                                    maxLength={2}
                                    style={{ width: 56 }}
                                />
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    marginTop: 4,
                                }}
                            >
                                <button
                                    type='button'
                                    onClick={handleClose}
                                    style={{ flex: 1 }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type='submit'
                                    disabled={loading}
                                    style={{ flex: 1 }}
                                >
                                    {loading ? 'Criando...' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <>
                        <h3>Profissional criado!</h3>
                        <p style={{ marginBottom: 8 }}>
                            <strong>{createdName}</strong> foi cadastrado.
                            <br />
                            Peça que o profissional escaneie o QR code abaixo no
                            Google Authenticator.
                        </p>
                        {qrDataUrl && (
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
                        )}
                        <p
                            style={{
                                fontSize: 12,
                                color: '#666',
                                marginBottom: 12,
                            }}
                        >
                            Este QR code não será exibido novamente. Se perder o
                            acesso, use "Resetar Autenticador".
                        </p>
                        <button onClick={handleClose} style={{ width: '100%' }}>
                            Concluir
                        </button>
                    </>
                )}
            </div>
        </AppModal>
    );
};

