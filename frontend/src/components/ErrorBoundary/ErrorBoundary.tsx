import React from 'react';

type State = { hasError: boolean; error?: Error };

export class ErrorBoundary extends React.Component<
    React.PropsWithChildren,
    State
> {
    state: State = { hasError: false };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Log for diagnostics
        console.error('[ErrorBoundary]', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{
                        padding: 16,
                        fontFamily:
                            'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu',
                        color: 'var(--color-heading)',
                    }}
                >
                    <h2 style={{ marginTop: 0 }}>Houve um erro na interface</h2>
                    <div
                        style={{
                            marginBottom: 8,
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        Detalhes técnicos:
                    </div>
                    <pre
                        style={{
                            background: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            padding: 12,
                            borderRadius: 8,
                            overflowX: 'auto',
                        }}
                    >
                        {this.state.error?.stack ||
                            this.state.error?.message ||
                            'Erro desconhecido'}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: 12,
                            background: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '8px 12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        Recarregar
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
