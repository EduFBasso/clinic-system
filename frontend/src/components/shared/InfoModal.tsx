import React from 'react';

interface InfoModalProps {
    title: string;
    message: string;
    onClose: () => void;
}

export default function InfoModal({ title, message, onClose }: InfoModalProps) {
    return (
        <div
            role='dialog'
            aria-modal='true'
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '1rem',
            }}
        >
            <div
                style={{
                    background: '#fff',
                    borderRadius: 8,
                    padding: '1.25rem 1.5rem',
                    maxWidth: 420,
                    width: '100%',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                    fontSize: '1rem',
                }}
            >
                <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem' }}>
                    {title}
                </h2>
                <p style={{ margin: '0 0 1.25rem', lineHeight: 1.4 }}>
                    {message}
                </p>
                <div style={{ textAlign: 'right' }}>
                    <button
                        type='button'
                        onClick={onClose}
                        style={{
                            background: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '0.6rem 1.1rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}
