import React from 'react';
import { useStickyHeaderHeight } from '../hooks/useStickyHeaderHeight';
import AppModal from './Modal';
import StickyModalHeader from './shared/StickyModalHeader';
import AgendaMonthlyGrid from './AgendaMonthlyGrid';
import FloatingDatePicker from './FloatingDatePicker';
import DateControlsHeader from './shared/DateControlsHeader';
// AppointmentCard replaced by ClientCardRow for consistency with Daily agenda
import ClientCardRow from './shared/ClientCardRow';
import { deriveStatus } from '../utils/appointments/status';
import {
    useAppointmentsRange,
    type Appointment,
} from '../hooks/useAppointments';
import { useAppointmentDetailsModal } from '../hooks/useAppointmentDetailsModal';
import { useNowTick } from '../hooks/useNowTick';
import { openPendingActionsForAppointment } from '../utils/appointments/openPendingActions';
import { cancelAppointment } from '../services/appointments';
import { dispatchers } from '../events/dispatchers';
import { useAgendaFinalizeAction } from '../hooks/useAgendaFinalizeAction';
import type { PendingReturnContext } from '../types/agendaFlow';
 
function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function addDays(d: Date, n: number) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}
function startOfWeekMonday(d: Date) {
    // Normalize to local Monday as week start
    const x = startOfDay(d);
    const day = x.getDay(); // 0..6 (Sun..Sat)
    const diff = (day + 6) % 7; // days since Monday
    x.setDate(x.getDate() - diff);
    return x;
}

function toISODate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function groupByDay(items: Appointment[]) {
    const map: Record<string, Appointment[]> = {};
    items.forEach(a => {
        const k = toISODate(new Date(a.start_at));
        if (!map[k]) map[k] = [];
        map[k].push(a);
    });
    Object.values(map).forEach(list =>
        list.sort(
            (a, b) =>
                new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
        ),
    );
    return map;
}

