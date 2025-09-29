import React from 'react';
import AppModal from './Modal';
import { useFinalizeAudits } from '../hooks/useFinalizeAudits';

interface FinalizeAuditsModalProps {
    open: boolean;
    onClose: () => void;
}

export default function FinalizeAuditsModal({
    open,
    onClose,
}: FinalizeAuditsModalProps) {
    const [deviceId, setDeviceId] = React.useState('');
    const [appointmentId, setAppointmentId] = React.useState<string>('');
    const [start, setStart] = React.useState<string>('');
    const [end, setEnd] = React.useState<string>('');

    const startDate = React.useMemo(
        () => (start ? new Date(start) : undefined),
        [start],
    );
    const endDate = React.useMemo(
        () => (end ? new Date(end) : undefined),
        [end],
    );
    const apptIdNum = React.useMemo(() => {
        const n = Number(appointmentId);
        return Number.isFinite(n) && n > 0 ? n : undefined;
    }, [appointmentId]);

    const { audits, loading, error, refresh } = useFinalizeAudits({
        open,
        appointmentId: apptIdNum,
        deviceId: deviceId || undefined,
        start: startDate,
        end: endDate,
    });

    function formatIso(iso: string) {
        try {
            const d = new Date(iso);
            return d.toLocaleString('pt-BR', { hour12: false });
        } catch {
            return iso;
        }
    }

    return (
        <AppModal open={open} onClose={onClose} maxHeightVh={90}>
            <div style={{ padding: 10, minWidth: 480 }}>
                <h3 style={{ marginTop: 0 }}>Auditorias de Finalização</h3>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 8,
                        marginBottom: 10,
                    }}
                >
                    <label
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                        }}
                    >
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                            Device ID
                        </span>
                        <input
                            value={deviceId}
                            onChange={e => setDeviceId(e.target.value)}
                            placeholder='opcional'
                        />
                    </label>
                    <label
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                        }}
                    >
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                            ID do Compromisso
                        </span>
                        <input
                            value={appointmentId}
                            onChange={e => setAppointmentId(e.target.value)}
                            placeholder='ex: 123'
                        />
                    </label>
                    <label
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                        }}
                    >
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                            Início (ISO)
                        </span>
                        <input
                            value={start}
                            onChange={e => setStart(e.target.value)}
                            placeholder='2025-09-01T00:00:00'
                        />
                    </label>
                    <label
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                        }}
                    >
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                            Fim (ISO)
                        </span>
                        <input
                            value={end}
                            onChange={e => setEnd(e.target.value)}
                            placeholder='2025-09-30T23:59:59'
                        />
                    </label>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <button onClick={() => refresh()} disabled={loading}>
                        {loading ? 'Atualizando...' : 'Atualizar'}
                    </button>
                    <button onClick={onClose}>Fechar</button>
                </div>
                {error && (
                    <div style={{ color: 'crimson', marginBottom: 8 }}>
                        Erro: {error}
                    </div>
                )}
                <div
                    style={{
                        maxHeight: '60vh',
                        overflow: 'auto',
                        borderTop: '1px solid #e5e7eb',
                    }}
                >
                    {audits.length === 0 ? (
                        <div style={{ opacity: 0.7, padding: 8 }}>
                            Nenhum resultado.
                        </div>
                    ) : (
                        <table
                            style={{
                                width: '100%',
                                fontSize: 12,
                                borderCollapse: 'collapse',
                            }}
                        >
                            <thead>
                                <tr
                                    style={{
                                        textAlign: 'left',
                                        borderBottom: '1px solid #e5e7eb',
                                    }}
                                >
                                    <th style={{ padding: '6px 4px' }}>
                                        Quando
                                    </th>
                                    <th style={{ padding: '6px 4px' }}>Appt</th>
                                    <th style={{ padding: '6px 4px' }}>
                                        Cliente
                                    </th>
                                    <th style={{ padding: '6px 4px' }}>
                                        Device
                                    </th>
                                    <th style={{ padding: '6px 4px' }}>
                                        Drift(ms)
                                    </th>
                                    <th style={{ padding: '6px 4px' }}>
                                        Ajuste
                                    </th>
                                    <th style={{ padding: '6px 4px' }}>
                                        Razão
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {audits.map(a => (
                                    <tr
                                        key={a.id}
                                        style={{
                                            borderBottom: '1px solid #f3f4f6',
                                        }}
                                    >
                                        <td
                                            style={{
                                                padding: '6px 4px',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {formatIso(a.created_at)}
                                        </td>
                                        <td style={{ padding: '6px 4px' }}>
                                            #{a.appointment_id}
                                        </td>
                                        <td style={{ padding: '6px 4px' }}>
                                            #{a.client_id}
                                        </td>
                                        <td style={{ padding: '6px 4px' }}>
                                            {a.device_id || '—'}
                                        </td>
                                        <td style={{ padding: '6px 4px' }}>
                                            {a.drift_ms ?? '—'}
                                        </td>
                                        <td style={{ padding: '6px 4px' }}>
                                            {a.adjusted_times ? 'sim' : 'não'}
                                        </td>
                                        <td style={{ padding: '6px 4px' }}>
                                            {a.reason || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </AppModal>
    );
}
