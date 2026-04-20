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
import type { Professional as ProfessionalBasic } from '../types/models';
import styles from '../styles/components/NavBar.module.css';
import AgendaSettingsModal from './AgendaSettingsModal';
// formatTime removido: não exibimos mais relógio no header
import AppModal from './Modal';
import '../styles/modal-message.css';
import { isTokenExpired } from '../utils/jwt';
import { emit, on } from '../events/bus';
import {
    clearStoredAuth,
    dispatchLogout,
    hasActiveSession,
} from '../utils/auth/session';
import ProfessionalCreateModal from './ProfessionalCreateModal';
import TotpAdminResetModal from './TotpAdminResetModal';
import {
    startRegistration,
    startAuthentication,
} from '@simplewebauthn/browser';
import { useNavigate } from 'react-router-dom';

interface NavBarProps {
    openNewClientModal?: () => void;
    selectedClientId?: number | null;
    agendaOpeners?: {
        openWeekly: (date?: Date) => void | Promise<void>;
    };
}

const NavBar: React.FC<NavBarProps> = ({
    openNewClientModal,
    selectedClientId,
    agendaOpeners,
}) => {
    const navigate = useNavigate();
    const biometricStorageKey = React.useCallback((email: string) => {
        return `hasWebAuthn_${email.trim().toLowerCase()}`;
    }, []);

    // Viewport listener removido (usado apenas pelo relógio)
    const [loginEmail, setLoginEmail] = useState<string>(
        () => localStorage.getItem('lastLoginEmail') ?? '',
    );
    const [totpCode, setTotpCode] = useState('');
    const [loadingOtp, setLoadingOtp] = useState(false);
    const [loggedProfessional, setLoggedProfessional] =
        useState<ProfessionalBasic | null>(() => {
            const stored = localStorage.getItem('loggedProfessional');
            return stored ? JSON.parse(stored) : null;
        });

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

    // About modal state
    const [aboutOpen, setAboutOpen] = useState(false);
    // Admin modals (superuser only)
    const [createProfOpen, setCreateProfOpen] = useState(false);
    const [totpResetOpen, setTotpResetOpen] = useState(false);
    // Biometric / WebAuthn
    const [offerBiometricOpen, setOfferBiometricOpen] = useState(false);
    const [biometricLoading, setBiometricLoading] = useState(false);
    const [platformAuthenticatorAvailable, setPlatformAuthenticatorAvailable] =
        useState(false);
    const [biometricConfigured, setBiometricConfigured] = useState(false);
    const hasWebAuthn = !!loginEmail && platformAuthenticatorAvailable;
    // Estado para modal de sessão expirada
    const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);
    const [sessionExpiredMessage, setSessionExpiredMessage] = useState(
        'Sua sessão expirou. Por favor, faça login novamente.',
    );

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
            clearStoredAuth({ clearNewClientId: false });
            setLoggedProfessional(null);
        } else {
            const stored = localStorage.getItem('loggedProfessional');
            if (stored) setLoggedProfessional(JSON.parse(stored));
        }
    }, []);

    useEffect(() => {
        const disposeLogin = on('auth:login', () => {
            try {
                const stored = localStorage.getItem('loggedProfessional');
                setLoggedProfessional(stored ? JSON.parse(stored) : null);
            } catch {
                setLoggedProfessional(null);
            }
            setSessionExpiredOpen(false);
            setSessionExpiredMessage(
                'Sua sessão expirou. Por favor, faça login novamente.',
            );
        });

        const disposeLogout = on('auth:logout', detail => {
            setLoggedProfessional(null);
            setTotpCode('');
            setDropdownOpen(false);
            setAgendaDropdownOpen(false);
            setConsultaDropdownOpen(false);

            if (detail?.reason && detail.reason !== 'manual') {
                setSessionExpiredMessage(
                    detail.reason === 'device_session_invalid'
                        ? 'Sua sessão deste dispositivo foi encerrada ou invalidada. Faça login novamente para continuar usando agenda, notificações e ações protegidas.'
                        : 'Sua sessão expirou. Faça login novamente para continuar usando agenda, notificações e ações protegidas.',
                );
                setSessionExpiredOpen(true);
            }
        });

        return () => {
            disposeLogin();
            disposeLogout();
        };
    }, []);

    useEffect(() => {
        const email = (loggedProfessional?.email || loginEmail || '').trim();
        if (!email) {
            setBiometricConfigured(false);
            return;
        }
        setBiometricConfigured(
            !!localStorage.getItem(biometricStorageKey(email)),
        );
    }, [biometricStorageKey, loggedProfessional, loginEmail]);

    useEffect(() => {
        let active = true;
        async function detectPlatformAuthenticator() {
            try {
                if (
                    typeof PublicKeyCredential === 'undefined' ||
                    typeof (
                        PublicKeyCredential as {
                            isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
                        }
                    ).isUserVerifyingPlatformAuthenticatorAvailable !==
                        'function'
                ) {
                    if (active) setPlatformAuthenticatorAvailable(false);
                    return;
                }

                const available = await (
                    PublicKeyCredential as {
                        isUserVerifyingPlatformAuthenticatorAvailable: () => Promise<boolean>;
                    }
                ).isUserVerifyingPlatformAuthenticatorAvailable();
                if (active) setPlatformAuthenticatorAvailable(Boolean(available));
            } catch {
                if (active) setPlatformAuthenticatorAvailable(false);
            }
        }

        void detectPlatformAuthenticator();
        return () => {
            active = false;
        };
    }, []);

    const openSessionExpiredState = React.useCallback(
        (
            reason: 'session_expired' | 'device_session_invalid' =
                'session_expired',
        ) => {
            dispatchLogout(reason);
        },
        [],
    );

    const toggleProtectedDropdown = React.useCallback(
        (toggle: React.Dispatch<React.SetStateAction<boolean>>) => {
            if (!hasActiveSession()) {
                openSessionExpiredState();
                return;
            }

            toggle(open => !open);
        },
        [openSessionExpiredState],
    );

    // Handler para abrir modal de novo cliente (integração futura)
    // ...existing code...

    function handleNewClient() {
        setDropdownOpen(false);
        if (!hasActiveSession()) {
            openSessionExpiredState();
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

    // --- WebAuthn: register biometric after TOTP login ---
    const handleRegisterBiometric = async () => {
        setBiometricLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const email = (loggedProfessional?.email || loginEmail || '').trim();
            if (!token || !email) {
                throw new Error('Entre na conta antes de ativar a biometria.');
            }
            const beginRes = await fetch(
                `${API_BASE}/register/auth/webauthn/register-begin/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({}),
                },
            );
            if (!beginRes.ok) throw new Error('Erro ao iniciar registro.');
            const options = await beginRes.json();
            const credential = await startRegistration({
                optionsJSON: options,
            });
            const ua = navigator.userAgent;
            const deviceName = /iPhone/.test(ua)
                ? 'iPhone'
                : /iPad/.test(ua)
                  ? 'iPad'
                  : /Mac/.test(ua)
                    ? 'Mac'
                    : 'Dispositivo';
            const completeRes = await fetch(
                `${API_BASE}/register/auth/webauthn/register-complete/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        credential,
                        device_name: deviceName,
                    }),
                },
            );
            if (!completeRes.ok) throw new Error('Erro ao concluir registro.');
            localStorage.setItem(
                biometricStorageKey(email),
                '1',
            );
            setBiometricConfigured(true);
            setOfferBiometricOpen(false);
            setModalMessage('Face ID ativado para futuros logins!');
            setModalOpen(true);
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : 'Erro ao registrar biometria.';
            setModalMessage(msg);
            setModalOpen(true);
        } finally {
            setBiometricLoading(false);
        }
    };

    // --- WebAuthn: login with biometric ---
    const handleWebAuthnLogin = async () => {
        setBiometricLoading(true);
        try {
            const beginRes = await fetch(
                `${API_BASE}/register/auth/webauthn/login-begin/`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: loginEmail }),
                },
            );
            if (!beginRes.ok) throw new Error('Erro ao iniciar autenticação.');
            const options = await beginRes.json();
            const assertion = await startAuthentication({
                optionsJSON: options,
            });
            const deviceIdKey = 'device_id';
            const deviceId = getOrCreateDeviceId(deviceIdKey);
            const completeRes = await fetch(
                `${API_BASE}/register/auth/webauthn/login-complete/`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: loginEmail,
                        assertion,
                        device_id: deviceId,
                    }),
                },
            );
            let data: VerifyResponse = {};
            try {
                data = await completeRes.json();
            } catch {
                data = { message: 'Falha ao interpretar resposta do servidor' };
            }
            if (completeRes.ok && data.access) {
                setModalMessage('Login realizado!');
                setModalOpen(true);
                localStorage.setItem('accessToken', data.access);
                localStorage.setItem('lastLoginEmail', loginEmail);
                localStorage.setItem(
                    biometricStorageKey(loginEmail),
                    '1',
                );
                setBiometricConfigured(true);
                localStorage.setItem(
                    'loggedProfessional',
                    JSON.stringify(data.professional),
                );
                if (data.device_id) {
                    localStorage.setItem(deviceIdKey, String(data.device_id));
                }
                setLoggedProfessional(data.professional || null);
                if (data.professional?.is_superuser) {
                    navigate('/admin', { replace: true });
                    return;
                }
                emit('auth:login', undefined);
                window.dispatchEvent(new Event('updateClients'));
                window.dispatchEvent(new Event('clearClients'));
            } else {
                setModalMessage(
                    String(data.message || 'Autenticação biométrica falhou.'),
                );
                setModalOpen(true);
            }
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : 'Erro na autenticação biométrica.';
            // User cancelled the prompt → just ignore, no error modal
            if (
                !msg.toLowerCase().includes('cancel') &&
                !msg.toLowerCase().includes('not allowed')
            ) {
                setModalMessage(msg);
                setModalOpen(true);
            }
        } finally {
            setBiometricLoading(false);
        }
    };

    return (
        <div className={styles.navBar}>
            <div className={styles.menuContainer}>
                <div className={styles.dropdownWrapper} ref={dropdownRef}>
                    <button
                        className={styles.menuButton}
                        onClick={() => {
                            if (!hasActiveSession()) {
                                openSessionExpiredState();
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
                                Sobre
                            </button>
                            {/* Opções adicionais removidas para simplificar o menu de Clientes */}
                        </div>
                    )}
                </div>
                {/* Agenda dropdown reintroduzido */}
                <div className={styles.dropdownWrapper} ref={agendaDropdownRef}>
                    <button
                        className={styles.menuButton}
                        onClick={() =>
                            toggleProtectedDropdown(setAgendaDropdownOpen)
                        }
                        aria-haspopup='true'
                        aria-expanded={agendaDropdownOpen}
                    >
                        📆 Agenda <span className={styles.caret}>▼</span>
                    </button>
                    {agendaDropdownOpen && (
                        <div className={styles.dropdownMenu}>
                            <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                    setAgendaDropdownOpen(false);
                                    if (!hasActiveSession()) {
                                        openSessionExpiredState();
                                        return;
                                    }
                                    // Abrir agenda diária via evento (usar {} para evitar access de propriedades em undefined no handler)
                                    emit('openDailyAgenda', {});
                                }}
                            >
                                Agenda Diária
                            </button>
                            <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                    setAgendaDropdownOpen(false);
                                    if (!hasActiveSession()) {
                                        openSessionExpiredState();
                                        return;
                                    }
                                    const now = new Date();
                                    if (agendaOpeners) {
                                        agendaOpeners.openWeekly(now);
                                    } else {
                                        emit('openDailyAgenda', {});
                                    }
                                }}
                            >
                                Agenda
                            </button>
                            <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                    setAgendaDropdownOpen(false);
                                    setAgendaSettingsOpen(true);
                                }}
                            >
                                Configurações
                            </button>
                        </div>
                    )}
                </div>
                <div
                    className={styles.dropdownWrapper}
                    ref={consultaDropdownRef}
                >
                    <button
                        className={styles.menuButton}
                        onClick={() =>
                            toggleProtectedDropdown(setConsultaDropdownOpen)
                        }
                        aria-haspopup='true'
                        aria-expanded={consultaDropdownOpen}
                    >
                        🩺 Catálogo <span className={styles.caret}>▼</span>
                    </button>
                    {consultaDropdownOpen && (
                        <div className={styles.dropdownMenu}>
                            <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                    setConsultaDropdownOpen(false);
                                    if (!hasActiveSession()) {
                                        openSessionExpiredState();
                                        return;
                                    }
                                    navigate('/catalog/services');
                                }}
                                title='Serviços'
                            >
                                📋 Serviços
                            </button>
                            <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                    setConsultaDropdownOpen(false);
                                    if (!hasActiveSession()) {
                                        openSessionExpiredState();
                                        return;
                                    }
                                    navigate('/catalog/products');
                                }}
                                title='Produtos'
                            >
                                📦 Produtos
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
                            <span className={styles.nameLine}>
                                Olá, {loggedProfessional.first_name}
                            </span>
                        </div>
                        <button
                            className={
                                styles.loginButton + ' ' + styles.logoutButton
                            }
                            onClick={() => {
                                setLoggedProfessional(null);
                                setLoginEmail('');
                                setTotpCode('');
                                dispatchLogout('manual');
                            }}
                        >
                            Sair
                        </button>
                        {/* Superusers são redirecionados para /admin no login e não usam ações do NavBar */}
                    </div>
                ) : (
                    <>
                        {/* TOTP login: email + código do Google Authenticator */}
                        <input
                            type='email'
                            placeholder='E-mail'
                            className={styles.loginInput}
                            value={loginEmail}
                            onChange={e => setLoginEmail(e.target.value)}
                            style={{ marginRight: 6 }}
                            autoComplete='username'
                        />
                        <input
                            type='text'
                            inputMode='numeric'
                            placeholder='Código (6 dígitos)'
                            className={styles.loginInput}
                            value={totpCode}
                            onChange={e =>
                                setTotpCode(
                                    e.target.value
                                        .replace(/\D/g, '')
                                        .slice(0, 6),
                                )
                            }
                            style={{ marginRight: 6, width: 120 }}
                            autoComplete='one-time-code'
                            onKeyDown={e => {
                                if (e.key === 'Enter')
                                    e.currentTarget
                                        .closest('form')
                                        ?.requestSubmit();
                            }}
                        />
                        {hasWebAuthn && (
                            <button
                                className={styles.loginButton}
                                disabled={biometricLoading || !loginEmail}
                                onClick={handleWebAuthnLogin}
                                title='Entrar com biometria'
                                style={{ marginRight: 6 }}
                            >
                                {biometricLoading ? '...' : '🔒 Face ID'}
                            </button>
                        )}
                        <button
                            className={styles.loginButton}
                            disabled={
                                loadingOtp ||
                                !loginEmail ||
                                totpCode.length !== 6
                            }
                            onClick={async () => {
                                setLoadingOtp(true);
                                try {
                                    const deviceIdKey = 'device_id';
                                    const deviceId =
                                        getOrCreateDeviceId(deviceIdKey);
                                    const res = await fetch(
                                        `${API_BASE}/register/auth/totp/verify/`,
                                        {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type':
                                                    'application/json',
                                            },
                                            body: JSON.stringify({
                                                email: loginEmail,
                                                code: totpCode,
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
                                    if (res.ok && data.access) {
                                        setModalMessage(
                                            'Login realizado! Dados dos clientes liberados.',
                                        );
                                        setModalOpen(true);
                                        localStorage.setItem(
                                            'accessToken',
                                            data.access,
                                        );
                                        setTotpCode('');
                                        setLoggedProfessional(
                                            data.professional || null,
                                        );
                                        localStorage.setItem(
                                            'loggedProfessional',
                                            JSON.stringify(data.professional),
                                        );
                                        if (data.device_id) {
                                            localStorage.setItem(
                                                deviceIdKey,
                                                String(data.device_id),
                                            );
                                        }
                                        if (data.professional?.is_superuser) {
                                            navigate('/admin', {
                                                replace: true,
                                            });
                                            return;
                                        }
                                        emit('auth:login', undefined);
                                        window.dispatchEvent(
                                            new Event('updateClients'),
                                        );
                                        window.dispatchEvent(
                                            new Event('clearClients'),
                                        );
                                        localStorage.setItem(
                                            'lastLoginEmail',
                                            loginEmail,
                                        );
                                        // Offer biometric registration if not already set
                                        if (
                                            !localStorage.getItem(
                                                biometricStorageKey(loginEmail),
                                            ) &&
                                            typeof PublicKeyCredential !==
                                                'undefined' &&
                                            typeof (
                                                PublicKeyCredential as {
                                                    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
                                                }
                                            )
                                                .isUserVerifyingPlatformAuthenticatorAvailable ===
                                                'function'
                                        ) {
                                            try {
                                                const ok = await (
                                                    PublicKeyCredential as {
                                                        isUserVerifyingPlatformAuthenticatorAvailable: () => Promise<boolean>;
                                                    }
                                                ).isUserVerifyingPlatformAuthenticatorAvailable();
                                                if (ok)
                                                    setOfferBiometricOpen(true);
                                            } catch {
                                                /* ignore */
                                            }
                                        }
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
                                    setModalMessage('Erro ao validar código');
                                    setModalOpen(true);
                                }
                                setLoadingOtp(false);
                            }}
                        >
                            Entrar
                        </button>
                    </>
                )}
            </div>

            {/* Modal padrão para mensagens */}
            <AppModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                unmountOnClose
            >
                <div className='modal-message'>
                    <h3>{modalMessage}</h3>
                    <button onClick={() => setModalOpen(false)}>Ok</button>
                </div>
            </AppModal>

            {/* Modal de sessão expirada */}
            <SessionExpiredModal
                open={sessionExpiredOpen}
                onClose={() => {
                    setSessionExpiredOpen(false);
                    dispatchLogout('manual');
                }}
                message={sessionExpiredMessage}
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
            <ProfessionalCreateModal
                open={createProfOpen}
                onClose={() => setCreateProfOpen(false)}
            />
            <TotpAdminResetModal
                open={totpResetOpen}
                onClose={() => setTotpResetOpen(false)}
            />
            {/* Modal: oferecer registro de biometria após login TOTP */}
            <AppModal
                open={offerBiometricOpen}
                onClose={() => setOfferBiometricOpen(false)}
                unmountOnClose
            >
                <div className='modal-message'>
                    <h3>Ativar Face ID / Touch ID?</h3>
                    <p style={{ fontSize: 14, marginBottom: 16 }}>
                        Use a biometria do dispositivo para entrar sem digitar o
                        código nas próximas vezes.
                    </p>
                    <div
                        style={{
                            display: 'flex',
                            gap: 8,
                            justifyContent: 'center',
                        }}
                    >
                        <button
                            onClick={handleRegisterBiometric}
                            disabled={biometricLoading}
                        >
                            {biometricLoading ? 'Aguarde...' : 'Sim, ativar'}
                        </button>
                        <button onClick={() => setOfferBiometricOpen(false)}>
                            Agora não
                        </button>
                    </div>
                </div>
            </AppModal>
        </div>
    );
};

export default NavBar;
