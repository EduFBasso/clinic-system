// src/pages/Home.tsx
import React, { useEffect, useState } from 'react';

import Header from '../components/Header';
import Faixa from '../components/Faixa';
import NavBar from '../components/NavBar';
import MainContent from '../components/MainContent';
import Footer from '../components/Footer';
import AppModal from '../components/Modal';
import ClientView from '../components/ClientView';
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
import PageFlashMessage from '../components/PageFlashMessage';
import type { Appointment } from '../hooks/useAppointments';
import type { ClientData } from '../types/ClientData';
import { useAppVersionWatcher, acceptAndReload } from '../hooks/useAppVersion';
import { useAppointmentsLivePing } from '../hooks/useAppointmentsLivePing';
import { dispatchers } from '../events/dispatchers';
import { focusClientCard } from '../utils/focusClientCard';
import { useAgendaModals, ensureClientBasic } from '../hooks/useAgendaModals';
import type { QuickScheduleInitialDraft } from '../types/agendaFlow';
import { API_BASE } from '../config/api';
import { usePendingActionsListeners } from '../hooks/usePendingActionsListeners';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHomeResumeFlows } from '../hooks/useHomeResumeFlows';
import { unlockPageScroll } from '../utils/unlockPageScroll';
import { getAccessToken } from '../utils/auth/session';

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
    const [clientViewOpen, setClientViewOpen] = useState(false);
    const [clientViewData, setClientViewData] = useState<ClientData | null>(null);
    const [clientViewOpenToken, setClientViewOpenToken] = useState(0);
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
        detailsReturnContext,
        setDetailsReturnContext,
        openWeekly,
        openDaily,
        clearAgendaRouteFlags,
    } = useAgendaModals();
    const [sysMsg, setSysMsg] = useState<{
        text: string;
        type: 'success' | 'error' | 'info' | 'warning';
        autoCloseMs?: number;
    } | null>(null);
    const [pageFlash, setPageFlash] = useState<{
        text: string;
        type: 'success' | 'error' | 'info' | 'warning';
        autoCloseMs?: number;
    } | null>(null);
    const version = useAppVersionWatcher();
    // Live ping: keep a conservative refresh cadence while page is visible.
    // 60s is enough after moving pending/ongoing truth to backend-driven fields/events.
    useAppointmentsLivePing({ enabled: true, pollIntervalMs: 60000 });
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
                        const token = getAccessToken();
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        function onPageFlashMessage(e: Event) {
            const det = (e as CustomEvent).detail || {};
            if (det && det.text) {
                setPageFlash({
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
            'pageFlashMessage',
            onPageFlashMessage as EventListener,
        );
        return () =>
            window.removeEventListener(
                'pageFlashMessage',
                onPageFlashMessage as EventListener,
            );
    }, []);

    useHomeResumeFlows({
        locationKey: `${location.pathname}${location.search}${location.hash}`,
        openDaily,
        openWeekly,
        setRouteClient,
        setRouteInitialMonth,
        setMonthlyOpen,
        setRouteEditAppt,
        setQuickInitialDraft,
        setQuickOpen,
        setDetailsAppt,
        setDetailsOpen,
        setDetailsReturnContext,
        setSysMsg,
    });

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
            }
        }
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const openClientView = React.useCallback((data: ClientData) => {
        setClientViewData(data);
        setClientViewOpenToken(prev => prev + 1);
        setClientViewOpen(true);
        try {
            window.history.pushState({ modal: 'clientView' }, '');
        } catch {
            /* noop */
        }
    }, []);

    const closeClientView = React.useCallback(() => {
        setClientViewOpen(false);
        // Keep clientViewData alive so content doesn't flash-disappear during the
        // modal's close transition. Clear it after the animation completes.
        setTimeout(() => setClientViewData(null), 300);
        try {
            if (
                window.history.state &&
                window.history.state.modal === 'clientView'
            ) {
                window.history.back();
            }
        } catch {
            /* noop */
        }
    }, []);

    useEffect(() => {
        function onPopState() {
            if (clientViewOpen) {
                setClientViewOpen(false);
                setTimeout(() => setClientViewData(null), 300);
            }
        }
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [clientViewOpen]);

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

    useEffect(() => {
        unlockPageScroll();
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
            unlockPageScroll();
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
                    onClientViewData={openClientView}
                />
                {/* Route-driven Agenda modals (ScheduleModal removido) */}
                {routeClient && (
                    <QuickScheduleModal
                        open={quickOpen}
                        onClose={() => {
                            unlockPageScroll();
                            setQuickOpen(false);
                            setQuickInitialDraft(null);
                            setRouteEditAppt(null);
                            setRouteClient(undefined);
                            clearAgendaRouteFlags();
                        }}
                        client={routeClient}
                        editAppointment={routeEditAppt}
                        initialDraft={quickInitialDraft}
                        afterPersist={(_, action) => {
                            if (action !== 'created') return;
                            setSelectedClientId(routeClient.id);
                            focusClientCard(routeClient.id, { delayMs: 260 });
                            focusClientCard(routeClient.id, { delayMs: 760 });
                        }}
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
                <PageFlashMessage
                    open={!!pageFlash}
                    message={pageFlash?.text || null}
                    type={pageFlash?.type || 'info'}
                    autoCloseMs={pageFlash?.autoCloseMs ?? 3200}
                    onClose={() => setPageFlash(null)}
                />
                {detailsAppt && (
                    <AppointmentDetailsModal
                        open={detailsOpen}
                        appt={detailsAppt as Appointment}
                        returnContext={detailsReturnContext}
                        onClose={() => {
                            setDetailsOpen(false);
                            setDetailsReturnContext(null);
                            // Adia o null para que AppModal processe open=false antes de desmontar.
                            // Sem isso, quando dois modais estão abertos (ex.: Monthly + Details),
                            // o Details desmonta com open=true no closure e o cleanup cega
                            // remove os locks do Monthly que ainda está aberto.
                            setTimeout(() => setDetailsAppt(null), 500);
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
                <AppModal
                    open={clientViewOpen}
                    onClose={closeClientView}
                    showCloseButton
                    fullScreen
                    disableOuterScroll
                >
                    {clientViewData && (
                        <ClientView
                            client={clientViewData}
                            openToken={clientViewOpenToken}
                        />
                    )}
                </AppModal>
                {/* Reminder: push notification click focuses the ClientCard directly (no modal) */}
            </div>
        </>
    );
}
