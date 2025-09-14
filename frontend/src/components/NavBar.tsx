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
import type { Appointment } from '../hooks/useAppointments';
import type { ProfessionalBasic } from '../hooks/useProfessionals';
import styles from '../styles/components/NavBar.module.css';
import AgendaSettingsModal from './AgendaSettingsModal';
import AppModal from './Modal';
import '../styles/modal-message.css';
import { isTokenExpired } from '../utils/jwt';

interface NavBarProps {
    openNewClientModal?: () => void;
    selectedClientId?: number | null;
    agendaOpeners?: {
        openSchedule: (
            clientId?: number | null,
            date?: Date,
            edit?: Appointment | null,
        ) => void | Promise<void>;
        openMonthly: (clientId: number, date?: Date) => void | Promise<void>;
        openWeekly: (date?: Date) => void | Promise<void>;
    };
}

const NavBar: React.FC<NavBarProps> = ({
    openNewClientModal,
    selectedClientId,
    agendaOpeners,
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
    // Estados de decisão de novo compromisso removidos após simplificação do menu
    // Modal configurações agenda
    const [agendaSettingsOpen, setAgendaSettingsOpen] = useState(false);
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
        // Desktop: abrir ScheduleModal em modo edição; Mobile: rota com edit
        if (agendaOpeners && !isMobileDevice()) {
            await agendaOpeners.openSchedule(
                selectedClientId || undefined,
                new Date(nextAppt.start_at),
                nextAppt as unknown as Appointment,
            );
            return;
        }
        try {
            const d = new Date(nextAppt.start_at);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const url = `/agenda?date=${y}-${m}-${day}&client=${selectedClientId}&edit=${nextAppt.id}`;
            if (isMobileDevice()) window.location.href = url;
            else window.open(url, '_self');
        } catch {
            goAgendaDay(nextAppt.start_at, selectedClientId);
        }
    }

    // handleAgendaNew removido (menu Novo Compromisso retirado)

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
                            {/**
                             * ORDEM SOLICITADA:
                             * Configurações -> Agenda Diária -> Agenda Semanal -> Agenda Mensal (>10") -> Novo -> Editar
                             */}
                            <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                    setAgendaDropdownOpen(false);
                                    setAgendaSettingsOpen(true);
                                }}
                            >
                                Configurações
                            </button>
                            <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                    setAgendaDropdownOpen(false);
                                    try {
                                        const today = new Date();
                                        window.dispatchEvent(
                                            new CustomEvent('openDailyAgenda', {
                                                detail: {
                                                    date: today.toISOString(),
                                                },
                                            }),
                                        );
                                    } catch {
                                        /* noop */
                                    }
                                }}
                            >
                                Agenda Diária
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
                                    if (agendaOpeners && !isMobileDevice()) {
                                        agendaOpeners.openWeekly(now);
                                    } else {
                                        const y = now.getFullYear();
                                        const m = String(
                                            now.getMonth() + 1,
                                        ).padStart(2, '0');
                                        const d = String(
                                            now.getDate(),
                                        ).padStart(2, '0');
                                        const url = `/agenda?date=${y}-${m}-${d}&mode=week`;
                                        if (isMobileDevice())
                                            window.location.href = url;
                                        else window.open(url, '_self');
                                    }
                                }}
                            >
                                Agenda Semanal
                            </button>
                            {/** Mostrar Agenda Mensal apenas para telas estritamente > 10" */}
                            {(() => {
                                function canShowMonthly() {
                                    try {
                                        const pxW = window.screen.width;
                                        const pxH = window.screen.height;
                                        const dpr =
                                            window.devicePixelRatio || 1;
                                        const diagonalInches =
                                            Math.sqrt(pxW ** 2 + pxH ** 2) /
                                            (dpr * 96);
                                        // Fallback: considera tela realmente larga como proxy >10" se cálculo falhar ou densidade distorce
                                        const fallbackLarge =
                                            window.innerWidth >= 1440; // mais conservador
                                        return (
                                            diagonalInches > 10 || fallbackLarge
                                        );
                                    } catch {
                                        return false;
                                    }
                                }
                                if (!canShowMonthly()) return null;
                                return (
                                    <button
                                        className={styles.dropdownItem}
                                        onClick={() => {
                                            setAgendaDropdownOpen(false);
                                            const token =
                                                localStorage.getItem(
                                                    'accessToken',
                                                );
                                            if (!token) {
                                                setSessionExpiredOpen(true);
                                                return;
                                            }
                                            const now = new Date();
                                            if (
                                                agendaOpeners &&
                                                !isMobileDevice()
                                            ) {
                                                agendaOpeners.openMonthly(
                                                    selectedClientId || 0,
                                                    now,
                                                );
                                            } else {
                                                const y = now.getFullYear();
                                                const m = String(
                                                    now.getMonth() + 1,
                                                ).padStart(2, '0');
                                                const d = String(
                                                    now.getDate(),
                                                ).padStart(2, '0');
                                                const url = `/agenda?date=${y}-${m}-${d}&mode=month`;
                                                if (isMobileDevice())
                                                    window.location.href = url;
                                                else window.open(url, '_self');
                                            }
                                        }}
                                    >
                                        Agenda Mensal
                                    </button>
                                );
                            })()}
                            <button
                                className={styles.dropdownItem}
                                onClick={async () => {
                                    setAgendaDropdownOpen(false);
                                    const token =
                                        localStorage.getItem('accessToken');
                                    if (!token) {
                                        setSessionExpiredOpen(true);
                                        return;
                                    }
                                    // Permitir abrir sem cliente (fluxo genérico), mas manter alerta opcional
                                    if (!selectedClientId) {
                                        try {
                                            localStorage.setItem(
                                                'agenda.promptSelectClient',
                                                'Você abriu a Agenda sem um cliente selecionado. Dentro do modal é possível escolher ou cancelar.',
                                            );
                                        } catch {
                                            /* ignore */
                                        }
                                    }
                                    if (agendaOpeners && !isMobileDevice()) {
                                        await agendaOpeners.openSchedule(
                                            selectedClientId || undefined,
                                            new Date(),
                                            null,
                                        );
                                        return;
                                    }
                                    try {
                                        const now = new Date();
                                        const y = now.getFullYear();
                                        const m = String(
                                            now.getMonth() + 1,
                                        ).padStart(2, '0');
                                        const d = String(
                                            now.getDate(),
                                        ).padStart(2, '0');
                                        const base = `/agenda?date=${y}-${m}-${d}&new=1`;
                                        const url = selectedClientId
                                            ? `${base}&client=${selectedClientId}`
                                            : base;
                                        if (isMobileDevice())
                                            window.location.href = url;
                                        else window.open(url, '_self');
                                    } catch {
                                        /* noop */
                                    }
                                }}
                            >
                                Novo
                            </button>
                            {selectedClientId ? (
                                <button
                                    className={styles.dropdownItem}
                                    onClick={handleAgendaEditLast}
                                >
                                    Editar
                                </button>
                            ) : null}
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

            {/* Modal de decisão removido */}
            <AgendaSettingsModal
                open={agendaSettingsOpen}
                onClose={() => setAgendaSettingsOpen(false)}
                onApply={() => {
                    // Broadcast para outros componentes recalcularem intervalos ou defaults
                    try {
                        window.dispatchEvent(
                            new CustomEvent('agendaSettingsUpdated'),
                        );
                    } catch {
                        /* noop */
                    }
                }}
            />

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
