import React from 'react';
import formStyles from '../../styles/pages/Client.module.css';

interface Props extends React.FormHTMLAttributes<HTMLFormElement> {
    title: string;
}

export default function FormPage({ title, children, ...props }: Props) {
    return (
        <div
            style={{
                maxWidth: '900px',
                padding: '2rem',
                margin: 'auto',
                background: 'var(--color-bg)',
                minHeight: '100vh',
                boxSizing: 'border-box',
                position: 'relative',
            }}
        >
            <form {...props} className={formStyles.clientForm}>
                <h2 className={formStyles.formTitle}>{title}</h2>
                {children}
            </form>
        </div>
    );
}
