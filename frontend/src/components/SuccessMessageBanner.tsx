import React, { useEffect, useState } from 'react';

interface Props {
    setSelectedClientId: (id: number | null) => void;
}

export default function SuccessMessageBanner({ setSelectedClientId }: Props) {
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        const msg = localStorage.getItem('clientSuccessMessage');
        if (msg) {
            setMessage(msg);
            localStorage.removeItem('clientSuccessMessage');
            // Limpa seleção visual
            setSelectedClientId(null);
            // Remove banner após 3s
            const timer = setTimeout(() => setMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [setSelectedClientId]);

    if (!message) return null;
    return (
        <div
            style={{
                textAlign: 'center',
                marginBottom: '1rem',
                fontWeight: 'bold',
                color: '#388e3c',
                background: '#e6f9ea',
                border: '1px solid #388e3c',
                borderRadius: 8,
                padding: '1rem',
                fontSize: '1.1rem',
            }}
        >
            {message}
        </div>
    );
}
