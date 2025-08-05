// frontend\src\components\NavBar.tsx
import React from 'react';
import styles from '../styles/components/NavBar.module.css';
import { Link } from 'react-router-dom';

const NavBar: React.FC = () => {
    return (
        <div className={styles.navBar}>
            <div className={styles.menuContainer}>
                <Link to='/clients'>
                    <button className={styles.menuButton}>👤 Clientes</button>
                </Link>
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
