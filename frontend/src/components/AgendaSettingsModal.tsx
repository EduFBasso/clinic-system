import React from 'react';
import AppModal from './Modal';
import modalStyles from '../styles/components/AgendaSettingsModal.module.css';
import { usePushSubscription } from '../hooks/usePushSubscription';
import { API_BASE } from '../config/api';

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

const DEFAULTS = {
    workStart: '06:00',
    workEnd: '21:00',
    slotInterval: 10,
    defaultDuration: 60,
    defaultVisitType: 'consulta',
};

const AgendaSettingsModal: React.FC<AgendaSettingsModalProps> = ({
    open,
    onClose,
    onApply,
}) => {
    const [workStart, setWorkStart] = React.useState(DEFAULTS.workStart);
    const [workEnd, setWorkEnd] = React.useState(DEFAULTS.workEnd);
    const [slotInterval, setSlotInterval] = React.useState(
        DEFAULTS.slotInterval,
    );
    const [defaultDuration, setDefaultDuration] = React.useState(
        DEFAULTS.defaultDuration,
    );
    const [defaultVisitType, setDefaultVisitType] = React.useState(
        DEFAULTS.defaultVisitType,
    );
    const [savedMsg, setSavedMsg] = React.useState<string | null>(null);
    const [msgType, setMsgType] = React.useState<'success' | 'error' | null>(
        null,
    );
    const firstFieldRef = React.useRef<HTMLInputElement | null>(null);
    const openRef = React.useRef(false);

    // Notification settings (backend-stored)
    const [reminderEnabled, setReminderEnabled] = React.useState(false);
    const [reminderMinutesBefore, setReminderMinutesBefore] =
        React.useState(90);
    const { state: pushState, subscribe, unsubscribe } = usePushSubscription();
    const [pushJustActivated, setPushJustActivated] = React.useState(false);

    React.useEffect(() => {
        if (!open) return;
        setSavedMsg(null);
        setMsgType(null);
        // Check if subscription was just completed (survives iOS modal close)
        if (sessionStorage.getItem('pushJustActivated')) {
            sessionStorage.removeItem('pushJustActivated');
            setPushJustActivated(true);
            setTimeout(() => setPushJustActivated(false), 5000);
        }
        setWorkStart(
            clampHM(
                localStorage.getItem(LS_KEYS.workStart) || DEFAULTS.workStart,
                DEFAULTS.workStart,
            ),
        );
        setWorkEnd(
            clampHM(
                localStorage.getItem(LS_KEYS.workEnd) || DEFAULTS.workEnd,
                DEFAULTS.workEnd,
            ),
        );
        const si = parseInt(
            localStorage.getItem(LS_KEYS.slotInterval) ||
                String(DEFAULTS.slotInterval),
            10,
        );
        setSlotInterval(
            intervalOptions.includes(si) ? si : DEFAULTS.slotInterval,
        );
        const dd = parseInt(
            localStorage.getItem(LS_KEYS.defaultDuration) ||
                String(DEFAULTS.defaultDuration),
            10,
        );
        setDefaultDuration(
            durationOptions.includes(dd) ? dd : DEFAULTS.defaultDuration,
        );
        const vt =
            localStorage.getItem(LS_KEYS.defaultVisitType) ||
            DEFAULTS.defaultVisitType;
        setDefaultVisitType(
            visitTypes.some(v => v.value === vt)
                ? vt
                : DEFAULTS.defaultVisitType,
        );

        // Load notification settings from backend
        (async () => {
            const token = localStorage.getItem('accessToken');
            if (!token) return;
            try {
                const res = await fetch(
                    `${API_BASE}/register/professionals/settings/`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    },
                );
                if (!res.ok) return;
                const data = (await res.json()) as {
                    reminder_enabled?: boolean;
                    reminder_minutes_before?: number;
                };
                setReminderEnabled(data.reminder_enabled ?? false);
                setReminderMinutesBefore(data.reminder_minutes_before ?? 90);
            } catch {
                /* silencioso */
            }
        })();

        // Manage initial focus only first time after open flag toggles true
        requestAnimationFrame(() => {
            if (firstFieldRef.current) {
                firstFieldRef.current.focus();
            }
        });
        openRef.current = true;
    }, [open]);

    function save() {
        if (workEnd <= workStart) {
            setSavedMsg('Fim deve ser maior que início.');
            setMsgType('error');
            return;
        }
        localStorage.setItem(LS_KEYS.workStart, workStart);
        localStorage.setItem(LS_KEYS.workEnd, workEnd);
        localStorage.setItem(LS_KEYS.slotInterval, String(slotInterval));
        localStorage.setItem(LS_KEYS.defaultDuration, String(defaultDuration));
        localStorage.setItem(LS_KEYS.defaultVisitType, defaultVisitType);

        // Persist notification settings to the backend (fire-and-forget with feedback)
        const token = localStorage.getItem('accessToken');
        if (token) {
            fetch(`${API_BASE}/register/professionals/settings/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    reminder_enabled: reminderEnabled,
                    reminder_minutes_before: reminderMinutesBefore,
                }),
            }).catch(() => {
                /* silencioso */
            });
        }

        setSavedMsg('Configurações salvas.');
        setMsgType('success');
        if (onApply) onApply();
    }

    function isAtDefaults() {
        return (
            workStart === DEFAULTS.workStart &&
            workEnd === DEFAULTS.workEnd &&
            slotInterval === DEFAULTS.slotInterval &&
            defaultDuration === DEFAULTS.defaultDuration &&
            defaultVisitType === DEFAULTS.defaultVisitType
        );
    }

    function resetDefaults() {
        setWorkStart(DEFAULTS.workStart);
        setWorkEnd(DEFAULTS.workEnd);
        setSlotInterval(DEFAULTS.slotInterval);
        setDefaultDuration(DEFAULTS.defaultDuration);
        setDefaultVisitType(DEFAULTS.defaultVisitType);
        setSavedMsg('Padrões restaurados (não salvos ainda).');
        setMsgType('success');
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            save();
        }
    }

    return (
        <AppModal open={open} onClose={onClose} closeOnEnter={false}>
            <form
                className={modalStyles.container}
                onKeyDown={handleKeyDown}
                onSubmit={e => {
                    e.preventDefault();
                    save();
                }}
            >
                <h2 className={modalStyles.header}>Configurações da Agenda</h2>
                <div className={modalStyles.formGrid}>
                    <div className={modalStyles.timeRow}>
                        <div className={modalStyles.fieldGroup}>
                            <label
                                htmlFor='agenda-workStart'
                                className={modalStyles.label}
                            >
                                Início expediente
                            </label>
                            <div className={modalStyles.timeInputWrapper}>
                                <input
                                    id='agenda-workStart'
                                    ref={firstFieldRef}
                                    type='time'
                                    className={modalStyles.input}
                                    value={workStart}
                                    onChange={e =>
                                        setWorkStart(
                                            clampHM(
                                                e.target.value,
                                                DEFAULTS.workStart,
                                            ),
                                        )
                                    }
                                />
                                <span aria-hidden className={modalStyles.caret}>
                                    ▾
                                </span>
                            </div>
                        </div>
                        <div aria-hidden className={modalStyles.divider} />
                        <div className={modalStyles.fieldGroup}>
                            <label
                                htmlFor='agenda-workEnd'
                                className={modalStyles.label}
                            >
                                Fim expediente
                            </label>
                            <div className={modalStyles.timeInputWrapper}>
                                <input
                                    id='agenda-workEnd'
                                    type='time'
                                    className={modalStyles.input}
                                    value={workEnd}
                                    onChange={e =>
                                        setWorkEnd(
                                            clampHM(
                                                e.target.value,
                                                DEFAULTS.workEnd,
                                            ),
                                        )
                                    }
                                />
                                <span aria-hidden className={modalStyles.caret}>
                                    ▾
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className={modalStyles.inlineRow}>
                        <div className={modalStyles.fieldGroup}>
                            <label
                                htmlFor='agenda-slotInterval'
                                className={modalStyles.label}
                            >
                                Intervalo (min)
                            </label>
                            <select
                                id='agenda-slotInterval'
                                className={modalStyles.select}
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
                        </div>
                        <div className={modalStyles.fieldGroup}>
                            <label
                                htmlFor='agenda-defaultDuration'
                                className={modalStyles.label}
                            >
                                Duração padrão (min)
                            </label>
                            <select
                                id='agenda-defaultDuration'
                                className={modalStyles.select}
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
                        </div>
                    </div>

                    <div className={modalStyles.fullRow}>
                        <label
                            htmlFor='agenda-defaultVisitType'
                            className={modalStyles.label}
                        >
                            Tipo padrão
                        </label>
                        <select
                            id='agenda-defaultVisitType'
                            className={modalStyles.select}
                            value={defaultVisitType}
                            onChange={e => setDefaultVisitType(e.target.value)}
                        >
                            {visitTypes.map(v => (
                                <option key={v.value} value={v.value}>
                                    {v.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ── Notificações Push ─────────────────────────────── */}
                <div
                    style={{
                        borderTop: '1px solid #e5e7eb',
                        paddingTop: '1rem',
                    }}
                >
                    <p
                        style={{
                            margin: '0 0 0.75rem',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            color: '#374151',
                        }}
                    >
                        Notificações Push
                    </p>

                    {/* Reminder toggle */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            marginBottom: '0.75rem',
                        }}
                    >
                        <input
                            id='agenda-reminderEnabled'
                            type='checkbox'
                            checked={reminderEnabled}
                            onChange={e => setReminderEnabled(e.target.checked)}
                            style={{
                                width: '1rem',
                                height: '1rem',
                                cursor: 'pointer',
                            }}
                        />
                        <label
                            htmlFor='agenda-reminderEnabled'
                            className={modalStyles.label}
                            style={{ cursor: 'pointer' }}
                        >
                            Ativar lembrete antes do compromisso
                        </label>
                    </div>

                    {/* Minutes before */}
                    <div
                        className={modalStyles.fieldGroup}
                        style={{ maxWidth: 220, marginBottom: '0.75rem' }}
                    >
                        <label
                            htmlFor='agenda-reminderMinutes'
                            className={modalStyles.label}
                        >
                            Minutos de antecedência
                        </label>
                        <input
                            id='agenda-reminderMinutes'
                            type='number'
                            min={1}
                            max={1440}
                            className={modalStyles.input}
                            value={reminderMinutesBefore}
                            disabled={!reminderEnabled}
                            onChange={e => {
                                const v = parseInt(e.target.value, 10);
                                if (!isNaN(v) && v >= 1 && v <= 1440)
                                    setReminderMinutesBefore(v);
                            }}
                        />
                    </div>

                    {/* Push subscription status */}
                    {pushJustActivated && (
                        <div
                            style={{
                                background: 'var(--color-success-bg)',
                                color: 'var(--color-success)',
                                border: '1px solid #6ee7b7',
                                borderRadius: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                marginBottom: '0.5rem',
                            }}
                        >
                            ✔ Notificações ativadas neste dispositivo!
                        </div>
                    )}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            flexWrap: 'wrap',
                        }}
                    >
                        <span
                            style={{
                                fontSize: '0.85rem',
                                color:
                                    pushState === 'subscribed'
                                        ? '#065f46'
                                        : '#6b7280',
                                fontWeight:
                                    pushState === 'subscribed' ? 600 : 400,
                            }}
                        >
                            {pushState === 'unsupported' &&
                                'Este navegador não suporta notificações push.'}
                            {pushState === 'denied' &&
                                'Notificações bloqueadas pelo navegador.'}
                            {pushState === 'subscribed' &&
                                '✔ Este dispositivo receberá lembretes.'}
                            {pushState === 'unsubscribed' &&
                                'Este dispositivo não está inscrito.'}
                            {pushState === 'loading' && 'Verificando…'}
                        </span>
                        {(pushState === 'subscribed' ||
                            pushState === 'unsubscribed') && (
                            <button
                                type='button'
                                className={`${modalStyles.buttonBase} ${modalStyles.secondary}`}
                                style={{
                                    padding: '0.35rem 0.8rem',
                                    fontSize: '0.85rem',
                                }}
                                onClick={async () => {
                                    if (pushState === 'subscribed') {
                                        await unsubscribe();
                                        setPushJustActivated(false);
                                    } else {
                                        const ok = await subscribe();
                                        if (ok) {
                                            sessionStorage.setItem(
                                                'pushJustActivated',
                                                '1',
                                            );
                                            setPushJustActivated(true);
                                            setTimeout(
                                                () =>
                                                    setPushJustActivated(false),
                                                5000,
                                            );
                                        }
                                    }
                                }}
                            >
                                {pushState === 'subscribed'
                                    ? 'Remover inscrição'
                                    : 'Ativar neste dispositivo'}
                            </button>
                        )}
                    </div>
                </div>

                <div
                    className={modalStyles.messageArea}
                    role='status'
                    aria-live='polite'
                >
                    <div
                        className={[
                            modalStyles.statusMessage,
                            savedMsg ? ' ' + modalStyles.visible : '',
                            msgType === 'success'
                                ? ' ' + modalStyles.statusSuccess
                                : '',
                            msgType === 'error'
                                ? ' ' + modalStyles.statusError
                                : '',
                        ].join('')}
                    >
                        {savedMsg || ''}
                    </div>
                </div>

                <div className={modalStyles.buttonBar}>
                    <button
                        type='button'
                        className={`${modalStyles.buttonBase} ${modalStyles.secondary}`}
                        onClick={resetDefaults}
                        disabled={isAtDefaults()}
                    >
                        Restaurar padrões
                    </button>
                    <button
                        type='submit'
                        className={`${modalStyles.buttonBase} ${modalStyles.primary}`}
                    >
                        Salvar
                    </button>
                    <button
                        type='button'
                        className={`${modalStyles.buttonBase} ${modalStyles.secondary}`}
                        onClick={onClose}
                    >
                        Fechar
                    </button>
                </div>
            </form>
        </AppModal>
    );
};

export default AgendaSettingsModal;
