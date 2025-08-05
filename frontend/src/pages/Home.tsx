// src/pages/Home.tsx
import React from 'react';

import Header from '../components/Header';
import Faixa from '../components/Faixa';
import NavBar from '../components/NavBar';
import MainContent from '../components/MainContent';
import Footer from '../components/Footer';
import styles from '../styles/pages/Home.module.css';

export default function Home() {
    return (
        <div className={styles.container}>
            <Header />
            <Faixa />
            <NavBar />
            <MainContent />
            <Footer />
        </div>
    );
}
