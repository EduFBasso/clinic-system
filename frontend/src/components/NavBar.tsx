// Detecta se está em dispositivo mobile
function isMobileDevice() {
    return (
        typeof window !== 'undefined' &&
        /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
            window.navigator.userAgent,
        )
    );
}
// frontend\src\components\NavBar.tsx
import React, { useState, useRef, useEffect } from 'react';
import SessionExpiredModal from './SessionExpiredModal';
import { API_BASE } from '../config/api';
import { getOrCreateDeviceId } from '../utils/device';
type VerifyResponse = {
    access?: string;
    refresh?: string;
    professional?: ProfessionalBasic;
    active_sessions_count?: number;
    device_id?: string;
    message?: string;
};
import { useProfessionals } from '../hooks/useProfessionals';
import type { ProfessionalBasic } from '../hooks/useProfessionals';
import styles from '../styles/components/NavBar.module.css';
import AppModal from './Modal';
import '../styles/modal-message.css';
import { isTokenExpired } from '../utils/jwt';

interface NavBarProps {
    openNewClientModal?: () => void;
    selectedClientId?: number | null;
}

const NavBar: React.FC<NavBarProps> = ({
    openNewClientModal,
    selectedClientId,
}) => {
    const [selectedProfessional, setSelectedProfessional] =
        useState<string>('');
    const [codeSent, setCodeSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [loadingOtp, setLoadingOtp] = useState(false);
    const [loggedProfessional, setLoggedProfessional] =
        useState<ProfessionalBasic | null>(() => {
            const stored = localStorage.getItem('loggedProfessional');
            return stored ? JSON.parse(stored) : null;
        });

    const [professionalDropdownOpen, setProfessionalDropdownOpen] =
        useState(false);

    const professionalDropdownRef = useRef<HTMLDivElement>(null);

    const { professionals, loading, error } = useProfessionals();

    // Dropdown state
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    // Agenda dropdown state
    const [agendaDropdownOpen, setAgendaDropdownOpen] = useState(false);
    const agendaDropdownRef = useRef<HTMLDivElement>(null);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    // Modal de decisão para Novo Compromisso quando já existe um ativo
    const [agendaDecisionOpen, setAgendaDecisionOpen] = useState(false);
    const [agendaDecisionAppt, setAgendaDecisionAppt] = useState<{
        id: number;
        start_at: string;
        client: number;
        title?: string;
    } | null>(null);
    // Quando true após solicitar OTP com sucesso, só revela o campo após clicar em OK no modal
    const [otpSentConfirmPending, setOtpSentConfirmPending] = useState(false);

    // Estado para modal de sessão expirada
    const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);

    // Fecha dropdown ao clicar fora
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            if (dropdownRef.current && !dropdownRef.current.contains(target)) {
                setDropdownOpen(false);
            }
            if (
                agendaDropdownRef.current &&
                !agendaDropdownRef.current.contains(target)
            ) {
                setAgendaDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        // On mount: if token is missing/expired, clear any logged state to avoid showing logged UI
        const token = localStorage.getItem('accessToken');
        if (isTokenExpired(token)) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('loggedProfessional');
            setLoggedProfessional(null);
        } else {
            const stored = localStorage.getItem('loggedProfessional');
            if (stored) setLoggedProfessional(JSON.parse(stored));
        }
    }, []);

    // Handler para abrir modal de novo cliente (integração futura)
    // ...existing code...

    function handleNewClient() {
        setDropdownOpen(false);
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setSessionExpiredOpen(true);
            return;
        }
        if (isMobileDevice()) {
            window.location.href = '/clients/new';
        } else if (openNewClientModal) {
            openNewClientModal();
        } else {
            window.open(
                '/clients/new',
                '_blank',
                'width=900,height=700,toolbar=no,menubar=no,location=no',
            );
        }
    }

    // Handler para editar cliente (integração futura)
    // Função removida (duplicada)

    function handleEditClient() {
        setDropdownOpen(false);
        if (selectedClientId) {
            if (isMobileDevice()) {
                window.location.href = `/clients/edit/${selectedClientId}`;
            } else {
                window.open(
                    `/clients/edit/${selectedClientId}`,
                    '_blank',
                    'width=900,height=700,toolbar=no,menubar=no,location=no',
                );
            }
        } else {
            alert('Selecione um cliente antes de editar.');
        }
    }

    // Helpers Agenda
    async function fetchNextScheduledAppointment(clientId: number) {
        const token = localStorage.getItem('accessToken');
        if (isTokenExpired(token)) return null;
        try {
            const url = `${API_BASE}/agenda/appointments/?client=${clientId}&start=${encodeURIComponent(
                new Date().toISOString(),
            )}&status=scheduled`;
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return null;
            const list = await res.json();
            return Array.isArray(list) && list.length ? list[0] : null;
        } catch {
            return null;
        }
    }

    function goAgendaDay(dateISO: string, clientId?: number) {
        const d = new Date(dateISO);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const url = `/agenda?date=${y}-${m}-${day}${
            clientId ? `&client=${clientId}` : ''
        }`;
        if (isMobileDevice()) {
            window.location.href = url;
        } else {
            window.open(url, '_self');
        }
    }

    async function handleAgendaEditLast() {
        setAgendaDropdownOpen(false);
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setSessionExpiredOpen(true);
            return;
        }
        if (!selectedClientId) {
            setModalMessage('Selecione um cliente para editar o compromisso.');
            setModalOpen(true);
            return;
        }
        const nextAppt = await fetchNextScheduledAppointment(selectedClientId);
        if (!nextAppt) {
            setModalMessage('Não há compromisso agendado para este cliente.');
            setModalOpen(true);
            return;
        }
        // Abre Agenda no dia do compromisso para facilitar a edição
        goAgendaDay(nextAppt.start_at, selectedClientId);
    }

    async function handleAgendaNew() {
        setAgendaDropdownOpen(false);
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setSessionExpiredOpen(true);
            return;
        }
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const baseUrl = `/agenda?date=${y}-${m}-${d}&new=1`;
        // Se não houver cliente selecionado, exige seleção e foca na lista
        if (!selectedClientId) {
            try {
                window.dispatchEvent(
                    new CustomEvent('needClientSelectionForAgenda'),
                );
            } catch {
                /* noop */
            }
            setModalMessage(
                'Selecione um cliente antes de criar um compromisso.',
            );
            setModalOpen(true);
            return;
        }
        // Há cliente selecionado: verifica se já possui compromisso agendado (próximo)
        try {
            // Pede ao painel de clientes para focar o cartão selecionado, mesmo que esteja fora de visão
            window.dispatchEvent(new CustomEvent('focusSelectedClientCard'));
        } catch {
            /* noop */
        }
        const nextAppt = await fetchNextScheduledAppointment(selectedClientId);
        if (!nextAppt) {
            const url = `${baseUrl}&client=${selectedClientId}`;
            if (isMobileDevice()) window.location.href = url;
            else window.open(url, '_self');
            return;
        }
        // Existe compromisso: pergunta se quer criar novo ou editar o último (próximo agendado)
        setAgendaDecisionAppt(nextAppt);
        setAgendaDecisionOpen(true);
    }

    return (
        <div className={styles.navBar}>
            <div className={styles.menuContainer}>
                <div className={styles.dropdownWrapper} ref={dropdownRef}>
                    <button
                        className={styles.menuButton}
                        onClick={() => {
                            const token = localStorage.getItem('accessToken');
                            if (!token) {
                                setSessionExpiredOpen(true);
                                return;
                            }
                            setDropdownOpen(open => !open);
                        }}
                        aria-haspopup='true'
                        aria-expanded={dropdownOpen}
                    >
                        👤 Clientes
                        <span style={{ marginLeft: 6, fontSize: 14 }}>▼</span>
                    </button>
                    {dropdownOpen && (
                        <div className={styles.dropdownMenu}>
                            <button
                                className={styles.dropdownItem}
                                onClick={handleNewClient}
                            >
                                Novo
                            </button>
                            <button
                                className={styles.dropdownItem}
                                onClick={handleEditClient}
                            >
                                Editar
                            </button>
                        </div>
                    )}
                </div>
                <div className={styles.dropdownWrapper} ref={agendaDropdownRef}>
                    <button
                        className={styles.menuButton}
                        onClick={() => {
                            const token = localStorage.getItem('accessToken');
                            if (!token) {
                                setSessionExpiredOpen(true);
                                return;
                            }
                            setAgendaDropdownOpen(open => !open);
                        }}
                        aria-haspopup='true'
                        aria-expanded={agendaDropdownOpen}
                    >
                        📅 Agenda{' '}
                        <span style={{ marginLeft: 6, fontSize: 14 }}>▼</span>
                    </button>
                    {agendaDropdownOpen && (
                        <div className={styles.dropdownMenu}>
                            <button
                                className={styles.dropdownItem}
                                onClick={handleAgendaNew}
                            >
                                Novo Compromisso
                            </button>

                            <button
                                className={styles.dropdownItem}
                                onClick={handleAgendaEditLast}
                            >
                                Editar Último
                            </button>

                            <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                    setAgendaDropdownOpen(false);
                                    const token =
                                        localStorage.getItem('accessToken');
                                    if (!token) {
                                        setSessionExpiredOpen(true);
                                        return;
                                    }
                                    const now = new Date();
                                    const y = now.getFullYear();
                                    const m = String(
                                        now.getMonth() + 1,
                                    ).padStart(2, '0');
                                    const d = String(now.getDate()).padStart(
                                        2,
                                        '0',
                                    );
                                    const url = `/agenda?date=${y}-${m}-${d}&mode=week`;
                                    if (isMobileDevice()) {
                                        window.location.href = url;
                                    } else {
                                        window.open(url, '_self');
                                    }
                                }}
                            >
                                Compromissos
                            </button>
                        </div>
                    )}
                </div>
                <button
                    className={styles.menuButton}
                    onClick={() => {
                        const token = localStorage.getItem('accessToken');
                        if (!token) {
                            setSessionExpiredOpen(true);
                            return;
                        }
                        setModalMessage('Consulta: Falta implementar o Código');
                        setModalOpen(true);
                    }}
                >
                    🩺 Consulta
                </button>
            </div>

            {/* Modal de decisão para Novo Compromisso */}
            <AppModal
                open={agendaDecisionOpen}
                onClose={() => setAgendaDecisionOpen(false)}
                closeOnEnter={false}
            >
                <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                        Já existe um compromisso agendado para este cliente.
                    </div>
                    {agendaDecisionAppt && (
                        <div style={{ color: '#374151', fontSize: 14 }}>
                            Próximo:{' '}
                            {new Date(
                                agendaDecisionAppt.start_at,
                            ).toLocaleString('pt-BR')}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                            className={styles.loginButton}
                            onClick={() => {
                                // Criar novo
                                setAgendaDecisionOpen(false);
                                const now = new Date();
                                const y = now.getFullYear();
                                const m = String(now.getMonth() + 1).padStart(
                                    2,
                                    '0',
                                );
                                const d = String(now.getDate()).padStart(
                                    2,
                                    '0',
                                );
                                const url = `/agenda?date=${y}-${m}-${d}&client=${
                                    selectedClientId ?? ''
                                }&new=1`;
                                if (isMobileDevice())
                                    window.location.href = url;
                                else window.open(url, '_self');
                            }}
                        >
                            Criar novo
                        </button>
                        <button
                            className={styles.loginButton}
                            onClick={() => {
                                // Editar último (próximo agendado)
                                if (!agendaDecisionAppt) return;
                                setAgendaDecisionOpen(false);
                                const d = new Date(agendaDecisionAppt.start_at);
                                const y = d.getFullYear();
                                const m = String(d.getMonth() + 1).padStart(
                                    2,
                                    '0',
                                );
                                const day = String(d.getDate()).padStart(
                                    2,
                                    '0',
                                );
                                const url = `/agenda?date=${y}-${m}-${day}&client=${agendaDecisionAppt.client}&edit=${agendaDecisionAppt.id}`;
                                if (isMobileDevice())
                                    window.location.href = url;
                                else window.open(url, '_self');
                            }}
                        >
                            Editar último
                        </button>
                        <button
                            className={styles.loginButton}
                            onClick={() => setAgendaDecisionOpen(false)}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </AppModal>

            <div className={styles.loginContainer}>
                {loggedProfessional ? (
                    <div className={styles.loggedInfo}>
                        <div className={styles.proNameBlock}>
                            <span className={styles.nameLine}>
                                Dr(a) {loggedProfessional.first_name}{' '}
                                {loggedProfessional.last_name}
                            </span>
                            {loggedProfessional.register_number ? (
                                <span className={styles.idLine}>
                                    CRM/COP:{' '}
                                    {loggedProfessional.register_number}
                                </span>
                            ) : null}
                        </div>
                        <button
                            className={
                                styles.loginButton + ' ' + styles.logoutButton
                            }
                            onClick={() => {
                                localStorage.removeItem('accessToken');
                                localStorage.removeItem('loggedProfessional');
                                localStorage.removeItem('newClientId');
                                setLoggedProfessional(null);
                                setSelectedProfessional('');
                                setCodeSent(false);
                                setOtp('');
                                window.dispatchEvent(new Event('clearClients'));
                            }}
                        >
                            Sair
                        </button>
                    </div>
                ) : (
                    <>
                        <div
                            className={styles.dropdownWrapper}
                            style={{ marginRight: 12 }}
                            ref={professionalDropdownRef}
                        >
                            <button
                                className={styles.menuButton}
                                onClick={() =>
                                    setProfessionalDropdownOpen(open => !open)
                                }
                                aria-haspopup='true'
                                aria-expanded={professionalDropdownOpen}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                <span style={{ fontSize: 18 }}>👨‍⚕️</span>
                                <span>
                                    {selectedProfessional
                                        ? professionals.find(
                                              p =>
                                                  p.email ===
                                                  selectedProfessional,
                                          )?.first_name +
                                          ' ' +
                                          professionals.find(
                                              p =>
                                                  p.email ===
                                                  selectedProfessional,
                                          )?.last_name
                                        : 'Profissionais'}
                                </span>
                                <span style={{ fontSize: 14 }}>▼</span>
                            </button>
                            {professionalDropdownOpen && (
                                <div className={styles.dropdownMenu}>
                                    <div
                                        className={styles.dropdownItem}
                                        style={{
                                            fontWeight: 'bold',
                                            cursor: 'default',
                                        }}
                                    >
                                        Profissionais
                                    </div>
                                    {loading && (
                                        <div className={styles.dropdownItem}>
                                            Carregando...
                                        </div>
                                    )}
                                    {error && (
                                        <div className={styles.dropdownItem}>
                                            Erro ao carregar
                                        </div>
                                    )}
                                    {professionals.map(prof => (
                                        <button
                                            key={prof.id}
                                            className={styles.dropdownItem}
                                            onClick={() => {
                                                setSelectedProfessional(
                                                    prof.email,
                                                );
                                                setProfessionalDropdownOpen(
                                                    false,
                                                );
                                                setCodeSent(false);
                                                setOtp('');
                                            }}
                                        >
                                            {prof.first_name} {prof.last_name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Botão para enviar código aparece após seleção do profissional, antes do envio */}
                        {selectedProfessional && !codeSent && (
                            <button
                                className={styles.loginButton}
                                style={{ marginRight: 8 }}
                                disabled={loadingOtp}
                                onClick={async () => {
                                    setLoadingOtp(true);
                                    try {
                                        console.debug(
                                            '[NavBar] API_BASE =',
                                            API_BASE,
                                            'fetch ->',
                                            `${API_BASE}/register/auth/request-code/`,
                                        );
                                        const res = await fetch(
                                            `${API_BASE}/register/auth/request-code/`,
                                            {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type':
                                                        'application/json',
                                                },
                                                body: JSON.stringify({
                                                    email: selectedProfessional,
                                                }),
                                            },
                                        );
                                        const data = await res.json();
                                        // Se vier message e status 200, considera sucesso
                                        if (data.message && res.ok) {
                                            setModalMessage(data.message);
                                            setModalOpen(true);
                                            // Aguarda confirmação do usuário para revelar o campo de OTP
                                            setOtpSentConfirmPending(true);
                                        } else {
                                            setModalMessage(
                                                data.message ||
                                                    'Erro ao enviar código',
                                            );
                                            setModalOpen(true);
                                            setOtpSentConfirmPending(false);
                                        }
                                    } catch {
                                        setModalMessage(
                                            'Erro ao enviar código',
                                        );
                                        setModalOpen(true);
                                        setOtpSentConfirmPending(false);
                                    }
                                    setLoadingOtp(false);
                                }}
                            >
                                Enviar código
                            </button>
                        )}

                        {/* Input e botão Entrar só aparecem após envio do código */}
                        {selectedProfessional && codeSent && (
                            <>
                                <input
                                    type='password'
                                    placeholder='Senha'
                                    className={styles.loginInput}
                                    value={otp}
                                    onChange={e => setOtp(e.target.value)}
                                    style={{ marginRight: 8 }}
                                />
                                <button
                                    className={styles.loginButton}
                                    onClick={async () => {
                                        setLoadingOtp(true);
                                        try {
                                            console.debug(
                                                '[NavBar] API_BASE =',
                                                API_BASE,
                                                'fetch ->',
                                                `${API_BASE}/register/auth/verify-code/`,
                                            );
                                            // Ensure device_id exists and send it for device session tracking
                                            const deviceIdKey = 'device_id';
                                            const deviceId =
                                                getOrCreateDeviceId(
                                                    deviceIdKey,
                                                );
                                            const res = await fetch(
                                                `${API_BASE}/register/auth/verify-code/`,
                                                {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type':
                                                            'application/json',
                                                    },
                                                    body: JSON.stringify({
                                                        email: selectedProfessional,
                                                        code: otp,
                                                        device_id: deviceId,
                                                    }),
                                                },
                                            );
                                            let data: VerifyResponse = {};
                                            try {
                                                data = await res.json();
                                            } catch {
                                                data = {
                                                    message:
                                                        'Falha ao interpretar resposta do servidor',
                                                };
                                            }
                                            // Substitui alert por modal para validação do código
                                            if (res.ok && data.access) {
                                                let successMsg =
                                                    'Login realizado! Dados dos clientes liberados.';
                                                if (
                                                    typeof data.active_sessions_count ===
                                                    'number'
                                                ) {
                                                    successMsg += ` Sessões ativas: ${data.active_sessions_count}.`;
                                                }
                                                setModalMessage(successMsg);
                                                setModalOpen(true);
                                                localStorage.setItem(
                                                    'accessToken',
                                                    data.access,
                                                );
                                                setOtp('');
                                                setLoggedProfessional(
                                                    data.professional || null,
                                                );
                                                localStorage.setItem(
                                                    'loggedProfessional',
                                                    JSON.stringify(
                                                        data.professional,
                                                    ),
                                                );
                                                if (data.device_id) {
                                                    localStorage.setItem(
                                                        deviceIdKey,
                                                        String(data.device_id),
                                                    );
                                                }
                                                window.dispatchEvent(
                                                    new Event('updateClients'),
                                                );
                                                // Limpa erro de sessão expirada imediatamente
                                                window.dispatchEvent(
                                                    new Event('clearClients'),
                                                );
                                            } else {
                                                setModalMessage(
                                                    String(
                                                        data.message ||
                                                            'Código inválido',
                                                    ),
                                                );
                                                setModalOpen(true);
                                            }
                                        } catch {
                                            setModalMessage(
                                                'Erro ao validar código',
                                            );
                                            setModalOpen(true);
                                        }
                                        setLoadingOtp(false);
                                    }}
                                    disabled={loadingOtp || !otp}
                                >
                                    Entrar
                                </button>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Modal padrão para mensagens */}
            <AppModal
                open={modalOpen}
                onClose={() => {
                    if (otpSentConfirmPending) {
                        setCodeSent(true);
                        setOtpSentConfirmPending(false);
                    }
                    setModalOpen(false);
                }}
            >
                <div className='modal-message'>
                    <h3>{modalMessage}</h3>
                    <button
                        onClick={() => {
                            if (otpSentConfirmPending) {
                                setCodeSent(true);
                                setOtpSentConfirmPending(false);
                            }
                            setModalOpen(false);
                        }}
                    >
                        Ok
                    </button>
                </div>
            </AppModal>

            {/* Modal de sessão expirada */}
            <SessionExpiredModal
                open={sessionExpiredOpen}
                onClose={() => {
                    setSessionExpiredOpen(false);
                    // Opcional: Limpar token e recarregar página
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('loggedProfessional');
                    window.location.reload();
                }}
            />
        </div>
    );
};

export default NavBar;
