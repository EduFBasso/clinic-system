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
import AboutModal from './AboutModal';
import { useSessionsSummary } from '../hooks/useSessions';
import SessionExpiredModal from './SessionExpiredModal';
import { API_BASE } from '../config/api';
import { openClientForm } from '../utils/openClientForm';
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
import AgendaSettingsModal from './AgendaSettingsModal';
// formatTime removido: não exibimos mais relógio no header
import AppModal from './Modal';
import '../styles/modal-message.css';
import { isTokenExpired } from '../utils/jwt';

interface NavBarProps {
    openNewClientModal?: () => void;
    selectedClientId?: number | null;
    agendaOpeners?: {
        openMonthly: (clientId: number, date?: Date) => void | Promise<void>;
        openWeekly: (date?: Date) => void | Promise<void>;
    };
}

const NavBar: React.FC<NavBarProps> = ({
    openNewClientModal,
    selectedClientId,
    agendaOpeners,
}) => {
    // Viewport listener removido (usado apenas pelo relógio)
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
    // Consulta dropdown state
    const [consultaDropdownOpen, setConsultaDropdownOpen] = useState(false);
    const consultaDropdownRef = useRef<HTMLDivElement>(null);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    // Modal de decisão para Novo Compromisso quando já existe um ativo
    // Estados de decisão de novo compromisso removidos após simplificação do menu
    // Modal configurações agenda
    const [agendaSettingsOpen, setAgendaSettingsOpen] = useState(false);
    // Quando true após solicitar OTP com sucesso, só revela o campo após clicar em OK no modal
    const [otpSentConfirmPending, setOtpSentConfirmPending] = useState(false);
    // About modal state
    const [aboutOpen, setAboutOpen] = useState(false);
    // Trigger summary fetch when dropdown toggles open
    const { summary } = useSessionsSummary(dropdownOpen);

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
            if (
                consultaDropdownRef.current &&
                !consultaDropdownRef.current.contains(target)
            ) {
                setConsultaDropdownOpen(false);
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
        if (openNewClientModal && isMobileDevice()) {
            // Caso específico: se houver modal especial mobile
            openNewClientModal();
            return;
        }
        openClientForm({});
    }

    // Handler para editar cliente (integração futura)
    // Função removida (duplicada)

    function handleEditClient() {
        setDropdownOpen(false);
        if (!selectedClientId) {
            alert('Selecione um cliente antes de editar.');
            return;
        }
        openClientForm({ id: selectedClientId });
    }

    // Helpers Agenda
    // Helper de busca de próximo agendamento removido (não utilizado após retirar 'Editar')

    // goAgendaDay removed: unificamos via modais (sem rota /schedule)

    // Edição via menu Agenda removida (opção Editar retirada)

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
                        <span className={styles.caret}>▼</span>
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
                            <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                    setDropdownOpen(false);
                                    setAboutOpen(true);
                                }}
                            >
                                Sobre{' '}
                                {summary && summary.has_others && (
                                    <span
                                        style={{
                                            marginLeft: 6,
                                            background: 'crimson',
                                            color: '#fff',
                                            borderRadius: 8,
                                            padding: '0 6px',
                                            fontSize: 11,
                                            lineHeight: '16px',
                                            display: 'inline-block',
                                        }}
                                        title={`Sessões ativas: ${summary.count}`}
                                    >
                                        {summary.count}
                                    </span>
                                )}
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
                        📅 Agenda <span className={styles.caret}>▼</span>
                    </button>
                    {agendaDropdownOpen && (
                        <div className={styles.dropdownMenu}>
                            {/** Menu Agenda simplificado: Configurações, Agenda Diária, Semanal e Mensal (>10"). */}
                            <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                    setAgendaDropdownOpen(false);
                                    setAgendaSettingsOpen(true);
                                }}
                            >
                                Configurações
                            </button>
                            <div
                                style={{
                                    height: 1,
                                    background: 'var(--border-subtle)',
                                    margin: '6px 0',
                                }}
                                aria-hidden
                            />

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
                                                // Requer um cliente selecionado para abrir a agenda mensal
                                                if (!selectedClientId) {
                                                    try {
                                                        window.dispatchEvent(
                                                            new CustomEvent(
                                                                'systemMessage',
                                                                {
                                                                    detail: {
                                                                        text: 'Selecione um cliente para abrir a Agenda Mensal.',
                                                                        type: 'info',
                                                                        autoCloseMs: 6000,
                                                                    },
                                                                },
                                                            ),
                                                        );
                                                    } catch {
                                                        /* noop */
                                                    }
                                                    return;
                                                }
                                                agendaOpeners.openMonthly(
                                                    selectedClientId,
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
                                                // Em dispositivos móveis, navegar com client=id para abrir o modal com o cliente correto
                                                const url = selectedClientId
                                                    ? `/agenda?client=${selectedClientId}&date=${y}-${m}-${d}&mode=month`
                                                    : `/agenda?date=${y}-${m}-${d}&mode=month`;
                                                if (!selectedClientId) {
                                                    try {
                                                        window.dispatchEvent(
                                                            new CustomEvent(
                                                                'systemMessage',
                                                                {
                                                                    detail: {
                                                                        text: 'Selecione um cliente para abrir a Agenda Mensal.',
                                                                        type: 'info',
                                                                        autoCloseMs: 6000,
                                                                    },
                                                                },
                                                            ),
                                                        );
                                                    } catch {
                                                        /* noop */
                                                    }
                                                    // Mesmo sem cliente, ainda permite navegar para visão mensal geral (sem cliente) se desejado
                                                    // Aqui mantemos o comportamento anterior: segue para a URL sem client
                                                }
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
                            {/* Opções 'Novo' e 'Editar' removidas para simplificar e evitar redundâncias */}
                        </div>
                    )}
                </div>
                <div
                    className={styles.dropdownWrapper}
                    ref={consultaDropdownRef}
                >
                    <button
                        className={styles.menuButton}
                        onClick={() => {
                            const token = localStorage.getItem('accessToken');
                            if (!token) {
                                setSessionExpiredOpen(true);
                                return;
                            }
                            setConsultaDropdownOpen(open => !open);
                        }}
                        aria-haspopup='true'
                        aria-expanded={consultaDropdownOpen}
                    >
                        🩺 Consulta <span className={styles.caret}>▼</span>
                    </button>
                    {consultaDropdownOpen && (
                        <div className={styles.dropdownMenu}>
                            <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                    setConsultaDropdownOpen(false);
                                    window.location.href =
                                        '/catalog/services/new';
                                }}
                            >
                                + Procedimento
                            </button>
                            <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                    setConsultaDropdownOpen(false);
                                    window.location.href =
                                        '/catalog/products/new';
                                }}
                            >
                                + Produto
                            </button>
                        </div>
                    )}
                </div>
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
                            {/* Relógio removido por decisão de produto */}
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
                            {/* Relógio removido para simplificação */}
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
                                <span className={styles.caret}>▼</span>
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
                unmountOnClose
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
            <AboutModal
                open={aboutOpen}
                onClose={() => setAboutOpen(false)}
                buildCommit={
                    import.meta.env?.VITE_APP_COMMIT as string | undefined
                }
                buildTime={
                    import.meta.env?.VITE_BUILD_TIME as string | undefined
                }
            />
        </div>
    );
};

export default NavBar;
