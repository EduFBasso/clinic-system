import React from 'react';
import { createPortal } from 'react-dom';
import { isStepEnabled, setStepEnabled } from '../debug/stepper';

type LogItem = { label: string; data?: unknown; ts: number };

export default function DebugPanel() {
    const [enabled, setEnabled] = React.useState(isStepEnabled());
    const [logs, setLogs] = React.useState<LogItem[]>([]);
    const [steps, setSteps] = React.useState<LogItem[]>([]);

    React.useEffect(() => {
        function onToggle() {
            setEnabled(isStepEnabled());
        }
        function onLog(e: Event) {
            const det = (e as CustomEvent).detail as LogItem;
            setLogs(prev => [det, ...prev].slice(0, 100));
        }
        function onStep(e: Event) {
            const det = (e as CustomEvent).detail as LogItem;
            setSteps(prev => [det, ...prev].slice(0, 100));
        }
        window.addEventListener('debug:toggle', onToggle);
        window.addEventListener('debug:log', onLog as EventListener);
        window.addEventListener('debug:step', onStep as EventListener);
        return () => {
            window.removeEventListener('debug:toggle', onToggle);
            window.removeEventListener('debug:log', onLog as EventListener);
            window.removeEventListener('debug:step', onStep as EventListener);
        };
    }, []);

    if (!enabled && logs.length === 0) return null;

    const content = (
        <div
            style={{
                position: 'fixed',
                bottom: 8,
                right: 8,
                zIndex: 2147483647,
                width: 360,
                maxHeight: '60vh',
                overflow: 'auto',
                background: 'rgba(0,0,0,0.85)',
                color: '#d1fae5',
                fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: 12,
                borderRadius: 8,
                boxShadow: '0 4px 18px rgba(0,0,0,0.3)',
                padding: 8,
                pointerEvents: 'auto',
                userSelect: 'text',
            }}
        >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <strong>Debugger</strong>
                <button
                    style={{ marginLeft: 'auto' }}
                    onClick={() => {
                        setStepEnabled(!enabled);
                        setEnabled(isStepEnabled());
                    }}
                >
                    {enabled ? 'Disable step' : 'Enable step'}
                </button>
                {enabled && (
                    <button
                        onClick={() =>
                            window.dispatchEvent(new Event('debug:continue'))
                        }
                        style={{ background: '#10b981', color: '#052e16' }}
                    >
                        Continue ➤
                    </button>
                )}
            </div>
            {enabled && steps.length > 0 && (
                <div style={{ marginTop: 8 }}>
                    <div style={{ color: '#a7f3d0' }}>
                        Steps (most recent first)
                    </div>
                    {steps.map((s, i) => (
                        <div key={s.ts + '-' + i} style={{ marginTop: 4 }}>
                            <div>
                                <span style={{ color: '#34d399' }}>
                                    {new Date(s.ts).toLocaleTimeString()}
                                </span>{' '}
                                <span>{s.label}</span>
                            </div>
                            {s.data != null && (
                                <pre style={{ whiteSpace: 'pre-wrap' }}>
                                    {safeJson(s.data)}
                                </pre>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {logs.length > 0 && (
                <div style={{ marginTop: 8 }}>
                    <div style={{ color: '#fde68a' }}>Logs</div>
                    {logs.map((l, i) => (
                        <div key={l.ts + '-' + i} style={{ marginTop: 4 }}>
                            <div>
                                <span style={{ color: '#fbbf24' }}>
                                    {new Date(l.ts).toLocaleTimeString()}
                                </span>{' '}
                                <span>{l.label}</span>
                            </div>
                            {l.data != null && (
                                <pre style={{ whiteSpace: 'pre-wrap' }}>
                                    {safeJson(l.data)}
                                </pre>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // Render above MUI Modal/backdrop via portal at document.body root
    try {
        const target = document.body;
        return createPortal(content, target);
    } catch {
        return content;
    }
}

function safeJson(x: unknown) {
    try {
        return JSON.stringify(x, null, 2);
    } catch {
        return String(x);
    }
}
