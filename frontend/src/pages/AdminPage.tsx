// frontend/src/pages/AdminPage.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import type { Professional } from '../types/models';
import { API_BASE } from '../config/api';
import ProfessionalCreateModal from '../components/ProfessionalCreateModal';
import AppModal from '../components/Modal';
import '../styles/modal-message.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EditForm {
    first_name: string;
    last_name: string;
    display_name: string;
    email: string;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeader() {
    const token = localStorage.getItem('accessToken') ?? '';
    return { Authorization: `Bearer ${token}` };
}

function proToForm(p: Professional): EditForm {
    return {
        first_name: p.first_name ?? '',
        last_name: p.last_name ?? '',
        display_name: p.display_name ?? '',
        email: p.email ?? '',
        specialty: p.specialty ?? '',
        register_number: p.register_number ?? '',
        phone: p.phone ?? '',
        city: p.city ?? '',
        state: p.state ?? '',
    };
}

// ─── Component ───────────────────────────────────────────────────────────────

const AdminPage: React.FC = () => {
    const navigate = useNavigate();

    // Guard: only superusers can access this page
    const loggedProfessional: Professional | null = (() => {
        try {
            const s = localStorage.getItem('loggedProfessional');
            return s ? JSON.parse(s) : null;
        } catch {
            return null;
        }
    })();

    useEffect(() => {
        if (!loggedProfessional?.is_superuser) {
            navigate('/', { replace: true });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (!loggedProfessional?.is_superuser) return null;

    return <AdminPageContent />;
};

const AdminPageContent: React.FC = () => {
    const loggedProfessional: Professional = (() => {
        try {
            const s = localStorage.getItem('loggedProfessional');
            return s ? JSON.parse(s) : {};
        } catch {
            return {};
        }
    })();

    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Inline edit state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<EditForm | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    // Create modal
    const [createOpen, setCreateOpen] = useState(false);

    // Deactivate modal
    const [deactivateTarget, setDeactivateTarget] =
        useState<Professional | null>(null);
    const [deactivateKey, setDeactivateKey] = useState('');
    const [deactivateReason, setDeactivateReason] = useState('');
    const [deactivateError, setDeactivateError] = useState('');
    const [deactivating, setDeactivating] = useState(false);

    // Reactivate
    const [reactivating, setReactivating] = useState<number | null>(null);

    // TOTP reset modal
    const [totpTarget, setTotpTarget] = useState<Professional | null>(null);
    const [totpLoading, setTotpLoading] = useState(false);
    const [totpQr, setTotpQr] = useState('');
    const [totpError, setTotpError] = useState('');

    const fetchList = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/register/professionals/`, {
                headers: authHeader(),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setProfessionals(Array.isArray(data) ? data : (data.results ?? []));
        } catch {
            setError('Erro ao carregar profissionais.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    // ── Inline Edit ───────────────────────────────────────────────────────────

    function startEdit(p: Professional) {
        setEditingId(p.id);
        setEditForm(proToForm(p));
        setSaveError('');
    }

    function cancelEdit() {
        setEditingId(null);
        setEditForm(null);
        setSaveError('');
    }

    function handleEditChange(
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) {
        const { name, value } = e.target;
        setEditForm(f => (f ? { ...f, [name]: value } : f));
    }

    async function saveEdit(id: number) {
        if (!editForm) return;
        setSaving(true);
        setSaveError('');
        try {
            const res = await fetch(
                `${API_BASE}/register/professionals/${id}/`,
                {
                    method: 'PATCH',
                    headers: {
                        ...authHeader(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(editForm),
                },
            );
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                const detail =
                    d?.message ||
                    d?.detail ||
                    (typeof d === 'object'
                        ? Object.values(d)
                              .flat()
                              .map(v => String(v))
                              .join(' | ')
                        : '');
                setSaveError(detail || `Erro ${res.status}`);
                return;
            }
            const updated: Professional = await res.json();
            setProfessionals(prev =>
                prev.map(p => (p.id === id ? { ...p, ...updated } : p)),
            );
            setEditingId(null);
            setEditForm(null);
        } catch {
            setSaveError('Erro de conexão.');
        } finally {
            setSaving(false);
        }
    }

    // ── Deactivate ────────────────────────────────────────────────────────────

    function openDeactivate(p: Professional) {
        setDeactivateTarget(p);
        setDeactivateKey('');
        setDeactivateReason('');
        setDeactivateError('');
    }

    async function confirmDeactivate() {
        if (!deactivateTarget) return;

        const envKey = import.meta.env.VITE_ADMIN_DELETE_KEY as
            | string
            | undefined;
        if (!envKey) {
            setDeactivateError(
                'Chave de administrador não configurada no ambiente.',
            );
            return;
        }
        if (deactivateKey !== envKey) {
            setDeactivateError('Chave incorreta.');
            return;
        }

        setDeactivating(true);
        setDeactivateError('');
        try {
            const body: Record<string, string> = {};
            if (deactivateReason.trim()) body.reason = deactivateReason.trim();

            const res = await fetch(
                `${API_BASE}/register/professionals/${deactivateTarget.id}/`,
                {
                    method: 'DELETE',
                    headers: {
                        ...authHeader(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                },
            );
            if (!res.ok && res.status !== 204) {
                const d = await res.json().catch(() => ({}));
                setDeactivateError(d.message || `Erro ${res.status}`);
                return;
            }
            setProfessionals(prev =>
                prev.map(p =>
                    p.id === deactivateTarget.id
                        ? {
                              ...p,
                              is_active: false,
                              deactivated_at: new Date().toISOString(),
                          }
                        : p,
                ),
            );
            setDeactivateTarget(null);
        } catch {
            setDeactivateError('Erro de conexão.');
        } finally {
            setDeactivating(false);
        }
    }

    // ── Reactivate ────────────────────────────────────────────────────────────

    async function reactivate(p: Professional) {
        setReactivating(p.id);
        try {
            const res = await fetch(
                `${API_BASE}/register/professionals/${p.id}/reativar/`,
                { method: 'POST', headers: authHeader() },
            );
            if (!res.ok) return;
            setProfessionals(prev =>
                prev.map(pro =>
                    pro.id === p.id
                        ? { ...pro, is_active: true, deactivated_at: null }
                        : pro,
                ),
            );
        } catch {
            // silently fail
        } finally {
            setReactivating(null);
        }
    }

    // ── TOTP Reset ────────────────────────────────────────────────────────────

    function openTotpReset(p: Professional) {
        setTotpTarget(p);
        setTotpQr('');
        setTotpError('');
    }

    async function confirmTotpReset() {
        if (!totpTarget) return;
        setTotpLoading(true);
        setTotpError('');
        try {
            const res = await fetch(
                `${API_BASE}/register/auth/totp/admin-reset/`,
                {
                    method: 'POST',
                    headers: {
                        ...authHeader(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ user_id: totpTarget.id }),
                },
            );
            const data = await res.json();
            if (!res.ok) {
                setTotpError(data.message || `Erro ${res.status}`);
                return;
            }
            const dataUrl = await QRCode.toDataURL(data.otpauth_uri, {
                width: 240,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' },
            });
            setTotpQr(dataUrl);
        } catch {
            setTotpError('Erro de conexão.');
        } finally {
            setTotpLoading(false);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <h1 style={styles.title}>Painel Admin</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        style={styles.btnPrimary}
                        onClick={() => setCreateOpen(true)}
                    >
                        + Novo Profissional
                    </button>
                    <span
                        style={{
                            fontSize: 13,
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        {loggedProfessional.first_name}
                    </span>
                    <button
                        style={styles.btnSecondary}
                        onClick={() => {
                            localStorage.removeItem('accessToken');
                            localStorage.removeItem('loggedProfessional');
                            window.location.replace('/');
                        }}
                    >
                        Sair
                    </button>
                </div>
            </header>

            {error && <p style={styles.errorMsg}>{error}</p>}

            {loading ? (
                <p style={styles.muted}>Carregando...</p>
            ) : (
                <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                {[
                                    'Nome',
                                    'Nome de exibição',
                                    'Especialidade',
                                    'Registro',
                                    'E-mail',
                                    'Status',
                                    'Ações',
                                ].map(h => (
                                    <th key={h} style={styles.th}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {professionals.map(p => (
                                <ProfRow
                                    key={p.id}
                                    professional={p}
                                    isEditing={editingId === p.id}
                                    editForm={editForm}
                                    saving={saving}
                                    saveError={saveError}
                                    reactivating={reactivating === p.id}
                                    onEdit={() => startEdit(p)}
                                    onCancelEdit={cancelEdit}
                                    onSaveEdit={() => saveEdit(p.id)}
                                    onEditChange={handleEditChange}
                                    onDeactivate={() => openDeactivate(p)}
                                    onReactivate={() => reactivate(p)}
                                    onTotpReset={() => openTotpReset(p)}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Professional Modal */}
            <ProfessionalCreateModal
                open={createOpen}
                onClose={() => {
                    setCreateOpen(false);
                    fetchList();
                }}
            />

            {/* Deactivate Confirmation Modal */}
            <AppModal
                open={!!deactivateTarget}
                onClose={() => {
                    if (!deactivating) setDeactivateTarget(null);
                }}
                unmountOnClose
            >
                <div className='modal-message' style={{ minWidth: 320 }}>
                    <h3 style={{ color: 'var(--color-danger)' }}>
                        Desativar Profissional
                    </h3>
                    <p style={{ marginBottom: 8, fontSize: 14 }}>
                        Você está prestes a desativar{' '}
                        <strong>
                            {deactivateTarget?.first_name}{' '}
                            {deactivateTarget?.last_name}
                        </strong>
                        . Esta ação pode ser revertida.
                    </p>
                    <input
                        type='text'
                        placeholder='Motivo (opcional)'
                        value={deactivateReason}
                        onChange={e => setDeactivateReason(e.target.value)}
                        style={styles.input}
                    />
                    <input
                        type='password'
                        placeholder='Chave de administrador'
                        value={deactivateKey}
                        onChange={e => setDeactivateKey(e.target.value)}
                        style={styles.input}
                    />
                    {deactivateError && (
                        <p
                            style={{
                                color: 'var(--color-danger)',
                                fontSize: 13,
                                marginBottom: 6,
                            }}
                        >
                            {deactivateError}
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                            onClick={() => setDeactivateTarget(null)}
                            disabled={deactivating}
                            style={{ ...styles.btnSecondary, flex: 1 }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={confirmDeactivate}
                            disabled={deactivating || !deactivateKey}
                            style={{ ...styles.btnDanger, flex: 1 }}
                        >
                            {deactivating ? 'Desativando...' : 'Desativar'}
                        </button>
                    </div>
                </div>
            </AppModal>

            {/* TOTP Reset Modal */}
            <AppModal
                open={!!totpTarget}
                onClose={() => {
                    if (!totpLoading) setTotpTarget(null);
                }}
                unmountOnClose
            >
                <div className='modal-message' style={{ minWidth: 300 }}>
                    {!totpQr ? (
                        <>
                            <h3>Resetar Autenticador</h3>
                            <p
                                style={{
                                    fontSize: 13,
                                    marginBottom: 12,
                                    color: '#555',
                                }}
                            >
                                Isso irá revogar o segredo TOTP atual de{' '}
                                <strong>
                                    {totpTarget?.first_name}{' '}
                                    {totpTarget?.last_name}
                                </strong>{' '}
                                e gerar um novo. Um novo QR code será exibido e
                                enviado por e-mail.
                            </p>
                            {totpError && (
                                <p
                                    style={{
                                        color: 'crimson',
                                        fontSize: 13,
                                        marginBottom: 8,
                                    }}
                                >
                                    {totpError}
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    onClick={() => setTotpTarget(null)}
                                    style={{ ...styles.btnSecondary, flex: 1 }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmTotpReset}
                                    disabled={totpLoading}
                                    style={{ ...styles.btnPrimary, flex: 1 }}
                                >
                                    {totpLoading
                                        ? 'Gerando...'
                                        : 'Confirmar Reset'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <h3>Novo QR Code</h3>
                            <p style={{ marginBottom: 8, fontSize: 13 }}>
                                Novo autenticador para{' '}
                                <strong>
                                    {totpTarget?.first_name}{' '}
                                    {totpTarget?.last_name}
                                </strong>
                                . Escaneie no Google Authenticator ou app
                                equivalente.
                            </p>
                            <img
                                src={totpQr}
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
                                    fontSize: 11,
                                    color: '#888',
                                    marginBottom: 12,
                                }}
                            >
                                Este QR code não será exibido novamente.
                            </p>
                            <button
                                onClick={() => setTotpTarget(null)}
                                style={{ ...styles.btnPrimary, width: '100%' }}
                            >
                                Concluir
                            </button>
                        </>
                    )}
                </div>
            </AppModal>
        </div>
    );
};

// ─── Row ──────────────────────────────────────────────────────────────────────

interface RowProps {
    professional: Professional;
    isEditing: boolean;
    editForm: EditForm | null;
    saving: boolean;
    saveError: string;
    reactivating: boolean;
    onEdit: () => void;
    onCancelEdit: () => void;
    onSaveEdit: () => void;
    onEditChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => void;
    onDeactivate: () => void;
    onReactivate: () => void;
    onTotpReset: () => void;
}

const ProfRow: React.FC<RowProps> = ({
    professional: p,
    isEditing,
    editForm,
    saving,
    saveError,
    reactivating,
    onEdit,
    onCancelEdit,
    onSaveEdit,
    onEditChange,
    onDeactivate,
    onReactivate,
    onTotpReset,
}) => {
    const inactive = p.is_active === false;

    if (isEditing && editForm) {
        return (
            <>
                <tr style={{ background: 'var(--color-primary-light)' }}>
                    <td style={styles.td}>
                        <input
                            name='first_name'
                            value={editForm.first_name}
                            onChange={onEditChange}
                            style={styles.cellInput}
                            placeholder='Nome'
                        />
                        <input
                            name='last_name'
                            value={editForm.last_name}
                            onChange={onEditChange}
                            style={{ ...styles.cellInput, marginTop: 4 }}
                            placeholder='Sobrenome'
                        />
                    </td>
                    <td style={styles.td}>
                        <input
                            name='display_name'
                            value={editForm.display_name}
                            onChange={onEditChange}
                            style={styles.cellInput}
                            placeholder='Nome de exibição'
                        />
                    </td>
                    <td style={styles.td}>
                        <select
                            name='specialty'
                            value={editForm.specialty}
                            onChange={onEditChange}
                            style={styles.cellInput}
                        >
                            {SPECIALTY_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </td>
                    <td style={styles.td}>
                        <input
                            name='register_number'
                            value={editForm.register_number}
                            onChange={onEditChange}
                            style={styles.cellInput}
                            placeholder='Registro'
                        />
                    </td>
                    <td style={styles.td}>
                        <input
                            name='email'
                            value={editForm.email}
                            onChange={onEditChange}
                            style={styles.cellInput}
                            placeholder='E-mail'
                            type='email'
                        />
                        <input
                            name='phone'
                            value={editForm.phone}
                            onChange={onEditChange}
                            style={{ ...styles.cellInput, marginTop: 4 }}
                            placeholder='Telefone'
                        />
                    </td>
                    <td style={styles.td}>—</td>
                    <td style={{ ...styles.td, minWidth: 140 }}>
                        {saveError && (
                            <p
                                style={{
                                    color: 'var(--color-danger)',
                                    fontSize: 11,
                                    marginBottom: 4,
                                }}
                            >
                                {saveError}
                            </p>
                        )}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                            }}
                        >
                            <button
                                onClick={onSaveEdit}
                                disabled={saving}
                                style={styles.btnPrimary}
                            >
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button
                                onClick={onCancelEdit}
                                disabled={saving}
                                style={styles.btnSecondary}
                            >
                                Cancelar
                            </button>
                        </div>
                    </td>
                </tr>
            </>
        );
    }

    return (
        <tr style={{ opacity: inactive ? 0.55 : 1 }}>
            <td style={styles.td}>
                <span style={{ fontWeight: 500 }}>
                    {p.first_name} {p.last_name}
                </span>
                {p.is_superuser && (
                    <span style={styles.badgeSuperuser}>super</span>
                )}
            </td>
            <td style={styles.td}>
                {p.display_name || <span style={styles.muted}>—</span>}
            </td>
            <td style={styles.td}>
                {p.specialty || <span style={styles.muted}>—</span>}
            </td>
            <td style={styles.td}>
                {p.register_number || <span style={styles.muted}>—</span>}
            </td>
            <td style={styles.td}>{p.email}</td>
            <td style={styles.td}>
                <span
                    style={inactive ? styles.badgeInactive : styles.badgeActive}
                >
                    {inactive ? 'Inativo' : 'Ativo'}
                </span>
            </td>
            <td style={{ ...styles.td, minWidth: 160 }}>
                <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                >
                    <button onClick={onEdit} style={styles.btnSmall}>
                        Editar
                    </button>
                    <button
                        onClick={onTotpReset}
                        style={styles.btnSmallSecondary}
                    >
                        Reset TOTP
                    </button>
                    {inactive ? (
                        <button
                            onClick={onReactivate}
                            disabled={reactivating}
                            style={styles.btnSmallSuccess}
                        >
                            {reactivating ? '...' : 'Reativar'}
                        </button>
                    ) : (
                        <button
                            onClick={onDeactivate}
                            style={styles.btnSmallDanger}
                        >
                            Desativar
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
    page: {
        padding: '24px 20px',
        maxWidth: 1100,
        margin: '0 auto',
        fontFamily: 'inherit',
    } as React.CSSProperties,

    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        flexWrap: 'wrap' as const,
        gap: 12,
    } as React.CSSProperties,

    title: {
        fontSize: '1.4rem',
        fontWeight: 700,
        color: 'var(--color-primary)',
        margin: 0,
    } as React.CSSProperties,

    tableWrapper: {
        overflowX: 'auto' as const,
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        background: '#fff',
    } as React.CSSProperties,

    table: {
        width: '100%',
        borderCollapse: 'collapse' as const,
        fontSize: 14,
    } as React.CSSProperties,

    th: {
        padding: '10px 12px',
        textAlign: 'left' as const,
        fontWeight: 600,
        borderBottom: '2px solid var(--color-border)',
        background: 'var(--color-primary-light)',
        color: 'var(--color-primary)',
        whiteSpace: 'nowrap' as const,
    } as React.CSSProperties,

    td: {
        padding: '8px 12px',
        borderBottom: '1px solid var(--color-border)',
        verticalAlign: 'middle' as const,
    } as React.CSSProperties,

    cellInput: {
        width: '100%',
        padding: '4px 6px',
        fontSize: 13,
        border: '1px solid var(--color-border-focus)',
        borderRadius: 4,
        boxSizing: 'border-box' as const,
    } as React.CSSProperties,

    input: {
        width: '100%',
        padding: '7px 10px',
        fontSize: 14,
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        marginBottom: 8,
        boxSizing: 'border-box' as const,
    } as React.CSSProperties,

    muted: {
        color: 'var(--color-text-muted)',
        fontStyle: 'italic',
    } as React.CSSProperties,

    errorMsg: {
        color: 'var(--color-danger)',
        marginBottom: 12,
        fontSize: 14,
    } as React.CSSProperties,

    badgeActive: {
        background: 'var(--color-success-bg)',
        color: 'var(--color-success)',
        borderRadius: 12,
        padding: '2px 10px',
        fontSize: 12,
        fontWeight: 600,
    } as React.CSSProperties,

    badgeInactive: {
        background: 'var(--color-danger-bg)',
        color: 'var(--color-danger)',
        borderRadius: 12,
        padding: '2px 10px',
        fontSize: 12,
        fontWeight: 600,
    } as React.CSSProperties,

    badgeSuperuser: {
        background: '#dbeafe',
        color: '#1d4ed8',
        borderRadius: 8,
        padding: '1px 7px',
        fontSize: 11,
        fontWeight: 600,
        marginLeft: 6,
    } as React.CSSProperties,

    btnPrimary: {
        background: 'var(--color-primary)',
        color: '#fff',
        border: 'none',
        borderRadius: 5,
        padding: '7px 16px',
        fontWeight: 600,
        cursor: 'pointer',
        fontSize: 13,
        whiteSpace: 'nowrap' as const,
    } as React.CSSProperties,

    btnSecondary: {
        background: '#fff',
        color: 'var(--color-primary)',
        border: '1.5px solid var(--color-primary)',
        borderRadius: 5,
        padding: '7px 16px',
        fontWeight: 600,
        cursor: 'pointer',
        fontSize: 13,
        whiteSpace: 'nowrap' as const,
    } as React.CSSProperties,

    btnDanger: {
        background: 'var(--color-danger)',
        color: '#fff',
        border: 'none',
        borderRadius: 5,
        padding: '7px 16px',
        fontWeight: 600,
        cursor: 'pointer',
        fontSize: 13,
    } as React.CSSProperties,

    btnSmall: {
        background: 'var(--color-primary)',
        color: '#fff',
        border: 'none',
        borderRadius: 4,
        padding: '4px 10px',
        fontSize: 12,
        cursor: 'pointer',
        fontWeight: 600,
    } as React.CSSProperties,

    btnSmallSecondary: {
        background: '#fff',
        color: 'var(--color-primary)',
        border: '1px solid var(--color-primary)',
        borderRadius: 4,
        padding: '4px 10px',
        fontSize: 12,
        cursor: 'pointer',
    } as React.CSSProperties,

    btnSmallDanger: {
        background: 'var(--color-danger-bg)',
        color: 'var(--color-danger)',
        border: '1px solid var(--color-danger)',
        borderRadius: 4,
        padding: '4px 10px',
        fontSize: 12,
        cursor: 'pointer',
    } as React.CSSProperties,

    btnSmallSuccess: {
        background: 'var(--color-success-bg)',
        color: 'var(--color-success)',
        border: '1px solid var(--color-success)',
        borderRadius: 4,
        padding: '4px 10px',
        fontSize: 12,
        cursor: 'pointer',
    } as React.CSSProperties,
} as const;

export default AdminPage;
