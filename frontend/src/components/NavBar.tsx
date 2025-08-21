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
import { useProfessionals } from '../hooks/useProfessionals';
import type { ProfessionalBasic } from '../hooks/useProfessionals';
import styles from '../styles/components/NavBar.module.css';
import AppModal from './Modal';
import '../styles/modal-message.css';

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

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState('');

    // Estado para modal de sessão expirada
    const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);

    // Fecha dropdown ao clicar fora
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const stored = localStorage.getItem('loggedProfessional');
        if (stored) {
            setLoggedProfessional(JSON.parse(stored));
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
                <button
                    className={styles.menuButton}
                    onClick={() => {
                        const token = localStorage.getItem('accessToken');
                        if (!token) {
                            setSessionExpiredOpen(true);
                            return;
                        }
                        setModalMessage('Agenda: Falta implementar o Código');
                        setModalOpen(true);
                    }}
                >
                    📅 Agenda
                </button>
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

            <div className={styles.loginContainer}>
                {loggedProfessional ? (
                    <div className={styles.loggedInfo}>
                        <span>
                            Olá Dr(a) {loggedProfessional.first_name}{' '}
                            {loggedProfessional.last_name}
                            {loggedProfessional.register_number
                                ? ` CRM/COP: ${loggedProfessional.register_number}`
                                : ''}
                        </span>
                        <button
                            className={
                                styles.loginButton + ' ' + styles.logoutButton
                            }
                            onClick={() => {
                                localStorage.removeItem('accessToken');
                                localStorage.removeItem('loggedProfessional');
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
                                            setCodeSent(true);
                                            console.log('codeSent ativado');
                                        } else {
                                            setModalMessage(
                                                data.message ||
                                                    'Erro ao enviar código',
                                            );
                                            setModalOpen(true);
                                        }
                                    } catch {
                                        setModalMessage(
                                            'Erro ao enviar código',
                                        );
                                        setModalOpen(true);
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
                                                    }),
                                                },
                                            );
                                            const data = await res.json();
                                            // Substitui alert por modal para validação do código
                                            if (res.ok && data.access) {
                                                setModalMessage(
                                                    'Login realizado! Dados dos clientes liberados.',
                                                );
                                                setModalOpen(true);
                                                localStorage.setItem(
                                                    'accessToken',
                                                    data.access,
                                                );
                                                setOtp('');
                                                setLoggedProfessional(
                                                    data.professional,
                                                );
                                                localStorage.setItem(
                                                    'loggedProfessional',
                                                    JSON.stringify(
                                                        data.professional,
                                                    ),
                                                );
                                                window.dispatchEvent(
                                                    new Event('updateClients'),
                                                );
                                                // Limpa erro de sessão expirada imediatamente
                                                window.dispatchEvent(
                                                    new Event('clearClients'),
                                                );
                                            } else {
                                                setModalMessage(
                                                    data.message ||
                                                        'Código inválido',
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
            <AppModal open={modalOpen} onClose={() => setModalOpen(false)}>
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
