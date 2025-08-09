// frontend\src\components\NavBar.tsx
import React, { useState, useRef, useEffect } from 'react';
import styles from '../styles/components/NavBar.module.css';
import { Link } from 'react-router-dom';

interface NavBarProps {
    openNewClientModal?: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ openNewClientModal }) => {
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
    function handleNovoCliente() {
        setDropdownOpen(false);
        if (openNewClientModal) {
            openNewClientModal();
        } else {
            // fallback: navega para /clients/new
            window.location.href = '/clients/new';
        }
    }

    // Handler para editar cliente (integração futura)
    function handleEditarCliente() {
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
                                onClick={handleNovoCliente}
                            >
                                Novo
                            </button>
                            <button
                                className={styles.dropdownItem}
                                onClick={handleEditarCliente}
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
                <input
                    type='text'
                    placeholder='Usuário'
                    className={styles.loginInput}
                />
                <input
                    type='password'
                    placeholder='Senha'
                    className={styles.loginInput}
                />
                <button className={styles.loginButton}>Entrar</button>
            </div>
        </div>
    );
};

export default NavBar;
