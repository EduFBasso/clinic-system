import React from 'react';
import AppModal from './Modal';
import FloatingDatePicker from './FloatingDatePicker';
import AppointmentCard from './shared/AppointmentCard';

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function startOfWeekMonday(d: Date) { const x = startOfDay(d); const day = x.getDay(); const diff=(day+6)%7; x.setDate(x.getDate()-diff); return x; }
function toISODate(d: Date) { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }

type FakeAppt = {
  id: number;
  title?: string;
  start_at: string;
  end_at: string;
  status: 'scheduled' | 'done' | 'canceled';
  client_name?: string;
  notes?: string;
};

// Visual-first: generate a few sample items to render the UI while wiring comes later
function makeSample(day: Date): FakeAppt[] {
  const base = startOfDay(day).getTime();
  const mk = (h: number, m: number, durMin: number, id: number, status: FakeAppt['status']): FakeAppt => {
    const s = new Date(base + (h*60+m)*60*1000);
    const e = new Date(s.getTime() + durMin*60*1000);
    return { id, title: 'Consulta', start_at: s.toISOString(), end_at: e.toISOString(), status, client_name: `Cliente ${id}` };
  };
  return [mk(8,0,60,1,'scheduled'), mk(10,0,60,2,'scheduled'), mk(14,30,45,3,'done')];
}

export default function WeeklyAgendaModal({ open, onClose, initialDate }: { open: boolean; onClose: () => void; initialDate?: Date; }) {
  const [anchorDate, setAnchorDate] = React.useState<Date>(() => initialDate ? startOfDay(initialDate) : startOfDay(new Date()));
  const weekStart = React.useMemo(() => startOfWeekMonday(anchorDate), [anchorDate]);
  const days: Date[] = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const [selectedDayISO, setSelectedDayISO] = React.useState<string>(() => toISODate(anchorDate));
  React.useEffect(() => { setSelectedDayISO(toISODate(anchorDate)); }, [anchorDate]);

  // Date picker state
  const [showPicker, setShowPicker] = React.useState(false);

  // Scroll helpers
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const colRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const [scrollMarginTopPx, setScrollMarginTopPx] = React.useState<number>(96);
  React.useLayoutEffect(() => {
    function measure() { const h = headerRef.current?.offsetHeight ?? 0; setScrollMarginTopPx(h + 6); }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  React.useEffect(() => {
    const el = colRefs.current[selectedDayISO];
    if (!el) return;
    try { el.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch { /* noop */ }
  }, [selectedDayISO]);

  const weekLabel = React.useMemo(() => {
    const first = days[0]; const last = days[6];
    const sameMonth = first.getMonth() === last.getMonth();
    const monthName = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'long' });
    const d2 = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit' });
    return sameMonth ? `${d2(first)}–${d2(last)} ${monthName(first)}` : `${d2(first)} ${monthName(first)} – ${d2(last)} ${monthName(last)}`;
  }, [days]);

  return (
    <AppModal open={open} onClose={onClose} fullScreen showCloseButton={false}>
      <div style={{ display: 'grid', gap: 16, height: '100%' }}>
        {/* Sticky header */}
        <div ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 900, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div style={{ display: 'grid', gap: 12, paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 'var(--font-title-lg)', color: 'var(--color-heading)' }}>Agenda semanal</div>
              <button type='button' aria-label='Fechar' onClick={onClose} style={{ width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--color-heading)', fontSize: 26 }}>×</button>
            </div>
          </div>
        </div>

        {/* Header controls (Hoje + calendar, center arrows + label) */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => setAnchorDate(startOfDay(new Date()))} style={{ fontSize: 'var(--font-body)', fontWeight: 700, padding: '4px 10px', border: '1px solid var(--color-success-darker)', background: 'var(--color-success-dark)', borderRadius: 6, cursor: 'pointer', color: 'white' }} aria-label='Ir para hoje'>Hoje</button>
            <button type='button' onClick={() => setShowPicker(true)} title='Abrir calendário' aria-label='Abrir calendário' style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--color-success-dark)', fontSize: 'var(--icon-size-lg)', userSelect: 'none' }}>📆</button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <button aria-label='Semana anterior' onClick={() => setAnchorDate(addDays(weekStart, -7))} style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--color-success-dark)', fontSize: 'var(--icon-size-lg)', userSelect: 'none' }}>◀</button>
            <button type='button' onClick={() => setShowPicker(true)} title='Selecionar data' aria-label='Selecionar data' style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-success-dark)', fontWeight: 800, fontSize: 'var(--font-title-md)', whiteSpace: 'nowrap', userSelect: 'none' }}>{weekLabel}</button>
            <button aria-label='Próxima semana' onClick={() => setAnchorDate(addDays(weekStart, 7))} style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--color-success-dark)', fontSize: 'var(--icon-size-lg)', userSelect: 'none' }}>▶</button>
          </div>
          <div style={{ width: 48 }} />
        </div>

        {/* Weekday selector strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
          {days.map(d => { const iso = toISODate(d); const selected = iso === selectedDayISO; const label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }).replace('.', ''); return (
            <button key={iso} onClick={() => setSelectedDayISO(iso)} style={{ padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 8, background: selected ? 'var(--color-success-bg)' : 'var(--color-bg-section)', color: selected ? 'var(--color-success-dark)' : 'var(--color-text)', fontWeight: selected ? 800 : 600, textTransform: 'capitalize' }} aria-pressed={selected}>{label}</button>
          ); })}
        </div>

        {/* Columns scroller */}
        <div ref={scrollerRef} style={{ overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: 10, paddingBottom: 4, minHeight: 0 }}>
          {days.map(d => { const iso = toISODate(d); const list = makeSample(d); const selected = iso === selectedDayISO; return (
            <div key={iso} ref={el => { colRefs.current[iso] = el; }} style={{ flex: '0 0 auto', width: 240, maxWidth: 260, border: '1px solid var(--color-border)', borderRadius: 10, background: selected ? 'var(--color-bg)' : 'var(--color-bg-section)', padding: 8, scrollMarginTop: scrollMarginTopPx }}>
              <div style={{ fontWeight: 700, color: 'var(--color-heading)', marginBottom: 6, textTransform: 'capitalize' }}>{d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')}</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {list.map(a => (
                  <AppointmentCard key={a.id} appt={a} compact showNotes={false} onClick={() => setSelectedDayISO(iso)} />
                ))}
              </div>
            </div>
          ); })}
        </div>

        {/* FloatingDatePicker */}
        <FloatingDatePicker open={showPicker} onClose={() => setShowPicker(false)} selectedDate={anchorDate} onChange={d => { setAnchorDate(startOfDay(d)); setShowPicker(false); }} />
      </div>
    </AppModal>
  );
}
