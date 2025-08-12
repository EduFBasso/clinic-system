// frontend\src\components\NavBar.tsx
import { Link } from 'react-router-dom';
import React, { useState, useRef, useEffect } from 'react';
import { useProfessionals } from '../hooks/useProfessionals';
import styles from '../styles/components/NavBar.module.css';

interface NavBarProps {
    openNewClientModal?: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ openNewClientModal }) => {
    const [selectedProfessional, setSelectedProfessional] =
        useState<string>('');
    const [codeSent, setCodeSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [loadingOtp, setLoadingOtp] = useState(false);

    const [professionalDropdownOpen, setProfessionalDropdownOpen] =
        useState(false);

    const professionalDropdownRef = useRef<HTMLDivElement>(null);

    const { professionals, loading, error } = useProfessionals();

    // Dropdown state
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    // Handler para abrir modal de novo cliente (integração futura)
    function handleNewClient() {
        setDropdownOpen(false);
        if (openNewClientModal) {
            openNewClientModal();
        } else {
            // fallback: navega para /clients/new
            window.location.href = '/clients/new';
        }
    }

    // Handler para editar cliente (integração futura)
    function handleEditClient() {
        setDropdownOpen(false);
        // Aqui você pode navegar para a edição do cliente selecionado
        alert('Abrir edição do cliente selecionado (implementar)');
    }

    return (
        <div className={styles.navBar}>
            <div className={styles.menuContainer}>
                <div className={styles.dropdownWrapper} ref={dropdownRef}>
                    <button
                        className={styles.menuButton}
                        onClick={() => setDropdownOpen(open => !open)}
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
                <Link to='/agenda'>
                    <button className={styles.menuButton}>📅 Agenda</button>
                </Link>
                <Link to='/consultations'>
                    <button className={styles.menuButton}>🩺 Consulta</button>
                </Link>
            </div>

            <div className={styles.loginContainer}>
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
                                      p => p.email === selectedProfessional,
                                  )?.first_name +
                                  ' ' +
                                  professionals.find(
                                      p => p.email === selectedProfessional,
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
                                        setSelectedProfessional(prof.email);
                                        setProfessionalDropdownOpen(false);
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
                                    '/register/auth/request-code/',
                                    {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify({
                                            email: selectedProfessional,
                                        }),
                                    },
                                );
                                const data = await res.json();
                                // Se vier message e status 200, considera sucesso
                                if (data.message && res.ok) {
                                    setCodeSent(true);
                                    console.log('codeSent ativado');
                                    setTimeout(() => {
                                        alert(data.message);
                                    }, 100);
                                } else {
                                    alert(
                                        data.message || 'Erro ao enviar código',
                                    );
                                }
                            } catch {
                                alert('Erro ao enviar código');
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
                                        '/register/auth/verify-code/',
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
                                    if (res.ok && data.access) {
                                        alert(
                                            'Login realizado! Dados dos clientes liberados.',
                                        );
                                        localStorage.setItem(
                                            'accessToken',
                                            data.access,
                                        );
                                        // Aqui você pode liberar o acesso aos dados dos clientes
                                    } else {
                                        alert(
                                            data.message || 'Código inválido',
                                        );
                                    }
                                } catch {
                                    alert('Erro ao validar código');
                                }
                                setLoadingOtp(false);
                            }}
                            disabled={loadingOtp || !otp}
                        >
                            Entrar
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default NavBar;
