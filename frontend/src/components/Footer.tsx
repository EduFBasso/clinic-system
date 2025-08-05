// frontend\src\components\Footer.tsx
import styles from '../styles/components/Footer.module.css';

const Footer = () => {
    return (
        <footer className={styles.footer}>
            <p>&copy; {new Date().getFullYear()} Meu Projeto em React</p>
            <p>Todos os direitos reservados.</p>
            <p>Desenvolvido por Eduardo</p>
        </footer>
    );
};

export default Footer;
