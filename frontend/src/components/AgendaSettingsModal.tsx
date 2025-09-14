import React from 'react';
import AppModal from './Modal';
import styles from '../styles/components/NavBar.module.css';

interface AgendaSettingsModalProps {
    open: boolean;
    onClose: () => void;
    onApply?: () => void; // callback após salvar
}

// Chaves de localStorage
const LS_KEYS = {
    workStart: 'agenda.workStart',
    workEnd: 'agenda.workEnd',
    slotInterval: 'agenda.slotInterval',
    defaultDuration: 'agenda.defaultDuration',
    defaultVisitType: 'defaultVisitType', // já usada anteriormente
    autoSuggest: 'agenda.autoSuggestNext',
};

const intervalOptions = [5, 10, 15, 20, 30];
const durationOptions = [30, 40, 50, 60, 90];
const visitTypes = [
    { value: 'consulta', label: 'Consulta' },
    { value: 'avaliacao', label: 'Avaliação' },
    { value: 'retorno', label: 'Retorno' },
    { value: 'procedimento', label: 'Procedimento' },
    { value: 'outro', label: 'Outro' },
];

function clampHM(v: string, fallback: string) {
    if (!/^\d{2}:\d{2}$/.test(v)) return fallback;
    const [h, m] = v.split(':').map(n => parseInt(n, 10));
    if (isNaN(h) || isNaN(m)) return fallback;
    return `${String(Math.min(23, Math.max(0, h))).padStart(2, '0')}:${String(
        Math.min(59, Math.max(0, m)),
    ).padStart(2, '0')}`;
}

const AgendaSettingsModal: React.FC<AgendaSettingsModalProps> = ({
    open,
    onClose,
    onApply,
}) => {
    const [workStart, setWorkStart] = React.useState('06:00');
    const [workEnd, setWorkEnd] = React.useState('21:00');
    const [slotInterval, setSlotInterval] = React.useState(10);
    const [defaultDuration, setDefaultDuration] = React.useState(60);
    const [defaultVisitType, setDefaultVisitType] = React.useState('consulta');
    const [autoSuggest, setAutoSuggest] = React.useState(true);
    const [savedMsg, setSavedMsg] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) return;
        // Carrega valores atuais
        setSavedMsg(null);
        setWorkStart(
            clampHM(
                localStorage.getItem(LS_KEYS.workStart) || '06:00',
                '06:00',
            ),
        );
        setWorkEnd(
            clampHM(localStorage.getItem(LS_KEYS.workEnd) || '21:00', '21:00'),
        );
        const si = parseInt(
            localStorage.getItem(LS_KEYS.slotInterval) || '10',
            10,
        );
        setSlotInterval(intervalOptions.includes(si) ? si : 10);
        const dd = parseInt(
            localStorage.getItem(LS_KEYS.defaultDuration) || '60',
            10,
        );
        setDefaultDuration(durationOptions.includes(dd) ? dd : 60);
        const vt = localStorage.getItem(LS_KEYS.defaultVisitType) || 'consulta';
        setDefaultVisitType(
            visitTypes.some(v => v.value === vt) ? vt : 'consulta',
        );
        setAutoSuggest(localStorage.getItem(LS_KEYS.autoSuggest) !== 'false');
    }, [open]);

    function save() {
        // valida ordem
        if (workEnd <= workStart) {
            setSavedMsg('Fim deve ser maior que início.');
            return;
        }
        localStorage.setItem(LS_KEYS.workStart, workStart);
        localStorage.setItem(LS_KEYS.workEnd, workEnd);
        localStorage.setItem(LS_KEYS.slotInterval, String(slotInterval));
        localStorage.setItem(LS_KEYS.defaultDuration, String(defaultDuration));
        localStorage.setItem(LS_KEYS.defaultVisitType, defaultVisitType);
        localStorage.setItem(
            LS_KEYS.autoSuggest,
            autoSuggest ? 'true' : 'false',
        );
        setSavedMsg('Configurações salvas.');
        if (onApply) onApply();
        // Mantém aberto para permitir ajustes contínuos
    }

    return (
        <AppModal open={open} onClose={onClose} closeOnEnter={false}>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    minWidth: 420,
                }}
            >
                <h2 style={{ margin: 0 }}>Configurações da Agenda</h2>
                <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <label
                            style={{ display: 'flex', flexDirection: 'column' }}
                        >
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                                Início expediente
                            </span>
                            <input
                                type='time'
                                value={workStart}
                                onChange={e =>
                                    setWorkStart(
                                        clampHM(e.target.value, '06:00'),
                                    )
                                }
                            />
                        </label>
                        <label
                            style={{ display: 'flex', flexDirection: 'column' }}
                        >
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                                Fim expediente
                            </span>
                            <input
                                type='time'
                                value={workEnd}
                                onChange={e =>
                                    setWorkEnd(clampHM(e.target.value, '21:00'))
                                }
                            />
                        </label>
                        <label
                            style={{ display: 'flex', flexDirection: 'column' }}
                        >
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                                Intervalo (min)
                            </span>
                            <select
                                value={slotInterval}
                                onChange={e =>
                                    setSlotInterval(
                                        parseInt(e.target.value, 10),
                                    )
                                }
                            >
                                {intervalOptions.map(i => (
                                    <option key={i} value={i}>
                                        {i}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label
                            style={{ display: 'flex', flexDirection: 'column' }}
                        >
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                                Duração padrão (min)
                            </span>
                            <select
                                value={defaultDuration}
                                onChange={e =>
                                    setDefaultDuration(
                                        parseInt(e.target.value, 10),
                                    )
                                }
                            >
                                {durationOptions.map(i => (
                                    <option key={i} value={i}>
                                        {i}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label
                            style={{ display: 'flex', flexDirection: 'column' }}
                        >
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                                Tipo padrão
                            </span>
                            <select
                                value={defaultVisitType}
                                onChange={e =>
                                    setDefaultVisitType(e.target.value)
                                }
                            >
                                {visitTypes.map(v => (
                                    <option key={v.value} value={v.value}>
                                        {v.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <label
                        style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                        }}
                    >
                        <input
                            type='checkbox'
                            checked={autoSuggest}
                            onChange={e => setAutoSuggest(e.target.checked)}
                        />
                        <span style={{ fontSize: 13 }}>
                            Sugerir próximo slot livre ao abrir agendamento
                        </span>
                    </label>
                </div>
                {savedMsg && (
                    <div
                        style={{
                            fontSize: 13,
                            color: savedMsg.startsWith('Configura')
                                ? '#065f46'
                                : '#991b1b',
                        }}
                    >
                        {savedMsg}
                    </div>
                )}
                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        justifyContent: 'flex-end',
                    }}
                >
                    <button className={styles.loginButton} onClick={save}>
                        Salvar
                    </button>
                    <button className={styles.loginButton} onClick={onClose}>
                        Fechar
                    </button>
                </div>
            </div>
        </AppModal>
    );
};

export default AgendaSettingsModal;
