import React from 'react';
import { on } from '../events/bus';
import type {
    OpenAppointmentDetailsPayload,
    OpenDailyAgendaPayload,
} from '../events/bus';
import type { ClientBasic } from '../types/ClientBasic';
import type { Appointment } from '../hooks/useAppointments';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';
import type { PendingReturnContext } from '../types/agendaFlow';

// ---------------------------------------------------------------------------
// Helper: resolve basic client info (cached in localStorage)
// ---------------------------------------------------------------------------
export async function ensureClientBasic(id: number): Promise<ClientBasic> {
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export interface UseAgendaModalsReturn {
    // Monthly
    monthlyOpen: boolean;
    setMonthlyOpen: React.Dispatch<React.SetStateAction<boolean>>;
    routeClient: ClientBasic | undefined;
    setRouteClient: React.Dispatch<
        React.SetStateAction<ClientBasic | undefined>
    >;
    routeInitialMonth: Date | undefined;
    setRouteInitialMonth: React.Dispatch<
        React.SetStateAction<Date | undefined>
    >;
    // Weekly
    weeklyOpen: boolean;
    setWeeklyOpen: React.Dispatch<React.SetStateAction<boolean>>;
    weeklyInitialDate: Date | undefined;
    setWeeklyInitialDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
    // Quick
    quickOpen: boolean;
    setQuickOpen: React.Dispatch<React.SetStateAction<boolean>>;
    routeEditAppt: Appointment | null;
    setRouteEditAppt: React.Dispatch<React.SetStateAction<Appointment | null>>;
    // Daily
    dailyOpen: boolean;
    setDailyOpen: React.Dispatch<React.SetStateAction<boolean>>;
    dailyDate: Date;
    dailyFocusId: number | undefined;
    // Details
    detailsOpen: boolean;
    setDetailsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    detailsAppt: Appointment | null;
    setDetailsAppt: React.Dispatch<React.SetStateAction<Appointment | null>>;
    detailsReturnContext: PendingReturnContext;
    setDetailsReturnContext: React.Dispatch<
        React.SetStateAction<PendingReturnContext>
    >;
    // Openers / helpers
    openMonthly: (clientId: number, date?: Date) => Promise<void>;
    openWeekly: (date?: Date) => void;
    openDaily: (date: Date, focusId?: number) => void;
    clearAgendaRouteFlags: () => void;
}

export function useAgendaModals(): UseAgendaModalsReturn {
    const [monthlyOpen, setMonthlyOpen] = React.useState(false);
    const [weeklyOpen, setWeeklyOpen] = React.useState(false);
    const [weeklyInitialDate, setWeeklyInitialDate] = React.useState<
        Date | undefined
    >(undefined);
    const [quickOpen, setQuickOpen] = React.useState(false);
    const [routeClient, setRouteClient] = React.useState<
        ClientBasic | undefined
    >(undefined);
    const [routeEditAppt, setRouteEditAppt] =
        React.useState<Appointment | null>(null);
    const [dailyOpen, setDailyOpen] = React.useState(false);
    const [dailyDate, setDailyDate] = React.useState<Date>(new Date());
    const [dailyFocusId, setDailyFocusId] = React.useState<number | undefined>(
        undefined,
    );
    const [detailsOpen, setDetailsOpen] = React.useState(false);
    const [detailsAppt, setDetailsAppt] = React.useState<Appointment | null>(
        null,
    );
    const [detailsReturnContext, setDetailsReturnContext] = React.useState<PendingReturnContext>(
        null,
    );
    const [routeInitialMonth, setRouteInitialMonth] = React.useState<
        Date | undefined
    >(undefined);

    // ------------------------------------------------------------------
    // Openers
    // ------------------------------------------------------------------
    const openMonthly = React.useCallback(
        async (clientId: number, date?: Date) => {
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
        },
        [],
    );

    const openWeekly = React.useCallback((_date?: Date) => {
        setWeeklyInitialDate(_date);
        setRouteEditAppt(null);
        try {
            console.debug('[Home] Opening WeeklyAgendaModal');
        } catch {
            /* noop */
        }
        setWeeklyOpen(true);
        setMonthlyOpen(false);
    }, []);

    const openDaily = React.useCallback((date: Date, focusId?: number) => {
        setDailyDate(date);
        setDailyFocusId(focusId);
        setMonthlyOpen(false);
        setWeeklyOpen(false);
        setDailyOpen(true);
    }, []);

    const clearAgendaRouteFlags = React.useCallback(() => {
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
    }, []);

    // ------------------------------------------------------------------
    // Event bridges: openScheduleEdit, openDailyAgenda, openAppointmentDetails
    // ------------------------------------------------------------------
    React.useEffect(() => {
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
            const ext: OpenDailyAgendaPayload = det;
            const dateIso = ext?.date;
            const focusAppointmentId = ext?.focusAppointmentId;
            if (dateIso) {
                const d = new Date(dateIso);
                if (!isNaN(d.getTime())) openDaily(d, focusAppointmentId);
            } else {
                openDaily(new Date(), focusAppointmentId);
            }
        });

        const disposeDetails = on('openAppointmentDetails', det => {
            const payload = det as OpenAppointmentDetailsPayload;
            const appt = payload.appointment;
            if (appt) {
                setDetailsReturnContext(payload.returnContext ?? null);
                setDetailsAppt(appt);
                setDetailsOpen(true);
            }
        });

        const disposeCloseAll = on('agenda:closeAll', () => {
            setDailyOpen(false);
            setMonthlyOpen(false);
            setWeeklyOpen(false);
            setQuickOpen(false);
        });

        return () => {
            window.removeEventListener(
                'openScheduleEdit',
                onOpenScheduleEdit as EventListener,
            );
            disposeDaily();
            disposeDetails();
            disposeCloseAll();
        };
    }, [openDaily]);

    return {
        monthlyOpen,
        setMonthlyOpen,
        routeClient,
        setRouteClient,
        routeInitialMonth,
        setRouteInitialMonth,
        weeklyOpen,
        setWeeklyOpen,
        weeklyInitialDate,
        setWeeklyInitialDate,
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
        openMonthly,
        openWeekly,
        openDaily,
        clearAgendaRouteFlags,
    };
}
