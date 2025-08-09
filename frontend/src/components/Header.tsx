// frontend\src\components\Header.tsx
import styles from '../styles/components/Header.module.css';

const Header = () => {
    return (
        <header className={styles.header}>
            <h1 className={styles.headerTitle}>Sistema de Gestão Clinica</h1>
        </header>
    );
};

export default Header;
