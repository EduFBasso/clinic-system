// src/pages/Home.tsx
import React, { useEffect, useState } from 'react';

import Header from '../components/Header';
import Faixa from '../components/Faixa';
import NavBar from '../components/NavBar';
import MainContent from '../components/MainContent';
import Footer from '../components/Footer';
import UpdateBanner from '../components/UpdateBanner';
import styles from '../styles/pages/Home.module.css';
// ScheduleModal removido — usamos apenas QuickScheduleModal
import QuickScheduleModal from '../components/QuickScheduleModal';
import MonthlyAgendaModal from '../components/MonthlyAgendaModal';
import WeeklyAgendaModal from '../components/WeeklyAgendaModal';
import SystemMessageModal from '../components/SystemMessageModal';
import DailyAgendaModal from '../components/DailyAgendaModal';
import AppointmentDetailsModal from '../components/AppointmentDetailsModal';
import PendingActionsModal from '../components/PendingActionsModal';
import type { Appointment } from '../hooks/useAppointments';
import { useAppVersionWatcher, acceptAndReload } from '../hooks/useAppVersion';
import { useAppointmentsLivePing } from '../hooks/useAppointmentsLivePing';
import { dispatchers } from '../events/dispatchers';
import { focusClientCard } from '../utils/focusClientCard';
import { useAgendaModals, ensureClientBasic } from '../hooks/useAgendaModals';
import { API_BASE } from '../config/api';
import { usePendingActionsListeners } from '../hooks/usePendingActionsListeners';

