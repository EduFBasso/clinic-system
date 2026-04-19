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
import type {
    PendingReturnContext,
    QuickScheduleInitialDraft,
} from '../types/agendaFlow';
import { API_BASE } from '../config/api';
import { usePendingActionsListeners } from '../hooks/usePendingActionsListeners';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Home() {
    const navigate = useNavigate();
    // Superusers go straight to /admin — they are not practitioners
    useEffect(() => {
        try {
            const stored = localStorage.getItem('loggedProfessional');
            if (stored) {
                const prof = JSON.parse(stored);
                if (prof?.is_superuser) {
                    navigate('/admin', { replace: true });
                }
            }
        } catch {
            /* noop */
        }
    }, [navigate]);

    const location = useLocation();
    const [selectedClientId, setSelectedClientId] = useState<number | null>(
        null,
    );
    const [quickInitialDraft, setQuickInitialDraft] = useState<QuickScheduleInitialDraft | null>(null);
    const {
        monthlyOpen,
        setMonthlyOpen,
        routeClient,
        setRouteClient,
        routeInitialMonth,
        setRouteInitialMonth,
        weeklyOpen,
        setWeeklyOpen,
        weeklyInitialDate,
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
        type: 'success' | 'error' | 'info' | 'warning';
        autoCloseMs?: number;
    } | null>(null);
    const version = useAppVersionWatcher();
    // Live ping: simple heuristic — enable while the page is open.
    // We can refine to enable only when there may be ongoing appointments by inspecting clients in future.
    useAppointmentsLivePing({ enabled: true, pollIntervalMs: 30000 });
    const {
        pendingActionsOpen,
        pendingAppt,
        pendingReturnContext,
        closePendingActions,
    } =
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

    // Reabre AppointmentDetailsModal após retorno da página de registro/edição de charges
    // e exibe mensagem de sessão expirada quando redirecionado de outra página
    useEffect(() => {
        const loginMsg = sessionStorage.getItem('loginRequiredMsg');
        if (loginMsg) {
            sessionStorage.removeItem('loginRequiredMsg');
            setSysMsg({ text: loginMsg, type: 'error', autoCloseMs: 8000 });
        }

        const raw = sessionStorage.getItem('reopenAppointmentDetails');
        const resumeQuickRaw = sessionStorage.getItem('resumeQuickSchedule');
        const resumeAgendaRaw = sessionStorage.getItem('resumeAgendaModal');
        if (resumeQuickRaw) {
            sessionStorage.removeItem('resumeQuickSchedule');
            try {
                const parsed = JSON.parse(resumeQuickRaw) as QuickScheduleInitialDraft;
                if (parsed?.clientId) {
                    ensureClientBasic(parsed.clientId)
                        .then(clientBasic => {
                            setRouteClient(clientBasic);
                            setRouteEditAppt(null);
                            setQuickInitialDraft(parsed);
                            setQuickOpen(true);
                        })
                        .catch(() => {
                            /* noop */
                        });
                }
            } catch {
                /* noop */
            }
        }
        if (resumeAgendaRaw) {
            sessionStorage.removeItem('resumeAgendaModal');
            try {
                const parsed = JSON.parse(resumeAgendaRaw) as PendingReturnContext;
                if (parsed?.kind === 'daily-agenda') {
                    const d = new Date(`${parsed.dateISO}T00:00:00`);
                    if (!Number.isNaN(d.getTime())) {
                        openDaily(d, parsed.focusAppointmentId);
                        return;
                    }
                }
                if (parsed?.kind === 'weekly-agenda') {
                    const d = new Date(`${parsed.dateISO}T00:00:00`);
                    openWeekly(Number.isNaN(d.getTime()) ? undefined : d);
                    return;
                }
                if (parsed?.kind === 'monthly-agenda' && parsed.clientId) {
                    const d = new Date(`${parsed.monthISO}T00:00:00`);
                    void ensureClientBasic(parsed.clientId)
                        .then(clientBasic => {
                            setRouteClient(clientBasic);
                            setRouteInitialMonth(
                                Number.isNaN(d.getTime()) ? undefined : d,
                            );
                            setMonthlyOpen(true);
                        })
                        .catch(() => {
                            /* noop */
                        });
                    return;
                }
            } catch {
                /* noop */
            }
        }
        if (!raw) return;
        sessionStorage.removeItem('reopenAppointmentDetails');
        const apptId = parseInt(raw, 10);
        if (!apptId) return;
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        fetch(`${API_BASE}/agenda/appointments/${apptId}/`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => (r.ok ? r.json() : null))
            .then(appt => {
                if (appt) {
                    setDetailsAppt(appt as Appointment);
                    setDetailsOpen(true);
                }
            })
            .catch(() => {
                /* noop */
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location]);

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
                            setQuickInitialDraft(null);
                            clearAgendaRouteFlags();
                        }}
                        client={routeClient}
                        editAppointment={routeEditAppt}
                        initialDraft={quickInitialDraft}
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
                    initialDate={weeklyInitialDate}
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
                {detailsAppt && (
                    <AppointmentDetailsModal
                        open={detailsOpen}
                        appt={detailsAppt as Appointment}
                        onClose={() => {
                            setDetailsOpen(false);
                            setDetailsAppt(null);
                        }}
                    />
                )}
                {pendingActionsOpen && pendingAppt && (
                    <PendingActionsModal
                        open
                        appt={pendingAppt}
                        returnContext={pendingReturnContext}
                        onClose={closePendingActions}
                    />
                )}
                {/* Reminder: push notification click focuses the ClientCard directly (no modal) */}
            </div>
        </>
    );
}
