import React from 'react';
import AppModal from './Modal';
import modalStyles from '../styles/components/AgendaSettingsModal.module.css';
import {
    DEFAULT_AGENDA_SETTINGS,
    type DefaultDuration,
    type DefaultVisitType,
    getAgendaSettingsSnapshot,
    hydrateAgendaSettings,
    saveAgendaSettings,
} from '../utils/agendaSettings';

interface AgendaSettingsModalProps {
    open: boolean;
    onClose: () => void;
    onApply?: () => void; // callback após salvar
}

const intervalOptions = [5, 10, 15, 20, 30];
const durationOptions = [30, 60, 90, 120, 150];
const visitTypes = [
    { value: 'consulta', label: 'Consulta' },
    { value: 'avaliacao', label: 'Avaliação' },
    { value: 'retorno', label: 'Retorno' },
    { value: 'procedimento', label: 'Serviço' },
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

const DEFAULTS = DEFAULT_AGENDA_SETTINGS;

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

    React.useEffect(() => {
        if (!open) return;
        let active = true;
        setSavedMsg(null);
        setMsgType(null);

        const current = getAgendaSettingsSnapshot();
        setWorkStart(clampHM(current.workStart, DEFAULTS.workStart));
        setWorkEnd(clampHM(current.workEnd, DEFAULTS.workEnd));
        setSlotInterval(current.slotInterval);
        setDefaultDuration(current.defaultDuration);
        setDefaultVisitType(current.defaultVisitType);

        void hydrateAgendaSettings()
            .then(settings => {
                if (!active) return;
                setWorkStart(clampHM(settings.workStart, DEFAULTS.workStart));
                setWorkEnd(clampHM(settings.workEnd, DEFAULTS.workEnd));
                setSlotInterval(settings.slotInterval);
                setDefaultDuration(settings.defaultDuration);
                setDefaultVisitType(settings.defaultVisitType);
            })
            .catch(() => {
                /* silencioso */
            });

        // Manage initial focus only first time after open flag toggles true
        requestAnimationFrame(() => {
            if (firstFieldRef.current) {
                firstFieldRef.current.focus();
            }
        });
        openRef.current = true;
        return () => {
            active = false;
        };
    }, [open]);

    async function save() {
        if (workEnd <= workStart) {
            setSavedMsg('Fim deve ser maior que início.');
            setMsgType('error');
            return;
        }
        try {
            await saveAgendaSettings({
                workStart,
                workEnd,
                slotInterval,
                defaultDuration,
                defaultVisitType,
                reminderEnabled: false,
                reminderMinutesBefore: DEFAULTS.reminderMinutesBefore,
            });
        } catch (error) {
            setSavedMsg(
                error instanceof Error
                    ? error.message
                    : 'Erro ao salvar configurações.',
            );
            setMsgType('error');
            return;
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
                    void save();
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
                                        parseInt(
                                            e.target.value,
                                            10,
                                        ) as DefaultDuration,
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
                            onChange={e =>
                                setDefaultVisitType(
                                    e.target.value as DefaultVisitType,
                                )
                            }
                        >
                            {visitTypes.map(v => (
                                <option key={v.value} value={v.value}>
                                    {v.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ── Lembretes Telegram ─────────────────────────────── */}
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
                        Lembretes Telegram
                    </p>

                    <div
                        style={{
                            fontSize: '0.85rem',
                            color: '#6b7280',
                            lineHeight: 1.5,
                        }}
                    >
                        Os lembretes automáticos estão temporariamente
                        desativados neste release. A agenda continua operando
                        normalmente, mas o sistema não enviará notificações até
                        o próximo update.
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
