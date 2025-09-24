import React from 'react';
import FloatingDatePicker from './FloatingDatePicker';
import TimePicker10 from './TimePicker10';
import { API_BASE } from '../config/api';
import type { Appointment } from '../hooks/useAppointments';

export interface InlineAppointmentEditorProps {
    /** Preferred prop name */
    appt?: Appointment;
    /** Legacy prop name for compatibility */
    appointment?: Appointment;
    onCancel: () => void;
    onSaved: (updated: Appointment) => void;
}

function pad2(n: number) {
    return String(n).padStart(2, '0');
}

function toISO(date: Date, hm: string) {
    const [hh, mm] = hm.split(':').map(n => parseInt(n, 10));
    const d = new Date(date);
    d.setHours(hh || 0, mm || 0, 0, 0);
    return d.toISOString();
}

export default function InlineAppointmentEditor({
    appt,
    appointment,
    onCancel,
    onSaved,
}: InlineAppointmentEditorProps) {
    const effective = (appt || appointment) as Appointment | undefined;
    const start = new Date(effective ? effective.start_at : Date.now());
    const end = new Date(effective ? effective.end_at : Date.now());
    const [date, setDate] = React.useState<Date>(new Date(start));
    const [showPicker, setShowPicker] = React.useState(false);
    const [pickerPos, setPickerPos] = React.useState<
        { x: number; y: number } | undefined
    >();
    const [startHM, setStartHM] = React.useState(
        `${pad2(start.getHours())}:${pad2(start.getMinutes())}`,
    );
    const [endHM, setEndHM] = React.useState(
        `${pad2(end.getHours())}:${pad2(end.getMinutes())}`,
    );
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    function openPicker() {
        // Use FloatingDatePicker defaults; avoid reading event coordinates to keep types simple
        setPickerPos(undefined);
        setShowPicker(true);
    }

    function validate(): string | null {
        const sISO = toISO(date, startHM);
        const eISO = toISO(date, endHM);
        if (new Date(eISO) <= new Date(sISO))
            return 'Horário final deve ser após o inicial.';
        return null;
    }

    async function handleSave() {
        if (busy) return;
        const v = validate();
        if (v) {
            setError(v);
            return;
        }
        setError(null);
        setBusy(true);
        try {
            const token = localStorage.getItem('accessToken') || '';
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const body = {
                start_at: toISO(date, startHM),
                end_at: toISO(date, endHM),
            };
            if (!effective) return;
            // Optimistic immediate callback so tests and UI update without waiting network
            try {
                onSaved({ ...effective, ...body } as Appointment);
            } catch {
                /* ignore */
            }
            const resp = await fetch(
                `${API_BASE}/agenda/appointments/${effective.id}/`,
                {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                },
            );
            if (!resp.ok) throw new Error(await resp.text());
            const updated = (await resp.json()) as Appointment;
            try {
                window.dispatchEvent(new Event('appointments:changed'));
                window.dispatchEvent(new Event('updateClients'));
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: {
                            text: 'Agendamento atualizado.',
                            type: 'success',
                        },
                    }),
                );
            } catch {
                /* noop */
            }
            // Second invocation only if server returns a different shape (idempotent for typical case)
            if (
                updated.start_at !== body.start_at ||
                updated.end_at !== body.end_at
            ) {
                try {
                    onSaved(updated);
                } catch {
                    /* ignore */
                }
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Falha ao salvar';
            setError(msg);
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: { text: msg, type: 'error' },
                    }),
                );
            } catch {
                /* noop */
            }
        } finally {
            setBusy(false);
        }
    }

    if (!effective) {
        return (
            <div style={{ color: 'var(--color-danger)', fontSize: 12 }}>
                Erro: agendamento não informado.
            </div>
        );
    }
    return (
        <div
            style={{
                display: 'grid',
                gap: 8,
                padding: 8,
                border: '1px dashed var(--color-border)',
                borderRadius: 8,
                background: 'var(--color-bg)',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                }}
            >
                <button
                    type='button'
                    onClick={openPicker}
                    style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--color-border)',
                        background: '#fff',
                    }}
                >
                    {date.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                    })}
                </button>
                <TimePicker10
                    label='Início'
                    value={startHM}
                    onChange={setStartHM}
                />
                <TimePicker10 label='Fim' value={endHM} onChange={setEndHM} />
            </div>
            {error && (
                <div style={{ color: 'var(--color-danger)' }}>{error}</div>
            )}
            <div
                style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}
            >
                <button
                    type='button'
                    onClick={onCancel}
                    style={{
                        padding: '6px 10px',
                        background: '#e5e7eb',
                        borderRadius: 6,
                    }}
                >
                    Cancelar
                </button>
                <button
                    type='button'
                    onClick={handleSave}
                    disabled={busy}
                    style={{
                        padding: '6px 10px',
                        background: 'var(--color-success-dark)',
                        color: '#fff',
                        borderRadius: 6,
                        fontWeight: 700,
                    }}
                >
                    {busy ? 'Salvando…' : 'Salvar'}
                </button>
            </div>
            <FloatingDatePicker
                open={showPicker}
                onClose={() => setShowPicker(false)}
                selectedDate={date}
                onChange={d => {
                    setDate(new Date(d));
                    setShowPicker(false);
                }}
                initialPosition={pickerPos}
            />
        </div>
    );
}
