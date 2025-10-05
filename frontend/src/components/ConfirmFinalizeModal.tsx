/**
 * @deprecated Substituído por `PendingActionsModal.tsx` que agrega cancel + finalize + regras de tempo.
 * Manter temporariamente para rollback rápido se necessário; remover após período de estabilização.
 */
import React from 'react';
import AppModal from './Modal';

type Props = {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isEarly?: boolean;
    clientId?: number;
    appointmentId?: number | null;
};

export default function ConfirmFinalizeModal({
    open,
    onClose,
    onConfirm,
    isEarly,
    clientId,
    appointmentId,
}: Props) {
    return (
        <AppModal open={open} onClose={onClose} closeOnEnter={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ margin: 0 }}>
                    {isEarly
                        ? 'Finalizar atendimento antes do horário?'
                        : 'Finalizar atendimento?'}
                </h3>
                <div style={{ color: '#374151', fontSize: 14 }}>
                    {isEarly
                        ? 'Esta ação irá concluir a consulta imediatamente, mesmo que o horário ainda não tenha terminado.'
                        : 'Esta ação irá marcar a consulta como concluída.'}
                </div>
                {(clientId || appointmentId) && (
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {clientId ? `Cliente #${clientId}` : ''}
                        {clientId && appointmentId ? ' · ' : ''}
                        {appointmentId ? `Agendamento #${appointmentId}` : ''}
                    </div>
                )}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 8,
                        marginTop: 4,
                    }}
                >
                    <button
                        type='button'
                        onClick={onClose}
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
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        style={{
                            padding: '6px 10px',
                            background: 'var(--color-done)',
                            color: '#fff',
                            borderRadius: 6,
                            fontWeight: 700,
                        }}
                    >
                        Concluir agora
                    </button>
                </div>
            </div>
        </AppModal>
    );
}
