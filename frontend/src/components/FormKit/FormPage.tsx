import React from 'react';
import formStyles from '../../styles/pages/Client.module.css';

interface Props extends React.FormHTMLAttributes<HTMLFormElement> {
    title: string;
}

export default function FormPage({ title, children, ...props }: Props) {
    return (
        <div
            style={{
                maxWidth:
                    '100%' /* permite que o container acompanhe largura da tabela */,
                padding: '2rem',
                margin: '0 auto',
                background: 'var(--color-bg)',
                minHeight: '100vh',
                boxSizing: 'border-box',
                position: 'relative',
                overflowX:
                    'auto' /* habilita scroll horizontal no container raiz */,
                WebkitOverflowScrolling: 'touch' /* suaviza scroll no iOS */,
            }}
        >
            <form {...props} className={formStyles.clientForm}>
                <h2 className={formStyles.formTitle}>{title}</h2>
                {children}
            </form>
        </div>
    );
}
