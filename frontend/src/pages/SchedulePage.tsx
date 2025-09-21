import React from 'react';
import type { ClientBasic } from '../types/ClientBasic';
import type { Appointment } from '../hooks/useAppointments';
import ScheduleEditorCore from '../components/ScheduleEditorCore';

export default function SchedulePage() {
    const [client, setClient] = React.useState<ClientBasic | undefined>(
        undefined,
    );
    const [edit, setEdit] = React.useState<Appointment | null>(null);
    const [defaultDate, setDefaultDate] = React.useState<Date | undefined>(
        undefined,
    );

    // Parse query params for client, date, edit
    React.useEffect(() => {
        (async () => {
            try {
                const url = new URL(window.location.href);
                const cid = url.searchParams.get('client');
                const dateStr = url.searchParams.get('date');
                const editId = url.searchParams.get('edit');

                if (dateStr) {
                    const d = new Date(dateStr + 'T00:00:00');
                    if (!isNaN(d.getTime())) setDefaultDate(d);
                }
                if (cid) {
                    const cached = localStorage.getItem(`client.name.${cid}`);
                    if (cached) {
                        const [first_name, ...rest] = cached.split(' ');
                        const last_name = rest.join(' ');
                        setClient({
                            id: Number(cid),
                            first_name,
                            last_name,
                            phone: '',
                            email: '',
                        } as ClientBasic);
                    } else {
                        // Fallback label
                        setClient({
                            id: Number(cid),
                            first_name: 'Cliente',
                            last_name: String(cid),
                            phone: '',
                            email: '',
                        } as ClientBasic);
                    }
                }
                if (editId) {
                    // opcional: poderíamos buscar detalhes, mas o core aceita null e segue criação
                    setEdit({ id: Number(editId) } as Appointment);
                }
            } catch {
                /* noop */
            }
        })();
    }, []);

    return (
        <div
            style={{
                minHeight: 'calc(var(--appmodal-vh, 1vh) * 100)',
                padding:
                    '12px 12px calc(env(safe-area-inset-bottom, 0px) + 12px)',
                background: 'var(--color-bg)',
            }}
        >
            <ScheduleEditorCore
                isOpen={true}
                onClose={() => window.history.back()}
                client={client}
                defaultDate={defaultDate}
                editAppointment={edit}
            />
        </div>
    );
}
