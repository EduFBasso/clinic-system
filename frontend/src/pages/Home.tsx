// src/pages/Home.tsx
import React from 'react';

import Header from '../components/Header';
import Faixa from '../components/Faixa';
import NavBar from '../components/NavBar';
import MainContent from '../components/MainContent';
import Footer from '../components/Footer';
import styles from '../styles/pages/Home.module.css';

export default function Home() {
    // Função para abrir o cadastro em nova janela
    const handleAddClient = () => {
        window.open(
            '/clients/new',
            '_blank',
            'width=800,height=700,top=80,left=120,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes',
        );
    };

    return (
        <div className={styles.container}>
            <Header />
            <Faixa />
            <NavBar openNewClientModal={handleAddClient} />
            {/* Filtro dinâmico e lista de clientes serão implementados aqui */}
            <MainContent />
            <Footer />
        </div>
    );
}
