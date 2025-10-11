import React from 'react';
import formStyles from '../../styles/pages/Client.module.css';

interface Props {
    title: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
}

export default function FormSection({ title, style, children }: Props) {
    return (
        <section style={style}>
            <h3 className={formStyles.panelTitle}>{title}</h3>
            <div
                className={formStyles.formPanels}
                style={{ flexDirection: 'column', gap: '0.75rem' }}
            >
                {children}
            </div>
        </section>
    );
}
