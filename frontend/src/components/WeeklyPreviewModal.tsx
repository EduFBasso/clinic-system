import React from 'react';
import StickyModalHeader from './shared/StickyModalHeader';
import { useStickyHeaderHeight } from '../hooks/useStickyHeaderHeight';
import AppModal from './Modal';
import { track } from '../utils/telemetry';
import FloatingDatePicker from './FloatingDatePicker';
import AppointmentCard from './shared/AppointmentCard';
import { deriveStatus } from '../utils/appointments/status';
import AppointmentDetailsModal from './AppointmentDetailsModal';
import {
    useAppointmentsRange,
    type Appointment,
} from '../hooks/useAppointments';
import { openPendingActionsForAppointment } from '../utils/appointments/openPendingActions';
import { cancelAppointment } from '../services/appointments';
import { dispatchers } from '../events/dispatchers';
import { useAgendaFinalizeAction } from '../hooks/useAgendaFinalizeAction';

                                                    openPendingActionsForAppointment(appt);
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
    // Forçar refetch ao abrir (pode ter perdido evento de mudança antes de abrir)
    const prevOpenRef = React.useRef(open);
    React.useEffect(() => {
        if (!prevOpenRef.current && open) {
            const t = setTimeout(() => setReloadKey(x => x + 1), 80);
            return () => clearTimeout(t);
        }
        prevOpenRef.current = open;
    }, [open]);

    // Debug opcional
    React.useEffect(() => {
        if (!open) return;
        if (localStorage.getItem('debugAppointments') === '1') {
            try {
                console.debug('[WeeklyPreviewModal][debug] window', {
                    weekStart: weekStart.toISOString(),
                    weekEnd: weekEnd.toISOString(),
                    count: items.length,
                    loading,
                    reloadKey,
                });
            } catch {
                /* noop */
            }
        }
    }, [open, items, loading, reloadKey, weekStart, weekEnd]);

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
    // Altura do header sticky reutilizando hook
    const { ref: headerRef, height: headerHeight } = useStickyHeaderHeight();
    const scrollMarginTopPx = headerHeight + 6;
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
    }, [selectedDayISO, headerRef]);

    const [detailsOpen, setDetailsOpen] = React.useState(false);
    const [detailsAppt, setDetailsAppt] = React.useState<Appointment | null>(
        null,
    );
    // Pending actions modal state
    // PendingActions é global — nenhum estado local necessário

    // PendingActions é global — nenhum alinhamento local necessário

    const weekLabel = React.useMemo(() => {
        const first = days[0];
        const last = days[6];
        const sameMonth = first.getMonth() === last.getMonth();
        const monthShort = (d: Date) =>
            d.toLocaleDateString('pt-BR', { month: 'short' }); // mantém ponto (set., out.)
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
                <StickyModalHeader
                    ref={headerRef as React.Ref<HTMLDivElement>}
                    title={weekLabel}
                    onClose={onClose}
                    style={{ borderBottom: 'none' }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                        }}
                    >
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
                                    border: 'none',
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
                                    border: 'none',
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
                    </div>
                    {/* Weekday selector strip */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                            gap: 6,
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
                                .toLocaleDateString('pt-BR', { day: '2-digit' })
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

                {/* Columns scroller */}
                <div
                    ref={scrollerRef}
                    style={{
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        display: 'flex',
                        gap: 16,
                        // Create a small spacing below the sticky header area
                        paddingTop: 6,
                        paddingBottom: 4,
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
                                    width: 240,
                                    maxWidth: 260,
                                    border: 'none',
                                    borderRadius: 0,
                                    background: 'transparent',
                                    padding: 0,
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
                                                    try {
                                                        openPendingActionsForAppointment(a);
                                                                    (c as Record<
                                                                        string,
                                                                        unknown
                                                                    >)
                                                            ) {
                                                                const n = (
                                                                    c as {
                                                                        name?: unknown;
                                                                    }
                                                                ).name;
                                                                if (
                                                                    typeof n ===
                                                                    'string'
                                                                )
                                                                    return n;
                                                            }
                                                            return undefined;
                                                        })();
                                                        const clientField =
                                                            ((): unknown => {
                                                                const c =
                                                                    anyAppt.client as unknown;
                                                                if (
                                                                    typeof c ===
                                                                        'number' ||
                                                                    typeof c ===
                                                                        'object'
                                                                )
                                                                    return c;
                                                                return undefined;
                                                            })();
                                                        openPendingActionsForAppointment(a);
                                                    } catch {
                                                        /* noop */
                                                    }
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
                                                onCancel={
                                                    deriveStatus(
                                                        a,
                                                        new Date(),
                                                    ) === 'scheduled' ||
                                                    deriveStatus(
                                                        a,
                                                        new Date(),
                                                    ) === 'ongoing'
                                                        ? handleCancel
                                                        : undefined
                                                }
                                                onFinalize={
                                                    deriveStatus(
                                                        a,
                                                        new Date(),
                                                    ) === 'ongoing'
                                                        ? handleFinalize
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
                {/* PendingActionsModal é global (Home) */}

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
