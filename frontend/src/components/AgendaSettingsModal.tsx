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
    startTelegramLink,
    verifyTelegramLink,
    sendTelegramTest,
} from '../utils/agendaSettings';
import { emit } from '../events/bus';

interface AgendaSettingsModalProps {
    open: boolean;
    onClose: () => void;
    onApply?: () => void; // callback após salvar
}

const intervalOptions = [5, 10, 15, 20, 30];
const durationOptions = [30, 60, 90, 120, 150];
const reminderMinuteOptions = [5, 10, 15, 30, 45, 60, 90, 120, 180, 240];
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
    const [compactViewport, setCompactViewport] = React.useState(false);
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
    const [reminderEnabled, setReminderEnabled] = React.useState(
        DEFAULTS.reminderEnabled,
    );
    const [remindersGloballyEnabled, setRemindersGloballyEnabled] =
        React.useState(DEFAULTS.remindersGloballyEnabled);
    const [telegramLinked, setTelegramLinked] = React.useState(
        DEFAULTS.telegramLinked,
    );
    const [telegramLinkActive, setTelegramLinkActive] = React.useState(
        DEFAULTS.telegramLinkActive,
    );
    const [telegramUsername, setTelegramUsername] = React.useState(
        DEFAULTS.telegramUsername,
    );
    const [telegramLastError, setTelegramLastError] = React.useState(
        DEFAULTS.telegramLastError,
    );
    const [telegramStartUrl, setTelegramStartUrl] = React.useState('');
    const [telegramStartToken, setTelegramStartToken] = React.useState('');
    const [telegramLinkBusy, setTelegramLinkBusy] = React.useState(false);
    const [telegramTestBusy, setTelegramTestBusy] = React.useState(false);
    const [reminderMinutesBefore, setReminderMinutesBefore] = React.useState(
        DEFAULTS.reminderMinutesBefore,
    );
    const [savedMsg, setSavedMsg] = React.useState<string | null>(null);
    const [msgType, setMsgType] = React.useState<'success' | 'error' | null>(
        null,
    );
    const firstFieldRef = React.useRef<HTMLInputElement | null>(null);
    const openRef = React.useRef(false);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;

        const updateCompactViewport = () => {
            const vvHeight = window.visualViewport?.height ?? window.innerHeight;
            const isNarrow = window.innerWidth <= 640;
            const isShort = vvHeight <= 560;
            setCompactViewport(isNarrow || isShort);
        };

        updateCompactViewport();
        window.addEventListener('resize', updateCompactViewport);
        window.addEventListener('orientationchange', updateCompactViewport);
        window.visualViewport?.addEventListener('resize', updateCompactViewport);

        return () => {
            window.removeEventListener('resize', updateCompactViewport);
            window.removeEventListener(
                'orientationchange',
                updateCompactViewport,
            );
            window.visualViewport?.removeEventListener(
                'resize',
                updateCompactViewport,
            );
        };
    }, []);

    React.useEffect(() => {
        if (!open) return;
        let active = true;
        setSavedMsg(null);
        setMsgType(null);
        setTelegramStartUrl('');
        setTelegramStartToken('');

        const current = getAgendaSettingsSnapshot();
        setWorkStart(clampHM(current.workStart, DEFAULTS.workStart));
        setWorkEnd(clampHM(current.workEnd, DEFAULTS.workEnd));
        setSlotInterval(current.slotInterval);
        setDefaultDuration(current.defaultDuration);
        setDefaultVisitType(current.defaultVisitType);
        setReminderEnabled(current.reminderEnabled);
        setRemindersGloballyEnabled(current.remindersGloballyEnabled);
        setTelegramLinked(current.telegramLinked);
        setTelegramLinkActive(current.telegramLinkActive);
        setTelegramUsername(current.telegramUsername);
        setTelegramLastError(current.telegramLastError);
        setReminderMinutesBefore(current.reminderMinutesBefore);

        void hydrateAgendaSettings()
            .then(settings => {
                if (!active) return;
                setWorkStart(clampHM(settings.workStart, DEFAULTS.workStart));
                setWorkEnd(clampHM(settings.workEnd, DEFAULTS.workEnd));
                setSlotInterval(settings.slotInterval);
                setDefaultDuration(settings.defaultDuration);
                setDefaultVisitType(settings.defaultVisitType);
                setReminderEnabled(settings.reminderEnabled);
                setRemindersGloballyEnabled(settings.remindersGloballyEnabled);
                setTelegramLinked(settings.telegramLinked);
                setTelegramLinkActive(settings.telegramLinkActive);
                setTelegramUsername(settings.telegramUsername);
                setTelegramLastError(settings.telegramLastError);
                setReminderMinutesBefore(settings.reminderMinutesBefore);
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
                reminderEnabled,
                reminderMinutesBefore,
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

        setSavedMsg(null);
        setMsgType(null);
        emit('systemMessage', {
            text: 'Configurações salvas.',
            type: 'success',
        });
        if (onApply) onApply();
    }

    function isAtDefaults() {
        return (
            workStart === DEFAULTS.workStart &&
            workEnd === DEFAULTS.workEnd &&
            slotInterval === DEFAULTS.slotInterval &&
            defaultDuration === DEFAULTS.defaultDuration &&
            defaultVisitType === DEFAULTS.defaultVisitType &&
            reminderEnabled === DEFAULTS.reminderEnabled &&
            reminderMinutesBefore === DEFAULTS.reminderMinutesBefore
        );
    }

    function resetDefaults() {
        setWorkStart(DEFAULTS.workStart);
        setWorkEnd(DEFAULTS.workEnd);
        setSlotInterval(DEFAULTS.slotInterval);
        setDefaultDuration(DEFAULTS.defaultDuration);
        setDefaultVisitType(DEFAULTS.defaultVisitType);
        setReminderEnabled(DEFAULTS.reminderEnabled);
        setRemindersGloballyEnabled(DEFAULTS.remindersGloballyEnabled);
        setTelegramLinked(DEFAULTS.telegramLinked);
        setTelegramLinkActive(DEFAULTS.telegramLinkActive);
        setTelegramUsername(DEFAULTS.telegramUsername);
        setTelegramLastError(DEFAULTS.telegramLastError);
        setReminderMinutesBefore(DEFAULTS.reminderMinutesBefore);
        setSavedMsg('Padrões restaurados (não salvos ainda).');
        setMsgType('success');
    }

    const remindersEffectiveActive =
        reminderEnabled && remindersGloballyEnabled;

    async function handleStartTelegramLink() {
        setTelegramLinkBusy(true);
        try {
            const result = await startTelegramLink();
            if (!result.linkUrl || !result.startToken) {
                throw new Error('Não foi possível gerar o link de vínculo.');
            }
            setTelegramStartUrl(result.linkUrl);
            setTelegramStartToken(result.startToken);
            emit('systemMessage', {
                text: 'Link gerado. Abra no Telegram e toque em Iniciar.',
                type: 'info',
            });
            try {
                const opened = window.open(
                    result.linkUrl,
                    '_blank',
                    'noopener,noreferrer',
                );
                if (!opened) {
                    window.location.href = result.linkUrl;
                }
            } catch {
                window.location.href = result.linkUrl;
            }
        } catch (error) {
            emit('systemMessage', {
                text:
                    error instanceof Error
                        ? error.message
                        : 'Erro ao iniciar vínculo com Telegram.',
                type: 'error',
            });
        } finally {
            setTelegramLinkBusy(false);
        }
    }

    function openTelegramLink(url: string) {
        if (!url) return;
        try {
            const opened = window.open(url, '_blank', 'noopener,noreferrer');
            if (!opened) {
                window.location.href = url;
            }
        } catch {
            window.location.href = url;
        }
    }

    async function copyTelegramLink(url: string) {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            emit('systemMessage', {
                text: 'Link copiado. Cole no Safari/Telegram para abrir.',
                type: 'success',
            });
        } catch {
            emit('systemMessage', {
                text: 'Não foi possível copiar automaticamente. Copie manualmente abaixo.',
                type: 'warning',
            });
        }
    }

    async function handleSendTelegramTest() {
        setTelegramTestBusy(true);
        try {
            await sendTelegramTest();
            emit('systemMessage', {
                text: 'Mensagem de teste enviada com sucesso!',
                type: 'success',
            });
        } catch (error) {
            emit('systemMessage', {
                text:
                    error instanceof Error
                        ? error.message
                        : 'Erro ao enviar teste.',
                type: 'error',
            });
        } finally {
            setTelegramTestBusy(false);
        }
    }

    async function handleVerifyTelegramLink() {
        if (!telegramStartToken) {
            emit('systemMessage', {
                text: 'Primeiro gere o link de conexão do Telegram.',
                type: 'warning',
            });
            return;
        }
        setTelegramLinkBusy(true);
        try {
            const snapshot = await verifyTelegramLink(telegramStartToken);
            setReminderEnabled(snapshot.reminderEnabled);
            setRemindersGloballyEnabled(snapshot.remindersGloballyEnabled);
            setTelegramLinked(snapshot.telegramLinked);
            setTelegramLinkActive(snapshot.telegramLinkActive);
            setTelegramUsername(snapshot.telegramUsername);
            setTelegramLastError(snapshot.telegramLastError);
            emit('systemMessage', {
                text: 'Telegram conectado com sucesso.',
                type: 'success',
            });
        } catch (error) {
            emit('systemMessage', {
                text:
                    error instanceof Error
                        ? error.message
                        : 'Ainda não foi possível confirmar o vínculo.',
                type: 'warning',
            });
        } finally {
            setTelegramLinkBusy(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            save();
        }
    }

    return (
        <AppModal
            open={open}
            onClose={onClose}
            closeOnEnter={false}
            fullScreen={compactViewport}
            maxHeightVh={96}
            unmountOnClose
        >
            <form
                className={modalStyles.container}
                onKeyDown={handleKeyDown}
                onSubmit={e => {
                    e.preventDefault();
                    void save();
                }}
            >
                <h2 className={modalStyles.header}>Notificações e Agenda</h2>
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

                    <div className={modalStyles.fieldGroup}>
                        <label
                            htmlFor='agenda-reminderEnabled'
                            className={modalStyles.label}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                            }}
                        >
                            <input
                                id='agenda-reminderEnabled'
                                type='checkbox'
                                checked={reminderEnabled}
                                onChange={e =>
                                    setReminderEnabled(e.target.checked)
                                }
                            />
                            Notificações ativas
                        </label>
                    </div>

                    <div className={modalStyles.fieldGroup}>
                        <label
                            htmlFor='agenda-reminderEffective'
                            className={modalStyles.label}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                            }}
                        >
                            <input
                                id='agenda-reminderEffective'
                                type='checkbox'
                                checked={remindersEffectiveActive}
                                disabled
                                readOnly
                            />
                            Envio efetivo:{' '}
                            {remindersEffectiveActive ? 'Ativo' : 'Inativo'}
                        </label>
                    </div>

                    <div className={modalStyles.fieldGroup}>
                        <label className={modalStyles.label}>
                            Vínculo Telegram:{' '}
                            {telegramLinked && telegramLinkActive
                                ? 'Conectado'
                                : 'Não conectado'}
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                                type='button'
                                className='ui-btn ui-btn--secondary'
                                onClick={() => {
                                    void handleStartTelegramLink();
                                }}
                                disabled={telegramLinkBusy}
                            >
                                Conectar Telegram
                            </button>
                            <button
                                type='button'
                                className='ui-btn ui-btn--neutral'
                                onClick={() => {
                                    void handleVerifyTelegramLink();
                                }}
                                disabled={telegramLinkBusy || !telegramStartToken}
                            >
                                Verificar conexão
                            </button>
                            <button
                                type='button'
                                className='ui-btn ui-btn--theme'
                                onClick={() => {
                                    void handleSendTelegramTest();
                                }}
                                disabled={telegramTestBusy || !(telegramLinked && telegramLinkActive)}
                                title={!(telegramLinked && telegramLinkActive) ? 'Conecte o Telegram primeiro' : ''}
                            >
                                {telegramTestBusy ? 'Enviando…' : 'Enviar teste'}
                            </button>
                        </div>
                        {!!telegramStartUrl && (
                            <div
                                style={{
                                    marginTop: '0.75rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 10,
                                    padding: '0.75rem',
                                    background: '#f8fafc',
                                }}
                            >
                                <p
                                    style={{
                                        margin: '0 0 0.5rem',
                                        fontSize: '0.95rem',
                                        color: '#1f2937',
                                        fontWeight: 600,
                                    }}
                                >
                                    Se não abriu automaticamente:
                                </p>
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '0.5rem',
                                        flexWrap: 'wrap',
                                        marginBottom: '0.5rem',
                                    }}
                                >
                                    <button
                                        type='button'
                                        className='ui-btn ui-btn--secondary'
                                        onClick={() => openTelegramLink(telegramStartUrl)}
                                    >
                                        Abrir Telegram
                                    </button>
                                    <button
                                        type='button'
                                        className='ui-btn ui-btn--neutral'
                                        onClick={() => {
                                            void copyTelegramLink(telegramStartUrl);
                                        }}
                                    >
                                        Copiar link
                                    </button>
                                </div>
                                <a
                                    href={telegramStartUrl}
                                    target='_blank'
                                    rel='noreferrer'
                                    style={{
                                        display: 'block',
                                        fontSize: '0.95rem',
                                        lineHeight: 1.45,
                                        wordBreak: 'break-all',
                                        color: '#1d4ed8',
                                        textDecoration: 'underline',
                                    }}
                                >
                                    {telegramStartUrl}
                                </a>
                            </div>
                        )}
                        {telegramUsername && (
                            <small className={modalStyles.smallNote}>
                                Usuário: @{telegramUsername}
                            </small>
                        )}
                        {!!telegramLastError && (
                            <small
                                className={modalStyles.smallNote}
                                style={{ color: '#b91c1c' }}
                            >
                                Último erro do Telegram: {telegramLastError}
                            </small>
                        )}
                    </div>

                    <div className={modalStyles.fieldGroup}>
                        <label
                            htmlFor='agenda-reminderMinutesBefore'
                            className={modalStyles.label}
                        >
                            Avisar com antecedência (min)
                        </label>
                        <select
                            id='agenda-reminderMinutesBefore'
                            className={modalStyles.select}
                            value={reminderMinutesBefore}
                            disabled={!reminderEnabled}
                            onChange={e =>
                                setReminderMinutesBefore(
                                    parseInt(e.target.value, 10),
                                )
                            }
                        >
                            {reminderMinuteOptions.map(i => (
                                <option key={i} value={i}>
                                    {i}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div
                        style={{
                            marginTop: '0.75rem',
                            fontSize: '0.85rem',
                            color: remindersGloballyEnabled
                                ? '#6b7280'
                                : '#b45309',
                            lineHeight: 1.5,
                        }}
                    >
                        Ative para enviar lembretes para a profissional no
                        Telegram. Se o ambiente estiver com a flag global
                        APPOINTMENT_REMINDERS_ENABLED=false, o envio permanece
                        bloqueado mesmo com este toggle ativo.
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
                        className='ui-btn ui-btn--neutral'
                        onClick={resetDefaults}
                        disabled={isAtDefaults()}
                    >
                        Restaurar padrões
                    </button>
                    <button
                        type='submit'
                        className='ui-btn ui-btn--theme'
                    >
                        Salvar
                    </button>
                    <button
                        type='button'
                        className='ui-btn ui-btn--neutral'
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
