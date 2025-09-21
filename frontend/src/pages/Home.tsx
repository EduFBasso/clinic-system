// src/pages/Home.tsx
import React, { useEffect, useState } from 'react';
import { on } from '../events/bus';
import type { OpenDailyAgendaPayload } from '../events/bus';

import Header from '../components/Header';
import Faixa from '../components/Faixa';
import NavBar from '../components/NavBar';
import MainContent from '../components/MainContent';
import Footer from '../components/Footer';
import styles from '../styles/pages/Home.module.css';
import ScheduleModal from '../components/ScheduleModal';
import QuickScheduleModal from '../components/QuickScheduleModal';
import MonthlyAgendaModal from '../components/MonthlyAgendaModal';
import WeeklyAgendaModal from '../components/WeeklyPreviewModal';
import SystemMessageModal from '../components/SystemMessageModal';
import DailyAgendaModal from '../components/DailyAgendaModal';
import AppointmentDetailsModal from '../components/AppointmentDetailsModal';
import type { ClientBasic } from '../types/ClientBasic';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';
import type { Appointment } from '../hooks/useAppointments';

export default function Home() {
    const [selectedClientId, setSelectedClientId] = useState<number | null>(
        null,
    );
    // Route-driven agenda modal states
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [monthlyOpen, setMonthlyOpen] = useState(false);
    const [weeklyOpen, setWeeklyOpen] = useState(false);
    const [routeClient, setRouteClient] = useState<ClientBasic | undefined>(
        undefined,
    );
    const [routeDefaultDate, setRouteDefaultDate] = useState<Date | undefined>(
        undefined,
    );
    const [routeEditAppt, setRouteEditAppt] = useState<Appointment | null>(
        null,
    );
    const [dailyOpen, setDailyOpen] = useState(false);
    const [dailyDate, setDailyDate] = useState<Date>(new Date());
    const [dailyFocusId, setDailyFocusId] = useState<number | undefined>(
        undefined,
    );
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsAppt, setDetailsAppt] = useState<Appointment | null>(null);
    const [routeInitialMonth, setRouteInitialMonth] = useState<
        Date | undefined
    >(undefined);
    const [sysMsg, setSysMsg] = useState<{
        text: string;
        type: 'success' | 'error' | 'info';
    } | null>(null);

    // Aux: carrega nome básico do cliente dado um ID (cache localStorage se possível)
    async function ensureClientBasic(id: number): Promise<ClientBasic> {
        const cached = localStorage.getItem(`client.name.${id}`);
        if (cached) {
            const [first_name, ...rest] = cached.split(' ');
            const last_name = rest.join(' ');
            return {
                id,
                first_name,
                last_name,
                phone: '',
                email: '',
            } as ClientBasic;
        }
        const token = localStorage.getItem('accessToken');
        if (isTokenExpired(token))
            return {
                id,
                first_name: 'Cliente',
                last_name: String(id),
                phone: '',
                email: '',
            } as ClientBasic;
        try {
            const res = await fetch(`${API_BASE}/register/clients/${id}/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                const cb: ClientBasic = {
                    id: data.id,
                    first_name: data.first_name || 'Cliente',
                    last_name: data.last_name || '',
                    phone: data.phone || '',
                    email: data.email || '',
                };
                try {
                    localStorage.setItem(
                        `client.name.${id}`,
                        `${cb.first_name} ${cb.last_name}`.trim(),
                    );
                } catch {
                    /* noop */
                }
                return cb;
            }
        } catch {
            /* noop */
        }
        return {
            id,
            first_name: 'Cliente',
            last_name: String(id),
            phone: '',
            email: '',
        } as ClientBasic;
    }

    // Seleciona o cliente via ?client=ID e abre modais conforme params (?new, ?edit, ?mode)
    useEffect(() => {
        (async () => {
            try {
                const url = new URL(window.location.href);
                const cid = url.searchParams.get('client');
                const dateStr = url.searchParams.get('date'); // yyyy-mm-dd
                const isNew = url.searchParams.get('new') === '1';
                const editId = url.searchParams.get('edit');
                const mode = url.searchParams.get('mode');

                if (cid) setSelectedClientId(Number(cid));

                const parsedDate = dateStr
                    ? new Date(dateStr + 'T00:00:00')
                    : undefined;
                if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
                    setRouteDefaultDate(parsedDate);
                    setRouteInitialMonth(parsedDate);
                } else {
                    setRouteDefaultDate(undefined);
                    setRouteInitialMonth(undefined);
                }

                if (mode === 'week') {
                    setWeeklyOpen(true);
                }

                if (editId && cid) {
                    // Carrega cliente e compromisso para abrir direto em edição (ScheduleModal)
                    const clientBasic = await ensureClientBasic(Number(cid));
                    setRouteClient(clientBasic);
                    try {
                        const token = localStorage.getItem('accessToken');
                        let appt: Appointment | null = null;
                        if (token) {
                            const res = await fetch(
                                `${API_BASE}/agenda/appointments/${editId}/`,
                                {
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                    },
                                },
                            );
                            if (res.ok) {
                                appt = (await res.json()) as Appointment;
                            }
                        }
                        if (appt) setRouteEditAppt(appt);
                    } catch {
                        /* ignore fetch error */
                    }
                    setScheduleOpen(true);
                    return;
                }

                if (isNew && cid) {
                    const clientBasic = await ensureClientBasic(Number(cid));
                    setRouteClient(clientBasic);
                    setScheduleOpen(true);
                    return;
                }

                if (cid && dateStr) {
                    const clientBasic = await ensureClientBasic(Number(cid));
                    setRouteClient(clientBasic);
                    setMonthlyOpen(true);
                }
            } catch {
                // ignore
            }
        })();
    }, []);

    // Listener global para mensagens do sistema
    useEffect(() => {
        function onSystemMessage(e: Event) {
            const det = (e as CustomEvent).detail || {};
            if (det && det.text) {
                setSysMsg({ text: String(det.text), type: det.type || 'info' });
            }
        }
        window.addEventListener(
            'systemMessage',
            onSystemMessage as EventListener,
        );
        return () =>
            window.removeEventListener(
                'systemMessage',
                onSystemMessage as EventListener,
            );
    }, []);

    // Mensagem ao voltar da Agenda sem cliente selecionado
    useEffect(() => {
        try {
            const msg = localStorage.getItem('agenda.promptSelectClient');
            if (msg) {
                alert(msg);
                localStorage.removeItem('agenda.promptSelectClient');
            }
        } catch {
            // ignore
        }
    }, []);

    // Função para abrir o cadastro em nova janela
    const handleAddClient = () => {
        window.open(
            '/clients/new',
            '_blank',
            'width=800,height=700,top=80,left=120,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes',
        );
    };

    // Aberturas diretas dos modais da Agenda (novo fluxo vindo do NavBar)
    const openSchedule = async (
        clientId?: number | null,
        date?: Date,
        edit?: Appointment | null,
    ) => {
        // Agora abre o QuickSchedule (mais completo visualmente) — requer cliente
        if (!clientId) {
            // Sem cliente: informa e não tenta abrir o Quick (evita prop obrigatória ausente)
            setSysMsg({
                text: 'Selecione um cliente para abrir o agendamento rápido.',
                type: 'info',
            });
            setQuickOpen(false);
            setRouteClient(undefined);
            return;
        }
        const c = await ensureClientBasic(clientId);
        setRouteClient(c);
        setRouteDefaultDate(date);
        setRouteEditAppt(edit ?? null);
        setQuickOpen(true);
        setScheduleOpen(false);
        setMonthlyOpen(false);
        setWeeklyOpen(false);
    };

    const openMonthly = async (clientId: number, date?: Date) => {
        const c = await ensureClientBasic(clientId);
        setRouteClient(c);
        setRouteInitialMonth(date);
        setRouteEditAppt(null);
        setMonthlyOpen(true);
        setScheduleOpen(false);
        setWeeklyOpen(false);
    };

    const openWeekly = (_date?: Date) => {
        void _date;
        // WeeklyPreviewModal atual não usa data; reservado para evolução
        setRouteEditAppt(null);
        setWeeklyOpen(true);
        setScheduleOpen(false);
        setMonthlyOpen(false);
    };

    // Abrir visão diária (sem exigir cliente específico)
    function openDaily(date: Date, focusId?: number) {
        setDailyDate(date);
        setDailyFocusId(focusId);
        setDailyOpen(true);
    }

    // Remove parâmetros que forçam reabertura de modais (/agenda?new=1&edit=ID&mode=week)
    function clearAgendaRouteFlags() {
        try {
            const url = new URL(window.location.href);
            ['new', 'edit', 'mode', 'date'].forEach(k =>
                url.searchParams.delete(k),
            );
            const params = url.searchParams.toString();
            window.history.replaceState(
                {},
                '',
                url.pathname + (params ? `?${params}` : ''),
            );
        } catch {
            /* noop */
        }
    }

    // Event bridge: abrir edição direta do ScheduleModal a partir do Monthly
    useEffect(() => {
        function onOpenScheduleEdit(e: CustomEvent) {
            const det = (e && (e as CustomEvent).detail) || {};
            const c = det.client as ClientBasic | undefined;
            const d = det.date as Date | undefined;
            const a = det.appointment as Appointment | undefined;
            if (!c || !c.id) return;
            setRouteClient(c);
            setRouteDefaultDate(d);
            setRouteEditAppt(a ?? null);
            setScheduleOpen(true);
            setMonthlyOpen(false);
            setWeeklyOpen(false);
        }
        window.addEventListener(
            'openScheduleEdit',
            onOpenScheduleEdit as EventListener,
        );
        const disposeDaily = on('openDailyAgenda', det => {
            const ext = det as OpenDailyAgendaPayload & {
                focusAppointmentId?: number;
            };
            const dateIso = ext && ext.date; // backward compat
            const focusAppointmentId = ext.focusAppointmentId;
            if (dateIso) {
                const d = new Date(dateIso);
                if (!isNaN(d.getTime())) openDaily(d, focusAppointmentId);
            } else openDaily(new Date(), focusAppointmentId);
        });
        const disposeDetails = on('openAppointmentDetails', det => {
            const appt: Appointment | undefined = (
                det as { appointment?: Appointment }
            ).appointment;
            if (appt) {
                setDetailsAppt(appt);
                setDetailsOpen(true);
            }
        });
        return () => {
            window.removeEventListener(
                'openScheduleEdit',
                onOpenScheduleEdit as EventListener,
            );
            disposeDaily();
            disposeDetails();
        };
    }, []);

    // Estado do Quick
    const [quickOpen, setQuickOpen] = useState(false);

    return (
        <div className={styles.container}>
            <Header />
            <Faixa />
            <NavBar
                openNewClientModal={handleAddClient}
                selectedClientId={selectedClientId}
                agendaOpeners={{
                    openSchedule,
                    openMonthly,
                    openWeekly,
                }}
            />
            <MainContent
                setSelectedClientId={setSelectedClientId}
                selectedClientId={selectedClientId}
            />
            {/* Route-driven Agenda modals */}
            <ScheduleModal
                open={scheduleOpen}
                onClose={() => {
                    setScheduleOpen(false);
                    clearAgendaRouteFlags();
                }}
                client={routeClient}
                defaultDate={routeDefaultDate}
                editAppointment={routeEditAppt}
            />
            {routeClient && (
                <QuickScheduleModal
                    open={quickOpen}
                    onClose={() => {
                        setQuickOpen(false);
                        clearAgendaRouteFlags();
                    }}
                    client={routeClient}
                    editAppointment={routeEditAppt}
                />
            )}
            {routeClient && (
                <MonthlyAgendaModal
                    open={monthlyOpen}
                    onClose={() => {
                        setMonthlyOpen(false);
                        clearAgendaRouteFlags();
                    }}
                    client={routeClient}
                    initialMonth={routeInitialMonth}
                />
            )}
            <WeeklyAgendaModal
                open={weeklyOpen}
                onClose={() => {
                    setWeeklyOpen(false);
                    clearAgendaRouteFlags();
                }}
            />
            <DailyAgendaModal
                open={dailyOpen}
                date={dailyDate}
                focusAppointmentId={dailyFocusId}
                onClose={() => setDailyOpen(false)}
            />
            <Footer />
            <SystemMessageModal
                open={!!sysMsg}
                message={sysMsg?.text || null}
                type={sysMsg?.type || 'info'}
                onClose={() => setSysMsg(null)}
                autoCloseMs={3000}
            />
            <AppointmentDetailsModal
                open={detailsOpen}
                appt={(detailsAppt as Appointment) || null}
                onClose={() => setDetailsOpen(false)}
            />
        </div>
    );
}