export default function Home() {
    const [selectedClientId, setSelectedClientId] = useState<number | null>(
        null,
    );
    const {
        monthlyOpen,
        setMonthlyOpen,
        routeClient,
        setRouteClient,
        routeInitialMonth,
        setRouteInitialMonth,
        weeklyOpen,
        setWeeklyOpen,
        quickOpen,
        setQuickOpen,
        routeEditAppt,
        setRouteEditAppt,
        dailyOpen,
        setDailyOpen,
        dailyDate,
        dailyFocusId,
        detailsOpen,
        setDetailsOpen,
        detailsAppt,
        setDetailsAppt,
        openMonthly,
        openWeekly,
        openDaily,
        clearAgendaRouteFlags,
    } = useAgendaModals();
    const [sysMsg, setSysMsg] = useState<{
        text: string;
        type: 'success' | 'error' | 'info';
        autoCloseMs?: number;
    } | null>(null);
    const version = useAppVersionWatcher();
    // Live ping: simple heuristic — enable while the page is open.
    // We can refine to enable only when there may be ongoing appointments by inspecting clients in future.
    useAppointmentsLivePing({ enabled: true, pollIntervalMs: 30000 });
    const { pendingActionsOpen, pendingAppt, closePendingActions } =
        usePendingActionsListeners();

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
                const reminderId = url.searchParams.get('reminder');

                if (cid) setSelectedClientId(Number(cid));

                const parsedDate = dateStr
                    ? new Date(dateStr + 'T00:00:00')
                    : undefined;
                if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
                    setRouteInitialMonth(parsedDate);
                } else {
                    setRouteInitialMonth(undefined);
                }

                if (mode === 'week') {
                    setWeeklyOpen(true);
                }

                // Push notification reminder: focus ClientCard (or save pending for post-login)
                if (reminderId) {
                    const token = localStorage.getItem('accessToken');
                    const isWa = url.searchParams.get('wa') === '1';
                    const waPhone = url.searchParams.get('wp') ?? '';
                    const waText = url.searchParams.get('wt') ?? '';
                    if (token) {
                        try {
                            const res = await fetch(
                                `${API_BASE}/agenda/appointments/${reminderId}/`,
                                {
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                    },
                                },
                            );
                            if (res.ok) {
                                const appt = (await res.json()) as {
                                    client_id?: number;
                                    client?: { id?: number };
                                };
                                const clientId =
                                    appt.client_id ?? appt.client?.id ?? null;
                                if (clientId) {
                                    setSelectedClientId(clientId);
                                    focusClientCard(clientId, { delayMs: 300 });
                                }
                                if (isWa) {
                                    fetch(
                                        `${API_BASE}/agenda/appointments/${reminderId}/confirm-whatsapp/`,
                                        {
                                            method: 'POST',
                                            headers: {
                                                Authorization: `Bearer ${token}`,
                                                'Content-Type':
                                                    'application/json',
                                            },
                                        },
                                    ).catch(() => {
                                        /* silencioso */
                                    });
                                    if (waPhone && waText) {
                                        window.open(
                                            `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}`,
                                            '_blank',
                                        );
                                    }
                                }
                            }
                        } catch {
                            /* silencioso */
                        }
                    } else {
                        sessionStorage.setItem(
                            'pushPending',
                            JSON.stringify({
                                appointmentId: Number(reminderId),
                                wa: isWa,
                                waPhone,
                                waText,
                            }),
                        );
                    }
                    const clean = new URL(window.location.href);
                    clean.searchParams.delete('reminder');
                    clean.searchParams.delete('wa');
                    clean.searchParams.delete('wp');
                    clean.searchParams.delete('wt');
                    window.history.replaceState({}, '', clean.toString());
                }

                if (editId && cid) {
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
                            if (res.ok)
                                appt = (await res.json()) as Appointment;
                        }
                        if (appt) setRouteEditAppt(appt);
                    } catch {
                        /* ignore fetch error */
                    }
                    setQuickOpen(true);
                    return;
                }

                if (isNew && cid) {
                    const clientBasic = await ensureClientBasic(Number(cid));
                    setRouteClient(clientBasic);
                    setQuickOpen(true);
                    return;
                }

                if (cid && dateStr) {
                    const clientBasic = await ensureClientBasic(Number(cid));
                    setRouteClient(clientBasic);
                    setMonthlyOpen(true);
                }
            } catch {
                /* ignore */
            }
        })();
    }, []);

    // Pós-login: se houver um pushPending salvo (clique em notificação sem estar logado),
    // busca o appointment, seleciona e foca o ClientCard.
    useEffect(() => {
        const handlePostLoginFocus = () => {
            const raw = sessionStorage.getItem('pushPending');
            if (!raw) return;
            const token = localStorage.getItem('accessToken');
            if (!token) return;
            let pending: {
                appointmentId: number;
                wa?: boolean;
                waPhone: string;
                waText: string;
            };
            try {
                pending = JSON.parse(raw);
            } catch {
                sessionStorage.removeItem('pushPending');
                return;
            }
            sessionStorage.removeItem('pushPending');
            fetch(`${API_BASE}/agenda/appointments/${pending.appointmentId}/`, {
                headers: { Authorization: `Bearer ${token}` },
            })
                .then(r => (r.ok ? r.json() : null))
                .then(
                    (
                        appt: {
                            client_id?: number;
                            client?: { id?: number };
                        } | null,
                    ) => {
                        const clientId =
                            appt?.client_id ?? appt?.client?.id ?? null;
                        if (clientId) {
                            setSelectedClientId(clientId);
                            focusClientCard(clientId, { delayMs: 400 });
                        }
                        if (pending.wa) {
                            fetch(
                                `${API_BASE}/agenda/appointments/${pending.appointmentId}/confirm-whatsapp/`,
                                {
                                    method: 'POST',
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                        'Content-Type': 'application/json',
                                    },
                                },
                            ).catch(() => {
                                /* silencioso */
                            });
                            if (pending.waPhone && pending.waText) {
                                window.open(
                                    `https://wa.me/${pending.waPhone}?text=${encodeURIComponent(pending.waText)}`,
                                    '_blank',
                                );
                            }
                        }
                    },
                )
                .catch(() => {
                    /* silencioso */
                });
        };
        window.addEventListener('updateClients', handlePostLoginFocus);
        return () =>
            window.removeEventListener('updateClients', handlePostLoginFocus);
    }, []);

    // Listener global para mensagens do sistema
    useEffect(() => {
        function onSystemMessage(e: Event) {
            const det = (e as CustomEvent).detail || {};
            if (det && det.text) {
                setSysMsg({
                    text: String(det.text),
                    type: det.type || 'info',
                    autoCloseMs:
                        typeof det.autoCloseMs === 'number'
                            ? det.autoCloseMs
                            : undefined,
                });
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

    // Mensagem pendente via localStorage (usada quando navegamos para a Home após salvar)
    useEffect(() => {
        try {
            const raw = localStorage.getItem('pendingSystemMessage');
            if (raw) {
                const obj = JSON.parse(raw);
                if (obj && obj.text) {
                    setSysMsg({
                        text: String(obj.text),
                        type: obj.type || 'info',
                        autoCloseMs:
                            typeof obj.autoCloseMs === 'number'
                                ? obj.autoCloseMs
                                : 10000,
                    });
                }
                localStorage.removeItem('pendingSystemMessage');
            }
        } catch {
            /* noop */
        }
    }, []);

    // Aberturas diretas dos modais da Agenda
    // openMonthly, openWeekly, openDaily e clearAgendaRouteFlags definidos em useAgendaModals

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

    // Cross-aba: ao detectar storage event da chave appointments.changed, disparar refresh local
    useEffect(() => {
        function onStorage(ev: StorageEvent) {
            if (ev.key === 'appointments.changed') {
                try {
                    window.dispatchEvent(new Event('appointments:changed'));
                    dispatchers.updateClients();
                } catch {
                    /* noop */
                }
            } else if (ev.key === 'pendingSystemMessage' && ev.newValue) {
                try {
                    const obj = JSON.parse(ev.newValue);
                    if (obj && obj.text) {
                        setSysMsg({
                            text: String(obj.text),
                            type: obj.type || 'info',
                            autoCloseMs:
                                typeof obj.autoCloseMs === 'number'
                                    ? obj.autoCloseMs
                                    : 10000,
                        });
                    }
                    localStorage.removeItem('pendingSystemMessage');
                } catch {
                    /* noop */
                }
            }
        }
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
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
    // openSchedule removido — consolidado no QuickSchedule
    // openMonthly, openWeekly, openDaily e clearAgendaRouteFlags definidos em useAgendaModals

    // Listener global para mensagens do sistema
    useEffect(() => {
        try {
            window.dispatchEvent(new Event('ensureScrollUnlocked'));
        } catch {
            /* noop */
        }
    }, []);
    // Also ensure unlock whenever no agenda/system modal is open
    useEffect(() => {
        const anyOpen =
            quickOpen ||
            monthlyOpen ||
            weeklyOpen ||
            dailyOpen ||
            detailsOpen ||
            !!sysMsg ||
            pendingActionsOpen;
        if (!anyOpen) {
            try {
                window.dispatchEvent(new Event('ensureScrollUnlocked'));
            } catch {
                /* noop */
            }
        }
    }, [
        quickOpen,
        monthlyOpen,
        weeklyOpen,
        dailyOpen,
        detailsOpen,
        sysMsg,
        pendingActionsOpen,
    ]);

    return (
        <>
            <div className={styles.container}>
                <Header />
                <Faixa />
                <NavBar
                    openNewClientModal={handleAddClient}
                    selectedClientId={selectedClientId}
                    agendaOpeners={{
                        openWeekly,
                    }}
                />
                <MainContent
                    setSelectedClientId={setSelectedClientId}
                    selectedClientId={selectedClientId}
                />
                {/* Route-driven Agenda modals (ScheduleModal removido) */}
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
                {version.hasUpdate && (
                    <UpdateBanner
                        onReload={acceptAndReload}
                        onDismiss={version.dismiss}
                        message={
                            version.latestSeen && version.currentAccepted
                                ? `Nova versão disponível (${version.latestSeen}).`
                                : 'Nova versão disponível.'
                        }
                    />
                )}
                <SystemMessageModal
                    open={!!sysMsg}
                    message={sysMsg?.text || null}
                    type={sysMsg?.type || 'info'}
                    onClose={() => setSysMsg(null)}
                    autoCloseMs={sysMsg?.autoCloseMs ?? 10000}
                />
                <AppointmentDetailsModal
                    open={detailsOpen}
                    appt={(detailsAppt as Appointment) || null}
                    onClose={() => setDetailsOpen(false)}
                />
                {pendingActionsOpen && pendingAppt && (
                    <PendingActionsModal
                        open
                        appt={pendingAppt}
                        onClose={closePendingActions}
                    />
                )}
                {/* Reminder: push notification click focuses the ClientCard directly (no modal) */}
            </div>
        </>
    );
}
