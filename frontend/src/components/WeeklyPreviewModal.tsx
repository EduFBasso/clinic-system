import React from 'react';
import AppModal from './Modal';
import { track } from '../utils/telemetry';
import FloatingDatePicker from './FloatingDatePicker';
import AppointmentCard from './shared/AppointmentCard';
import PendingActionsModal from './PendingActionsModal';
import AppointmentDetailsModal from './AppointmentDetailsModal';
import {
    useAppointmentsRange,
    type Appointment,
} from '../hooks/useAppointments';

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
    const x = startOfDay(d);
    const day = x.getDay();
    const diff = (day + 6) % 7; // Mon-based offset
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

export default function WeeklyPreviewModal({
    open,
    onClose,
    initialDate,
}: {
    open: boolean;
    onClose: () => void;
    initialDate?: Date;
}) {
    // Find the nearest vertical scroll container (the modal content Box)
    function getScrollParent(node: HTMLElement | null): HTMLElement | null {
        if (!node) return null;
        let el: HTMLElement | null = node.parentElement;
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
    const weekEnd = React.useMemo(() => addDays(weekStart, 7), [weekStart]);
    const [reloadKey, setReloadKey] = React.useState(0);
    const { items, loading } = useAppointmentsRange(
        weekStart,
        weekEnd,
        undefined,
        reloadKey,
    );

    const [selectedDayISO, setSelectedDayISO] = React.useState<string>(() =>
        toISODate(anchorDate),
    );
    // Telemetry: modal lifecycle
    React.useEffect(() => {
        if (open)
            track({
                type: 'modal_opened',
                payload: { name: 'WeeklyPreviewModal' },
            });
        return () => {
            if (open)
                track({
                    type: 'modal_closed',
                    payload: { name: 'WeeklyPreviewModal' },
                });
        };
    }, [open]);
    React.useEffect(() => {
        setSelectedDayISO(toISODate(anchorDate));
    }, [anchorDate]);

    const days: Date[] = React.useMemo(
        () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
        [weekStart],
    );

    const grouped = React.useMemo(() => groupByDay(items), [items]);

    // Recarrega ao receber mudanças globais de compromissos
    React.useEffect(() => {
        if (!open) return;
        const onChanged = () => setReloadKey(x => x + 1);
        window.addEventListener('appointments:changed', onChanged);
        return () =>
            window.removeEventListener('appointments:changed', onChanged);
    }, [open]);

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

    const scrollerRef = React.useRef<HTMLDivElement | null>(null);
    const colRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
    const headerRef = React.useRef<HTMLDivElement | null>(null);
    const [scrollMarginTopPx, setScrollMarginTopPx] =
        React.useState<number>(128);
    // Measure sticky header height and compute a scroll margin so selected columns aren't hidden under the header/X bar
    React.useLayoutEffect(() => {
        function measure() {
            const h = headerRef.current?.offsetHeight ?? 0;
            // small buffer to avoid visual clash
            setScrollMarginTopPx(h + 6);
        }
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);
    React.useEffect(() => {
        const el = colRefs.current[selectedDayISO];
        if (!el) return;
        try {
            // Horizontal centering without changing vertical scroll
            el.scrollIntoView({ block: 'nearest', inline: 'center' });
        } catch {
            /* noop */
        }
        // Ensure vertical visibility below sticky bars (ModalActionsBar + weekly header)
        try {
            const parent = getScrollParent(scrollerRef.current);
            if (!parent) return;
            const buffer = 6;
            const headerBottom = headerRef.current
                ? headerRef.current.getBoundingClientRect().bottom
                : 0;
            const parentRect = parent.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            // If element top is hidden under header, scroll it down
            if (elRect.top < headerBottom + buffer) {
                parent.scrollTop += elRect.top - (headerBottom + buffer);
            } else if (elRect.bottom > parentRect.bottom - buffer) {
                // If element bottom is below viewport, scroll up to reveal bottom
                parent.scrollTop +=
                    elRect.bottom - (parentRect.bottom - buffer);
            }
        } catch {
            /* noop */
        }
    }, [selectedDayISO]);

    const [detailsOpen, setDetailsOpen] = React.useState(false);
    const [detailsAppt, setDetailsAppt] = React.useState<Appointment | null>(
        null,
    );
    // Pending actions modal state
    const [pendingOpen, setPendingOpen] = React.useState(false);
    const [pendingAppt, setPendingAppt] = React.useState<Appointment | null>(
        null,
    );

    const weekLabel = React.useMemo(() => {
        const first = days[0];
        const last = days[6];
        const sameMonth = first.getMonth() === last.getMonth();
        const monthName = (d: Date) =>
            d.toLocaleDateString('pt-BR', { month: 'long' });
        const d2 = (d: Date) =>
            d.toLocaleDateString('pt-BR', { day: '2-digit' });
        return sameMonth
            ? `${d2(first)}–${d2(last)} ${monthName(first)}`
            : `${d2(first)} ${monthName(first)} – ${d2(last)} ${monthName(
                  last,
              )}`;
    }, [days]);

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
            disableTopSafePadding
        >
            <div style={{ display: 'grid', gap: 16, height: '100%' }}>
                {/* Sticky header: title + controls + weekday strip */}
                <div
                    ref={headerRef}
                    style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 900,
                        background: 'var(--color-bg)',
                        borderBottom: '1px solid var(--color-border)',
                        paddingTop: 'env(safe-area-inset-top, 0px)',
                    }}
                >
                    <div style={{ display: 'grid', gap: 12, paddingBottom: 8 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                minWidth: 0,
                            }}
                        >
                            <div
                                style={{
                                    fontWeight: 800,
                                    fontSize: 'var(--font-title-lg)',
                                    color: 'var(--color-heading)',
                                }}
                            >
                                Agenda semanal
                            </div>
                            <button
                                type='button'
                                aria-label='Fechar'
                                onClick={onClose}
                                style={{
                                    width: 44,
                                    height: 44,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    color: 'var(--color-heading)',
                                    fontSize: 26,
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Header controls (Hoje + calendar, center arrows + week label) */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 16,
                                }}
                            >
                                <button
                                    onClick={() =>
                                        setAnchorDate(startOfDay(new Date()))
                                    }
                                    style={{
                                        fontSize: 'var(--font-body)',
                                        fontWeight: 700,
                                        padding: '4px 10px',
                                        border: '1px solid var(--color-success-darker)',
                                        background: 'var(--color-success-dark)',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        color: 'white',
                                    }}
                                    aria-label='Ir para hoje'
                                >
                                    Hoje
                                </button>
                                <button
                                    type='button'
                                    onClick={openDatePicker}
                                    title='Abrir calendário'
                                    aria-label='Abrir calendário'
                                    style={{
                                        width: 32,
                                        height: 32,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'none',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        color: 'var(--color-success-dark)',
                                        fontSize: 'var(--icon-size-lg)',
                                        userSelect: 'none',
                                    }}
                                >
                                    📆
                                </button>
                            </div>
                            <div
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                }}
                            >
                                <button
                                    aria-label='Semana anterior'
                                    onClick={() =>
                                        setAnchorDate(addDays(weekStart, -7))
                                    }
                                    style={{
                                        width: 30,
                                        height: 30,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        color: 'var(--color-success-dark)',
                                        fontSize: 'var(--icon-size-lg)',
                                        userSelect: 'none',
                                    }}
                                >
                                    ◀
                                </button>
                                <button
                                    type='button'
                                    onClick={openDatePicker}
                                    title='Selecionar data'
                                    aria-label='Selecionar data'
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--color-success-dark)',
                                        fontWeight: 800,
                                        fontSize: 'var(--font-title-md)',
                                        whiteSpace: 'nowrap',
                                        userSelect: 'none',
                                    }}
                                >
                                    {weekLabel}
                                </button>
                                <button
                                    aria-label='Próxima semana'
                                    onClick={() =>
                                        setAnchorDate(addDays(weekStart, 7))
                                    }
                                    style={{
                                        width: 30,
                                        height: 30,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        color: 'var(--color-success-dark)',
                                        fontSize: 'var(--icon-size-lg)',
                                        userSelect: 'none',
                                    }}
                                >
                                    ▶
                                </button>
                            </div>
                            <div style={{ width: 48 }} />
                        </div>

                        {/* Weekday selector strip */}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns:
                                    'repeat(7, minmax(0, 1fr))',
                                gap: 6,
                            }}
                        >
                            {days.map(d => {
                                const iso = toISODate(d);
                                const selected = iso === selectedDayISO;
                                const label = d
                                    .toLocaleDateString('pt-BR', {
                                        weekday: 'short',
                                        day: '2-digit',
                                    })
                                    .replace('.', '');
                                return (
                                    <button
                                        key={iso}
                                        onClick={() => {
                                            setSelectedDayISO(iso);
                                            track({
                                                type: 'weekly_day_selected',
                                                payload: { iso },
                                            });
                                        }}
                                        style={{
                                            padding: '6px 8px',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 8,
                                            background: selected
                                                ? 'var(--color-success-bg)'
                                                : 'var(--color-bg-section)',
                                            color: selected
                                                ? 'var(--color-success-dark)'
                                                : 'var(--color-text)',
                                            fontWeight: selected ? 800 : 600,
                                            textTransform: 'capitalize',
                                        }}
                                        aria-pressed={selected}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Columns scroller */}
                <div
                    ref={scrollerRef}
                    style={{
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        display: 'flex',
                        gap: 10,
                        // Create a small spacing below the sticky header area
                        paddingTop: 6,
                        paddingBottom: 4,
                        minHeight: 0,
                    }}
                >
                    {days.map(d => {
                        const iso = toISODate(d);
                        const list = grouped[iso] || [];
                        const selected = iso === selectedDayISO;
                        return (
                            <div
                                key={iso}
                                ref={el => {
                                    colRefs.current[iso] = el;
                                }}
                                style={{
                                    flex: '0 0 auto',
                                    width: 240,
                                    maxWidth: 260,
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 10,
                                    background: selected
                                        ? 'var(--color-bg)'
                                        : 'var(--color-bg-section)',
                                    padding: 8,
                                    // Ensure scrollIntoView accounts for sticky bars
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
                                        {list.map(a => (
                                            <AppointmentCard<Appointment>
                                                key={a.id}
                                                appt={a as Appointment}
                                                compact
                                                showNotes={false}
                                                onClick={() =>
                                                    setSelectedDayISO(iso)
                                                }
                                                onResolvePending={appt => {
                                                    setDetailsOpen(false);
                                                    setPendingAppt(
                                                        appt as Appointment,
                                                    );
                                                    setPendingOpen(true);
                                                }}
                                                onDetails={
                                                    a.status === 'done'
                                                        ? appt => {
                                                              setDetailsAppt(
                                                                  appt as Appointment,
                                                              );
                                                              setDetailsOpen(
                                                                  true,
                                                              );
                                                          }
                                                        : undefined
                                                }
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

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
                    // Ensure the floating picker stays below sticky bars so its header is fully visible on iPhone
                    minTop={160}
                />
                {pendingOpen && pendingAppt && (
                    <PendingActionsModal
                        open={pendingOpen}
                        onClose={() => {
                            setPendingOpen(false);
                            setPendingAppt(null);
                            setReloadKey(x => x + 1);
                        }}
                        appt={pendingAppt}
                    />
                )}

                {detailsOpen && detailsAppt && (
                    <AppointmentDetailsModal
                        open={detailsOpen}
                        onClose={() => {
                            setDetailsOpen(false);
                            setDetailsAppt(null);
                        }}
                        appt={detailsAppt}
                    />
                )}
            </div>
        </AppModal>
    );
}
