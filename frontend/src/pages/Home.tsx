// src/pages/Home.tsx
import React, { useEffect, useState } from 'react';
import { on } from '../events/bus';
import type { OpenDailyAgendaPayload } from '../events/bus';

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
import { getAppointmentOverride } from '../utils/appointments/overrides';
import type { SharedAppointmentLike } from '../components/shared/AppointmentCard';
import type { ClientBasic } from '../types/ClientBasic';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';
import type { Appointment } from '../hooks/useAppointments';
import { useAppVersionWatcher, acceptAndReload } from '../hooks/useAppVersion';
import { useAppointmentsLivePing } from '../hooks/useAppointmentsLivePing';
import { dispatchers } from '../events/dispatchers';
import { focusClientCard } from '../utils/focusClientCard';

export default function Home() {
    const [selectedClientId, setSelectedClientId] = useState<number | null>(
        null,
    );
    // Route-driven agenda modal states
    // const [scheduleOpen, setScheduleOpen] = useState(false); // removido
    const [monthlyOpen, setMonthlyOpen] = useState(false);
    const [weeklyOpen, setWeeklyOpen] = useState(false);
    const [routeClient, setRouteClient] = useState<ClientBasic | undefined>(
        undefined,
    );
    // routeDefaultDate removido com ScheduleModal
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
        autoCloseMs?: number;
    } | null>(null);
    const version = useAppVersionWatcher();
    // Live ping: simple heuristic — enable while the page is open.
    // We can refine to enable only when there may be ongoing appointments by inspecting clients in future.
    useAppointmentsLivePing({ enabled: true, pollIntervalMs: 30000 });
    // Pending actions modal state (replaces ConfirmFinalizeModal flow)
    const [pendingActionsOpen, setPendingActionsOpen] = useState(false);
    const [pendingAppt, setPendingAppt] =
        useState<SharedAppointmentLike | null>(null);

    // (reminderModal removido — push notification foca o ClientCard diretamente)
    // Após fechamento, limpa o objeto pendente pouco depois para evitar manter props antigas vivas
    useEffect(() => {
        if (pendingActionsOpen) return;
        const t = setTimeout(() => {
            setPendingAppt(pa => (pendingActionsOpen ? pa : null));
        }, 80);
        return () => clearTimeout(t);
    }, [pendingActionsOpen]);
    // Suppress rapid reopen of PendingActions for a short window after closing
    const lastPendingCloseRef = React.useRef<number>(0);

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
                const reminderId = url.searchParams.get('reminder');

                if (cid) setSelectedClientId(Number(cid));

                const parsedDate = dateStr
                    ? new Date(dateStr + 'T00:00:00')
                    : undefined;
                if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
                    // setRouteDefaultDate(parsedDate);
                    setRouteInitialMonth(parsedDate);
                } else {
                    // setRouteDefaultDate(undefined);
                    setRouteInitialMonth(undefined);
                }

                if (mode === 'week') {
                    setWeeklyOpen(true);
                }

                // Push notification reminder: focus ClientCard (or save pending for post-login)
                if (reminderId) {
                    const token = localStorage.getItem('accessToken');
                    if (token) {
                        // Logged in → resolve client_id and focus card
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
                            }
                        } catch {
                            /* silencioso */
                        }
                    } else {
                        // Not logged in → save to sessionStorage; useEffect pós-login will pick it up
                        const waPhone = url.searchParams.get('wp') ?? '';
                        const waText = url.searchParams.get('wt') ?? '';
                        sessionStorage.setItem(
                            'pushPending',
                            JSON.stringify({
                                appointmentId: Number(reminderId),
                                waPhone,
                                waText,
                            }),
                        );
                    }
                    // Clean up URL params without reloading
                    const clean = new URL(window.location.href);
                    clean.searchParams.delete('reminder');
                    clean.searchParams.delete('wp');
                    clean.searchParams.delete('wt');
                    window.history.replaceState({}, '', clean.toString());
                }

                if (editId && cid) {
                    // Carrega cliente e compromisso para abrir direto em edição (QuickSchedule)
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
                // ignore
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

    // Listener global: ao clicar em "Finalizar", abre o PendingActionsModal
    useEffect(() => {
        async function onConfirmFinalize(e: Event) {
            const ce = e as CustomEvent;
            const det =
                (ce && (ce as CustomEvent).detail) ||
                ({} as {
                    isEarly?: boolean;
                    clientId?: number;
                    appointmentId?: number | null;
                    proceed?: () => void; // legacy, não usamos mais
                });
            // Bloqueia o default para impedir fallback com window.confirm
            try {
                (e as Event).preventDefault?.();
            } catch {
                /* noop */
            }
            const apptId = det.appointmentId;
            if (!apptId) {
                try {
                    window.dispatchEvent(
                        new CustomEvent('systemMessage', {
                            detail: {
                                text: 'Não foi possível identificar o agendamento para concluir.',
                                type: 'error',
                            },
                        }),
                    );
                } catch {
                    /* noop */
                }
                return;
            }
            // Debounce/suppress: if we just closed pendingActions, ignore a rapid duplicate open
            const nowTs = Date.now();
            if (nowTs - lastPendingCloseRef.current < 1500) {
                try {
                    window.dispatchEvent(
                        new CustomEvent('debug:log', {
                            detail: {
                                label: 'Home: suppressed confirmFinalize due to recent forceClose',
                                data: {
                                    deltaMs:
                                        nowTs - lastPendingCloseRef.current,
                                },
                                ts: nowTs,
                            },
                        }),
                    );
                } catch {
                    /* noop */
                }
                return;
            }
            // Carrega dados do agendamento para exibir no modal de Ações Pendentes
            try {
                const token = localStorage.getItem('accessToken') || '';
                const headers: Record<string, string> = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const r = await fetch(
                    `${API_BASE}/agenda/appointments/${apptId}/`,
                    { headers, cache: 'no-store' },
                );
                if (!r.ok) throw new Error('Falha ao carregar agendamento');
                const data = await r.json();
                const appt: SharedAppointmentLike = {
                    id: data.id,
                    start_at: data.start_at,
                    end_at: data.end_at,
                    status: data.status,
                    notes: data.notes,
                    client_name: data.client_name,
                    client: data.client,
                    title: data.title,
                };
                setPendingAppt(appt);
                setPendingActionsOpen(true);
            } catch (err) {
                const msg =
                    err instanceof Error
                        ? err.message
                        : 'Erro ao abrir ações pendentes';
                try {
                    window.dispatchEvent(
                        new CustomEvent('systemMessage', {
                            detail: { text: msg, type: 'error' },
                        }),
                    );
                } catch {
                    /* noop */
                }
            }
        }
        window.addEventListener(
            'confirmFinalizeAppointment',
            onConfirmFinalize as EventListener,
        );
        return () =>
            window.removeEventListener(
                'confirmFinalizeAppointment',
                onConfirmFinalize as EventListener,
            );
    }, []);

    // Novo handler global: qualquer componente pode abrir Ações Pendentes via evento
    useEffect(() => {
        // Mantém supressões temporárias pós-cancel
        const recentCanceled = new Map<number, number>(); // apptId -> timestamp
        // Listener auxiliar para marcar cancelamentos concluídos
        function onCancelFinalizeFlag(ev: Event) {
            const ce = ev as CustomEvent;
            const det = (ce?.detail || {}) as { id?: number; status?: string };
            if (det?.id && det.status === 'canceled') {
                recentCanceled.set(det.id, Date.now());
            }
        }
        window.addEventListener(
            'appointment:statusChanged',
            onCancelFinalizeFlag,
        );

        async function onOpenPending(e: Event) {
            const ce = e as CustomEvent;
            const det =
                (ce && (ce as CustomEvent).detail) ||
                ({} as {
                    appt?: SharedAppointmentLike;
                    appointmentId?: number | null;
                });
            try {
                const stack = new Error().stack;
                window.dispatchEvent(
                    new CustomEvent('debug:log', {
                        detail: {
                            label: 'Home: pendingActions:open received',
                            data: {
                                hasApptInDetail: !!det.appt,
                                appointmentId:
                                    det.appt?.id ?? det.appointmentId,
                                triggeredAt: new Date().toISOString(),
                                stack,
                            },
                            ts: Date.now(),
                        },
                    }),
                );
            } catch {
                /* noop */
            }
            try {
                (e as Event).preventDefault?.();
            } catch {
                /* noop */
            }
            const nowTs = Date.now();
            if (nowTs - lastPendingCloseRef.current < 1500) {
                try {
                    window.dispatchEvent(
                        new CustomEvent('debug:log', {
                            detail: {
                                label: 'Home: suppressed pendingActions:open due to recent forceClose',
                                data: {
                                    deltaMs:
                                        nowTs - lastPendingCloseRef.current,
                                },
                                ts: nowTs,
                            },
                        }),
                    );
                } catch {
                    /* noop */
                }
                return;
            }
            if (det.appt) {
                // Se acabou de ser cancelado, suprimir reabertura
                const rcTs = det.appt.id
                    ? recentCanceled.get(det.appt.id)
                    : undefined;
                if (rcTs && Date.now() - rcTs < 8000) {
                    try {
                        window.dispatchEvent(
                            new CustomEvent('debug:log', {
                                detail: {
                                    label: 'Home: suppressed reopen (recent canceled appt object)',
                                    data: {
                                        apptId: det.appt.id,
                                        deltaMs: Date.now() - rcTs,
                                    },
                                    ts: Date.now(),
                                },
                            }),
                        );
                    } catch {
                        /* noop */
                    }
                    return;
                }
                setPendingAppt(det.appt);
                setPendingActionsOpen(true);
                return;
            }
            const apptId = det.appointmentId;
            if (!apptId) return;
            const rcTs = recentCanceled.get(apptId);
            if (rcTs && Date.now() - rcTs < 8000) {
                try {
                    window.dispatchEvent(
                        new CustomEvent('debug:log', {
                            detail: {
                                label: 'Home: suppressed reopen (recent canceled apptId)',
                                data: { apptId, deltaMs: Date.now() - rcTs },
                                ts: Date.now(),
                            },
                        }),
                    );
                } catch {
                    /* noop */
                }
                return;
            }
            try {
                const token = localStorage.getItem('accessToken') || '';
                const headers: Record<string, string> = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const r = await fetch(
                    `${API_BASE}/agenda/appointments/${apptId}/`,
                    { headers, cache: 'no-store' },
                );
                if (!r.ok) throw new Error('Falha ao carregar agendamento');
                const data = await r.json();
                if (data.status && data.status !== 'scheduled') {
                    // Não abrir para status cancelado/concluído
                    try {
                        window.dispatchEvent(
                            new CustomEvent('debug:log', {
                                detail: {
                                    label: 'Home: skipped open (status not scheduled)',
                                    data: { apptId, status: data.status },
                                    ts: Date.now(),
                                },
                            }),
                        );
                    } catch {
                        /* noop */
                    }
                    return;
                }
                const appt: SharedAppointmentLike = {
                    id: data.id,
                    start_at: data.start_at,
                    end_at: data.end_at,
                    status: data.status,
                    notes: data.notes,
                    client_name: data.client_name,
                    client: data.client,
                    title: data.title,
                };
                setPendingAppt(appt);
                setPendingActionsOpen(true);
            } catch (err) {
                const msg =
                    err instanceof Error
                        ? err.message
                        : 'Erro ao abrir ações pendentes';
                try {
                    window.dispatchEvent(
                        new CustomEvent('systemMessage', {
                            detail: { text: msg, type: 'error' },
                        }),
                    );
                } catch {
                    /* noop */
                }
            }
        }
        window.addEventListener(
            'pendingActions:open',
            onOpenPending as EventListener,
        );
        return () => {
            window.removeEventListener(
                'pendingActions:open',
                onOpenPending as EventListener,
            );
            window.removeEventListener(
                'appointment:statusChanged',
                onCancelFinalizeFlag as EventListener,
            );
        };
    }, []);

    // Failsafe: se algum modal PendingActions disparar forceClose, alinhe o estado local
    useEffect(() => {
        const onForceClose = () => {
            setPendingActionsOpen(false);
            lastPendingCloseRef.current = Date.now();
        };
        window.addEventListener('pendingActions:forceClose', onForceClose);
        return () =>
            window.removeEventListener(
                'pendingActions:forceClose',
                onForceClose,
            );
    }, []);
    // Auto-close if an override terminal status appears for the currently open pending appointment
    useEffect(() => {
        if (!pendingActionsOpen || !pendingAppt) return;
        try {
            const ov = getAppointmentOverride(pendingAppt.id as number);
            if (ov && (ov.status === 'done' || ov.status === 'canceled')) {
                setPendingActionsOpen(false);
            }
        } catch {
            /* noop */
        }
    }, [pendingActionsOpen, pendingAppt]);

    // Debug instrumentation: expose helper functions to window for diagnosing stuck PendingActionsModal
    useEffect(() => {
        const w = window as unknown as Record<string, unknown>;
        w.__closePendingActions = () => {
            try {
                setPendingActionsOpen(false);
                console.debug('[PendingDebug] __closePendingActions called');
            } catch (e) {
                console.warn('[PendingDebug] close error', e);
            }
        };
        w.__dumpPendingActions = () => {
            try {
                const id = pendingAppt?.id;
                const ov = id ? getAppointmentOverride(id) : undefined;
                console.debug('[PendingDebug] dump', {
                    pendingActionsOpen,
                    apptId: id,
                    apptStatus: pendingAppt?.status,
                    override: ov,
                });
                return {
                    pendingActionsOpen,
                    id,
                    status: pendingAppt?.status,
                    override: ov,
                };
            } catch (e) {
                console.warn('[PendingDebug] dump error', e);
                return null;
            }
        };
        const onDebugDump = () => {
            (w.__dumpPendingActions as () => unknown)();
        };
        window.addEventListener('pendingActions:debugDump', onDebugDump);
        return () => {
            try {
                delete w.__closePendingActions;
                delete w.__dumpPendingActions;
            } catch {
                /* noop */
            }
            window.removeEventListener('pendingActions:debugDump', onDebugDump);
        };
    }, [pendingActionsOpen, pendingAppt]);

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

    const openMonthly = async (clientId: number, date?: Date) => {
        // Evita abrir sem cliente válido
        if (!clientId || clientId <= 0) {
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: {
                            text: 'Selecione um cliente para abrir a Agenda Mensal.',
                            type: 'info',
                            autoCloseMs: 6000,
                        },
                    }),
                );
            } catch {
                /* noop */
            }
            return;
        }
        const c = await ensureClientBasic(clientId);
        setRouteClient(c);
        setRouteInitialMonth(date);
        setRouteEditAppt(null);
        setMonthlyOpen(true);
        setWeeklyOpen(false);
    };

    const openWeekly = (_date?: Date) => {
        void _date;
        // WeeklyAgendaModal atual não usa data; reservado para evolução
        setRouteEditAppt(null);
        try {
            console.debug('[Home] Opening WeeklyAgendaModal');
        } catch {
            /* noop */
        }
        setWeeklyOpen(true);
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

    // Event bridge: abrir edição direta do QuickSchedule a partir do Monthly
    useEffect(() => {
        function onOpenScheduleEdit(e: CustomEvent) {
            const det = (e && (e as CustomEvent).detail) || {};
            const c = det.client as ClientBasic | undefined;
            const a = det.appointment as Appointment | undefined;
            if (!c || !c.id) return;
            setRouteClient(c);
            setRouteEditAppt(a ?? null);
            setQuickOpen(true);
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

    // Safeguard: if any previous modal left the page locked, ensure unlock on mount
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
                        onClose={() => {
                            setPendingActionsOpen(false);
                        }}
                    />
                )}
                {/* Reminder: push notification click focuses the ClientCard directly (no modal) */}
            </div>
        </>
    );
}