// Internal component — only mounted in the mobile branch, so all hooks only run on mobile
function WeeklyAgendaContent({
    open,
    onClose,
    initialDate,
}: {
    open: boolean;
    onClose: () => void;
    initialDate?: Date;
}) {
    // Helper: find the nearest vertical scrollable parent (modal content Box)
    function getScrollParent(node: HTMLElement | null): HTMLElement | null {
        if (!node) return null;
        let el: HTMLElement | null = node?.parentElement ?? null;
        while (el) {
            try {
                const style = window.getComputedStyle(el);
                if (/auto|scroll/i.test(style.overflowY)) return el;
            } catch {
                /* noop */
            }
            el = el.parentElement;
        }
        return null;
    }
    const [anchorDate, setAnchorDate] = React.useState<Date>(() =>
        initialDate ? startOfDay(initialDate) : startOfDay(new Date()),
    );
    const weekStart = React.useMemo(
        () => startOfWeekMonday(anchorDate),
        [anchorDate],
    );
    const buildReturnContext = React.useCallback(
        (): PendingReturnContext => ({
            kind: 'weekly-agenda',
            dateISO: toISODate(anchorDate),
        }),
        [anchorDate],
    );
    const weekEnd = React.useMemo(() => addDays(weekStart, 7), [weekStart]);
    const [reloadKey, setReloadKey] = React.useState(0);
    React.useEffect(() => {
        const onChanged = () => setReloadKey(x => x + 1);
        window.addEventListener('appointments:changed', onChanged);
        return () =>
            window.removeEventListener('appointments:changed', onChanged);
    }, []);
    const { items, loading, error } = useAppointmentsRange(
        weekStart,
        weekEnd,
        undefined,
        reloadKey,
    );
    const effectiveNowRef = useNowTick(30_000);
    const { handleFinalize } = useAgendaFinalizeAction(() => {
        setReloadKey(x => x + 1);
    });
    const handleCancel = React.useCallback(async (appt: Appointment) => {
        const res = await cancelAppointment(appt.id);
        if (!res.ok) {
            const msg = res.text || 'Erro ao cancelar';
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: { text: msg, type: 'warning' },
                    }),
                );
            } catch {
                /* noop */
            }
            return;
        }
        setReloadKey(x => x + 1);
        try {
            dispatchers.updateClients();
            dispatchers.appointmentsChanged();
        } catch {
            /* noop */
        }
    }, []);

    // Dev diagnostics to trace open/range/fetch lifecycle
    React.useEffect(() => {
        try {
            console.debug('[WeeklyAgenda] range:', {
                weekStart: weekStart.toISOString(),
                weekEnd: weekEnd.toISOString(),
            });
        } catch {
            /* noop */
        }
    }, [weekStart, weekEnd]);
    React.useEffect(() => {
        try {
            console.debug(
                '[WeeklyAgenda] items:',
                items.length,
                'loading:',
                loading,
                'error:',
                error || null,
            );
        } catch {
            /* noop */
        }
    }, [items, loading, error]);

    // Selected day (for highlight/filtering UI)
    const [selectedDayISO, setSelectedDayISO] = React.useState<string>(() =>
        toISODate(anchorDate),
    );
    // Track whether selection came from user (click/controls) or auto (observer)
    const selectionSrcRef = React.useRef<'user' | 'auto'>('user');
    // Cooldown to avoid auto-selection overriding a fresh user choice (Hoje/click)
    const lastUserSelectAtRef = React.useRef<number>(Date.now());
    const setSelected = React.useCallback(
        (iso: string, src: 'user' | 'auto' = 'user') => {
            selectionSrcRef.current = src;
            if (src === 'user') {
                lastUserSelectAtRef.current = Date.now();
            }
            setSelectedDayISO(iso);
        },
        [],
    );
    React.useEffect(() => {
        // If anchorDate moves to another week, reset selected to new Monday (user-driven)
        setSelected(toISODate(anchorDate), 'user');
    }, [anchorDate, setSelected]);

    const days: Date[] = React.useMemo(
        () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
        [weekStart],
    );

    const grouped = React.useMemo(() => groupByDay(items), [items]);

    // Floating date picker
    const [showPicker, setShowPicker] = React.useState(false);
    const [pickerPos, setPickerPos] = React.useState<
        { x: number; y: number } | undefined
    >(undefined);
    const openDatePicker = React.useCallback(
        (ev?: React.MouseEvent | React.PointerEvent | React.TouchEvent) => {
            let px = 24;
            let py = 120;
            try {
                const native = (ev as any)?.nativeEvent ?? ev; // eslint-disable-line @typescript-eslint/no-explicit-any
                if (native) {
                    if (typeof native.clientX === 'number') {
                        px = native.clientX;
                        py = native.clientY;
                    } else if (native.touches && native.touches[0]) {
                        px = native.touches[0].clientX;
                        py = native.touches[0].clientY;
                    }
                }
            } catch {
                /* noop */
            }
            setPickerPos({ x: px, y: py });
            setShowPicker(true);
        },
        [],
    );

    // Scroll to selected column when it changes
    const scrollerRef = React.useRef<HTMLDivElement | null>(null);
    const colRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
    // Altura do header sticky via hook reutilizável
    const { ref: headerRef, height: headerHeight } = useStickyHeaderHeight();
    const scrollMarginTopPx = headerHeight + 6;
    const scrollSelectedIntoView = React.useCallback(() => {
        const el = colRefs.current[selectedDayISO];
        if (!el) return;
        // Only auto-scroll when selection came from explicit user action.
        // We want to adjust ONLY the horizontal position and avoid vertical jumps under the sticky header.
        if (selectionSrcRef.current === 'user') {
            // Preserve current vertical scroll position of the modal content container
            const parent = getScrollParent(scrollerRef.current);
            const prevTop = parent ? parent.scrollTop : null;
            try {
                // Use scrollIntoView for horizontal centering, then restore vertical scrollTop
                el.scrollIntoView({ block: 'nearest', inline: 'center' });
            } catch {
                /* noop */
            } finally {
                if (parent != null && prevTop != null) {
                    parent.scrollTop = prevTop;
                }
            }
        }
    }, [selectedDayISO]);

    // Scroll when selected day changes
    React.useEffect(() => {
        scrollSelectedIntoView();
    }, [selectedDayISO, scrollSelectedIntoView]);

    // Also scroll on open, to align the visible column with the initially selected day
    React.useEffect(() => {
        if (!open) return;
        // Defer to allow refs/layout to settle
        const id = window.setTimeout(() => {
            scrollSelectedIntoView();
        }, 0);
        return () => window.clearTimeout(id);
    }, [open, scrollSelectedIntoView]);

    // Auto-select the day whose column is at least 70% visible within the horizontal scroller
    React.useEffect(() => {
        const root = scrollerRef.current;
        if (!root) return;
        const observer = new IntersectionObserver(
            entries => {
                let bestIso: string | null = null;
                let bestRatio = 0;
                for (const entry of entries) {
                    const iso = (entry.target as HTMLElement).dataset.iso;
                    const ratio = entry.intersectionRatio || 0;
                    if (iso && ratio >= 0.7 && ratio > bestRatio) {
                        bestIso = iso;
                        bestRatio = ratio;
                    }
                }
                if (bestIso && bestIso !== selectedDayISO) {
                    setSelected(bestIso, 'auto');
                }
            },
            { root, threshold: [0, 0.25, 0.5, 0.7, 0.75, 1] },
        );
        const suppressMs = 600; // grace period after user actions/open
        // Respect cooldown after user-driven selection or modal open
        if (Date.now() - lastUserSelectAtRef.current < suppressMs) {
            return;
        }
        // Observe each existing column element
        const toObserve: HTMLElement[] = [];
        Object.entries(colRefs.current).forEach(([iso, el]) => {
            if (el) {
                el.dataset.iso = iso;
                observer.observe(el);
                toObserve.push(el);
            }
        });
        return () => {
            try {
                toObserve.forEach(el => observer.unobserve(el));
                observer.disconnect();
            } catch {
                /* noop */
            }
        };
    }, [selectedDayISO, setSelected]);

    // On open, briefly suppress auto-selection to avoid overriding the initial selection
    React.useEffect(() => {
        if (open) {
            lastUserSelectAtRef.current = Date.now();
        }
    }, [open]);

    const { detailsModal, openDetails } =
        useAppointmentDetailsModal<Appointment>();
    // PendingActions é global — nenhum estado local necessário

    const headerTitle = 'Agenda';
    const weekRangeLabel = React.useMemo(() => {
        const first = days[0];
        const last = days[6];
        if (!first || !last) return '';
        const sameMonth = first.getMonth() === last.getMonth();
        const monthShort = (d: Date) =>
            d.toLocaleDateString('pt-BR', { month: 'short' });
        const d2 = (d: Date) =>
            d.toLocaleDateString('pt-BR', { day: '2-digit' });
        return sameMonth
            ? `${d2(first)} ${monthShort(first)} - ${d2(last)} ${monthShort(
                  first,
              )}`
            : `${d2(first)} ${monthShort(first)} - ${d2(last)} ${monthShort(
                  last,
              )}`;
    }, [days]);

    return (
        <div style={{ display: 'grid', gap: 16, height: '100%' }}>
            <StickyModalHeader
                ref={headerRef as React.Ref<HTMLDivElement>}
                title={headerTitle}
                onClose={onClose}
                style={{ borderBottom: 'none' }}
            >
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <DateControlsHeader
                        currentDate={anchorDate}
                        label={weekRangeLabel}
                        onPrev={() => setAnchorDate(addDays(weekStart, -7))}
                        onNext={() => setAnchorDate(addDays(weekStart, 7))}
                        onToday={() => {
                            const today = startOfDay(new Date());
                            setSelected(toISODate(today), 'user');
                            setAnchorDate(today);
                        }}
                        onOpenPicker={openDatePicker}
                    />
                </div>
                {/* Weekday selector strip agora dentro do header para ficar fixo */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                        gap: 6,
                        paddingTop: 4,
                    }}
                >
                    {days.map(d => {
                        const iso = toISODate(d);
                        const selected = iso === selectedDayISO;
                        const weekday = d
                            .toLocaleDateString('pt-BR', {
                                weekday: 'short',
                            })
                            .replace('.', '');
                        const dayNum = d
                            .toLocaleDateString('pt-BR', {
                                day: '2-digit',
                            })
                            .replace('.', '');
                        return (
                            <button
                                key={iso}
                                onClick={() => setSelected(iso, 'user')}
                                style={{
                                    padding: '8px 6px',
                                    border: 'none',
                                    borderRadius: 0,
                                    background: 'transparent',
                                    color: 'var(--color-text)',
                                    fontWeight: 600,
                                    textTransform: 'capitalize',
                                }}
                                aria-pressed={selected}
                            >
                                <div
                                    style={{
                                        display: 'grid',
                                        justifyItems: 'center',
                                        gap: 2,
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: '0.8rem',
                                            color: 'var(--color-disabled)',
                                        }}
                                    >
                                        {weekday}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: '1rem',
                                            fontWeight: 800,
                                            paddingBottom: 2,
                                            borderBottom: selected
                                                ? '3px solid var(--color-heading)'
                                                : '3px solid transparent',
                                            minWidth: 20,
                                            textAlign: 'center',
                                        }}
                                    >
                                        {dayNum}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </StickyModalHeader>

            {/* Error state (surface hook error to user) */}
            {error && (
                <div
                    role='alert'
                    style={{
                        background: '#fde8e8',
                        border: '1px solid #f5c2c2',
                        color: '#7f1d1d',
                        borderRadius: 8,
                        padding: '8px 10px',
                        fontSize: 13,
                    }}
                >
                    Falha ao carregar a agenda semanal. {String(error)}
                </div>
            )}

            {/* Columns scroller */}
            <div
                ref={scrollerRef}
                style={{
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    display: 'flex',
                    gap: 16,
                    paddingBottom: 4,
                    // Avoid content under the close X (Modal already reserves some right padding)
                    minHeight: 0,
                }}
            >
                {days.map(d => {
                    const iso = toISODate(d);
                    const list = grouped[iso] || [];
                    return (
                        <div
                            key={iso}
                            ref={el => {
                                colRefs.current[iso] = el;
                            }}
                            style={{
                                flex: '0 0 auto',
                                width: 320,
                                maxWidth: 340,
                                border: 'none',
                                borderRadius: 0,
                                background: 'transparent',
                                padding: 0,
                                scrollMarginTop: scrollMarginTopPx,
                            }}
                        >
                            <div
                                style={{
                                    fontWeight: 700,
                                    color: 'var(--color-heading)',
                                    marginBottom: 6,
                                    textTransform: 'capitalize',
                                }}
                            >
                                {d
                                    .toLocaleDateString('pt-BR', {
                                        weekday: 'short',
                                        day: '2-digit',
                                        month: '2-digit',
                                    })
                                    .replace('.', '')}
                            </div>
                            {loading ? (
                                <div>Carregando…</div>
                            ) : list.length === 0 ? (
                                <div
                                    style={{
                                        color: 'var(--color-disabled)',
                                    }}
                                >
                                    Sem compromissos
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: 8 }}>
                                    {list.map(a => {
                                        const derivedStatus = deriveStatus(
                                            a,
                                            effectiveNowRef,
                                        );
                                        return (
                                        <div key={a.id}>
                                            <ClientCardRow<Appointment>
                                                appt={a as Appointment}
                                                timeSize='sm'
                                                cardContainerStyle={{
                                                    // Allow full column width for better name readability
                                                    maxWidth: '100%',
                                                    width: '100%',
                                                }}
                                                showEditAction={false}
                                                onClick={() =>
                                                    setSelected(iso, 'user')
                                                }
                                                onResolvePending={appt => {
                                                    openPendingActionsForAppointment(
                                                        appt,
                                                        buildReturnContext(),
                                                    );
                                                }}
                                                finalizeRequestContext={buildReturnContext()}
                                                onDetails={
                                                    a.status === 'done'
                                                        ? appt =>
                                                              openDetails(
                                                                  appt as Appointment,
                                                              )
                                                        : undefined
                                                }
                                                onCancel={
                                                        derivedStatus === 'scheduled' ||
                                                        derivedStatus === 'ongoing'
                                                        ? handleCancel
                                                        : undefined
                                                }
                                                onFinalize={
                                                        derivedStatus === 'ongoing'
                                                        ? handleFinalize
                                                        : undefined
                                                }
                                            />
                                        </div>
                                    )})}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* FloatingDatePicker */}
            <FloatingDatePicker
                open={showPicker}
                onClose={() => setShowPicker(false)}
                selectedDate={anchorDate}
                onChange={d => {
                    const day = startOfDay(d);
                    setAnchorDate(day);
                    setShowPicker(false);
                }}
                initialPosition={pickerPos}
            />

            {detailsModal}
            {/* PendingActionsModal é global (Home) */}
        </div>
    );
}

export default function WeeklyAgendaModal({
    open,
    onClose,
    initialDate,
}: {
    open: boolean;
    onClose: () => void;
    initialDate?: Date;
}) {
    const [isDesktop, setIsDesktop] = React.useState(
        () => window.matchMedia('(min-width: 768px)').matches,
    );
    React.useEffect(() => {
        const mq = window.matchMedia('(min-width: 768px)');
        const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return (
        <AppModal
            open={open}
            onClose={onClose}
            fullScreen
            actionsBarStyle={{
                background: 'transparent',
                boxShadow: 'none',
                borderBottom: 'none',
            }}
            showCloseButton={false}
        >
            {isDesktop ? (
                <>
                    <StickyModalHeader
                        title='Agenda'
                        onClose={onClose}
                        style={{ borderBottom: 'none' }}
                    />
                    <AgendaMonthlyGrid />
                </>
            ) : (
                <WeeklyAgendaContent
                    open={open}
                    onClose={onClose}
                    initialDate={initialDate}
                />
            )}
        </AppModal>
    );
}
