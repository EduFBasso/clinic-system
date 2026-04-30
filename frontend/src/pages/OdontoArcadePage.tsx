import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../utils/apiFetch';
import styles from '../styles/pages/OdontoArcadePage.module.css';

type ArcadeListItem = {
    id: number;
    status: 'pending' | 'completed';
    updated_at?: string;
    pending_procedures?: number;
    completed_procedures?: number;
};

type ToothItem = {
    id: number;
    sequence: number;
    international_number: number;
};

type ProcedureItem = {
    id: number;
    tooth: number | null;
    status: 'pending' | 'completed' | 'canceled';
    name: string;
    code?: string;
    faces_raw?: string | null;
    patient_amount?: number | string | null;
    paid_amount?: number | string | null;
    paid_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    notes?: string;
    is_active: boolean;
};

type ProcedureFormKind = 'tooth' | 'general';

type ProcedureGroup = {
    key: string;
    label: string;
    procedures: ProcedureItem[];
};

const INTERNATIONAL_NUMBERS = [
    18, 17, 16, 15, 14, 13, 12, 11,
    21, 22, 23, 24, 25, 26, 27, 28,
    48, 47, 46, 45, 44, 43, 42, 41,
    31, 32, 33, 34, 35, 36, 37, 38,
];

function asList<T>(payload: unknown): T[] {
    if (Array.isArray(payload)) return payload as T[];
    if (
        payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { results?: unknown[] }).results)
    ) {
        return (payload as { results: T[] }).results;
    }
    return [];
}

function hasOdontoAccess(): boolean {
    try {
        const stored = localStorage.getItem('loggedProfessional');
        if (!stored) return false;
        const professional = JSON.parse(stored) as { specialty?: string };
        const specialty = (professional.specialty || '')
            .toString()
            .trim()
            .toLowerCase();
        return (
            specialty.includes('odonto') ||
            specialty.includes('dent') ||
            specialty.includes('ortodont')
        );
    } catch {
        return false;
    }
}

function formatDate(dateIso?: string | null): string {
    if (!dateIso) return '-';
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR');
}

function formatDateShort(dateIso?: string | null): string {
    if (!dateIso) return '-';
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
    });
}

function formatMoney(value?: number | null): string {
    if (value == null) return '-';
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}

function toNumber(value?: number | string | null): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return Number.isNaN(value) ? null : value;
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
}

function formatAmount(value?: number | string | null): string {
    const numeric = toNumber(value);
    if (numeric == null) return '-';
    return formatMoney(numeric);
}

function eventDateISO(proc: ProcedureItem): string | null {
    return proc.completed_at || proc.started_at || null;
}

function isProcedureCompleted(proc: ProcedureItem): boolean {
    return !!proc.completed_at;
}

function isInconsistentStatus(proc: ProcedureItem): boolean {
    return proc.status === 'pending' && !!proc.completed_at;
}

function todayISODate(): string {
    return new Date().toISOString().slice(0, 10);
}

export default function OdontoArcadePage() {
    const navigate = useNavigate();
    const { clientId } = useParams();

    const canAccess = React.useMemo(() => hasOdontoAccess(), []);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [clientName, setClientName] = React.useState<string | null>(null);
    const [arcade, setArcade] = React.useState<ArcadeListItem | null>(null);
    const [teeth, setTeeth] = React.useState<ToothItem[]>([]);
    const [procedures, setProcedures] = React.useState<ProcedureItem[]>([]);
    const [selectedToothId, setSelectedToothId] = React.useState<number | null>(
        null,
    );
    const [activeDateIndex, setActiveDateIndex] = React.useState(0);

    const [formOpen, setFormOpen] = React.useState(false);
    const [formMode, setFormMode] = React.useState<'create' | 'edit'>('create');
    const [editingProcedureId, setEditingProcedureId] = React.useState<number | null>(
        null,
    );
    const [savingForm, setSavingForm] = React.useState(false);
    const [formError, setFormError] = React.useState<string | null>(null);
    const [validatedProcedureIds, setValidatedProcedureIds] = React.useState<
        Set<number>
    >(new Set());
    const [inlineForm, setInlineForm] = React.useState({
        kind: 'tooth' as ProcedureFormKind,
        toothId: '',
        name: '',
        faces_raw: '',
        date: todayISODate(),
        patient_amount: '',
        notes: '',
    });

    const standardProcedureSuggestions = React.useMemo(
        () => [
            'Restauracao em resina fotopolimerizavel 1 face',
            'Restauracao em resina fotopolimerizavel 2 faces',
            'Restauracao em resina fotopolimerizavel 4 faces',
            'Tratamento endodontico multirradicular',
            'Profilaxia: polimento coronario',
            'Consulta odontologica inicial',
        ],
        [],
    );

    const numericClientId = React.useMemo(() => Number(clientId || 0), [clientId]);

    const loadArcade = React.useCallback(async () => {
        if (!numericClientId || !canAccess) return;
        setLoading(true);
        setError(null);
        try {
            const [arcadesRes, clientRes] = await Promise.all([
                apiFetch(`/odonto/arcades/?client=${numericClientId}`),
                apiFetch(`/register/clients/${numericClientId}/`).catch(() => null),
            ]);

            if (clientRes && typeof clientRes === 'object') {
                const c = clientRes as { first_name?: string; last_name?: string };
                const fullName = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();
                if (fullName) setClientName(fullName);
            }

            const arcades = asList<ArcadeListItem>(arcadesRes);

            const currentArcade = [...arcades].sort((a, b) => {
                const aCount =
                    (a.pending_procedures || 0) + (a.completed_procedures || 0);
                const bCount =
                    (b.pending_procedures || 0) + (b.completed_procedures || 0);
                if (bCount !== aCount) return bCount - aCount;

                const ta = new Date(a.updated_at || 0).getTime();
                const tb = new Date(b.updated_at || 0).getTime();
                return tb - ta;
            })[0];

            if (!currentArcade) {
                setArcade(null);
                setTeeth([]);
                setProcedures([]);
                setSelectedToothId(null);
                return;
            }

            setArcade(currentArcade);

            const [teethRes, proceduresRes] = await Promise.all([
                apiFetch(`/odonto/teeth/?arcade=${currentArcade.id}`),
                apiFetch(`/odonto/procedures/?arcade=${currentArcade.id}`),
            ]);

            const fetchedTeeth = asList<ToothItem>(teethRes).sort(
                (a, b) => a.sequence - b.sequence,
            );
            const fetchedProcedures = asList<ProcedureItem>(proceduresRes);

            setTeeth(fetchedTeeth);
            setProcedures(fetchedProcedures);
            setSelectedToothId(prev => prev ?? fetchedTeeth[0]?.id ?? null);
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : 'Nao foi possivel carregar os dados da arcada.';
            setError(message || 'Nao foi possivel carregar os dados da arcada.');
        } finally {
            setLoading(false);
        }
    }, [numericClientId, canAccess]);

    React.useEffect(() => {
        void loadArcade();
    }, [loadArcade]);

    const toothById = React.useMemo(() => {
        const map = new Map<number, ToothItem>();
        for (const tooth of teeth) map.set(tooth.id, tooth);
        return map;
    }, [teeth]);

    const datedProcedures = React.useMemo(
        () =>
            [...procedures]
                .filter(proc => !!eventDateISO(proc))
                .sort((a, b) => {
                    const ta = new Date(eventDateISO(a) || '').getTime();
                    const tb = new Date(eventDateISO(b) || '').getTime();
                    return ta - tb;
                }),
        [procedures],
    );

    const dateKeys = React.useMemo(() => {
        const keys = new Set<string>();
        for (const proc of datedProcedures) {
            const date = eventDateISO(proc);
            if (date) keys.add(date);
        }
        return Array.from(keys).sort(
            (a, b) => new Date(a).getTime() - new Date(b).getTime(),
        );
    }, [datedProcedures]);

    React.useEffect(() => {
        if (dateKeys.length === 0) {
            setActiveDateIndex(0);
            return;
        }
        setActiveDateIndex(prev => {
            const clamped = Math.max(0, Math.min(prev, dateKeys.length - 1));
            if (prev === 0) return dateKeys.length - 1;
            return clamped;
        });
    }, [dateKeys]);

    const activeDateKey = dateKeys[activeDateIndex] ?? null;

    const activeDateProcedures = React.useMemo(() => {
        if (!activeDateKey) return [] as ProcedureItem[];
        return datedProcedures.filter(proc => eventDateISO(proc) === activeDateKey);
    }, [datedProcedures, activeDateKey]);

    const activeDateToothIds = React.useMemo(() => {
        const ids = new Set<number>();
        for (const proc of activeDateProcedures) {
            if (proc.tooth != null) ids.add(proc.tooth);
        }
        return ids;
    }, [activeDateProcedures]);

    React.useEffect(() => {
        if (selectedToothId && toothById.has(selectedToothId)) return;
        const firstToothId = Array.from(activeDateToothIds)[0] ?? null;
        if (firstToothId != null) {
            setSelectedToothId(firstToothId);
            return;
        }
        const fallbackToothId = teeth[0]?.id ?? null;
        if (fallbackToothId != null) setSelectedToothId(fallbackToothId);
    }, [activeDateToothIds, selectedToothId, toothById, teeth]);

    const orderedTeeth = React.useMemo(() => {
        if (teeth.length > 0) return teeth;
        return INTERNATIONAL_NUMBERS.map((internationalNumber, index) => ({
            id: -(index + 1),
            sequence: index + 1,
            international_number: internationalNumber,
        }));
    }, [teeth]);

    const procedureGroups = React.useMemo(() => {
        const sorted = [...procedures].sort((a, b) => {
            const ad = eventDateISO(a);
            const bd = eventDateISO(b);
            if (!ad && !bd) return b.id - a.id;
            if (!ad) return 1;
            if (!bd) return -1;
            const t = new Date(bd).getTime() - new Date(ad).getTime();
            if (t !== 0) return t;
            return b.id - a.id;
        });

        const map = new Map<string, ProcedureItem[]>();
        for (const proc of sorted) {
            const key = eventDateISO(proc) || 'SEM_DATA';
            const list = map.get(key) ?? [];
            list.push(proc);
            map.set(key, list);
        }

        return Array.from(map.entries()).map<ProcedureGroup>(([key, list]) => ({
            key,
            label: key === 'SEM_DATA' ? 'Sem data' : formatDate(key),
            procedures: list,
        }));
    }, [procedures]);

    function openCreateForm() {
        setFormError(null);
        setFormMode('create');
        setEditingProcedureId(null);
        setInlineForm({
            kind: selectedToothId ? 'tooth' : 'general',
            toothId: selectedToothId ? String(selectedToothId) : '',
            name: '',
            faces_raw: '',
            date: todayISODate(),
            patient_amount: '',
            notes: '',
        });
        setFormOpen(true);
    }

    function openEditForm(proc: ProcedureItem) {
        setFormError(null);
        setFormMode('edit');
        setEditingProcedureId(proc.id);
        setInlineForm({
            kind: proc.tooth == null ? 'general' : 'tooth',
            toothId: proc.tooth == null ? '' : String(proc.tooth),
            name: proc.name,
            faces_raw: proc.faces_raw || '',
            date: eventDateISO(proc) || '',
            patient_amount:
                proc.patient_amount == null ? '' : String(proc.patient_amount),
            notes: proc.notes || '',
        });
        setFormOpen(true);
    }

    async function saveInlineProcedure() {
        if (!arcade) return;

        const name = inlineForm.name.trim();
        if (!name) {
            setFormError('Informe o nome do procedimento.');
            return;
        }

        const isTooth = inlineForm.kind === 'tooth';
        const toothId = isTooth ? Number(inlineForm.toothId || 0) : null;
        if (isTooth && !toothId) {
            setFormError('Selecione o dente para salvar o procedimento.');
            return;
        }

        let amount: number | null = null;
        const amountRaw = inlineForm.patient_amount.replace(',', '.').trim();
        if (amountRaw) {
            const parsed = Number(amountRaw);
            if (Number.isNaN(parsed) || parsed < 0) {
                setFormError('Valor invalido. Use um numero maior ou igual a zero.');
                return;
            }
            amount = parsed;
        }

        setSavingForm(true);
        setFormError(null);

        try {
            if (formMode === 'create') {
                const dateToUse = inlineForm.date || todayISODate();
                if (dateToUse < todayISODate()) {
                    setFormError(
                        'Nao e permitido cadastrar novo procedimento com data retroativa.',
                    );
                    setSavingForm(false);
                    return;
                }

                await apiFetch('/odonto/procedures/', {
                    method: 'POST',
                    body: {
                        arcade: arcade.id,
                        tooth: isTooth ? toothId : null,
                        surface: null,
                        faces_raw: isTooth ? inlineForm.faces_raw || null : null,
                        code: '',
                        name,
                        status: 'pending',
                        started_at: dateToUse,
                        completed_at: null,
                        patient_amount: amount,
                        paid_amount: null,
                        notes: inlineForm.notes.trim(),
                        is_active: true,
                    },
                });
            } else {
                const original = procedures.find(p => p.id === editingProcedureId);
                if (!original) {
                    setFormError('Procedimento nao encontrado para edicao.');
                    setSavingForm(false);
                    return;
                }

                let startedAt = original.started_at || null;
                let completedAt = original.completed_at || null;
                if (inlineForm.date) {
                    if (original.completed_at) completedAt = inlineForm.date;
                    else startedAt = inlineForm.date;
                } else if (!original.started_at && !original.completed_at) {
                    startedAt = todayISODate();
                }

                await apiFetch(`/odonto/procedures/${original.id}/`, {
                    method: 'PATCH',
                    body: {
                        tooth: isTooth ? toothId : null,
                        faces_raw: isTooth ? inlineForm.faces_raw || null : null,
                        name,
                        patient_amount: amount,
                        notes: inlineForm.notes.trim(),
                        started_at: startedAt,
                        completed_at: completedAt,
                    },
                });

                setValidatedProcedureIds(prev => {
                    const next = new Set(prev);
                    next.add(original.id);
                    return next;
                });
            }

            setFormOpen(false);
            await loadArcade();
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : 'Nao foi possivel salvar o procedimento.';
            setFormError(message || 'Nao foi possivel salvar o procedimento.');
        } finally {
            setSavingForm(false);
        }
    }

    async function deleteProcedure(procId: number) {
        if (!window.confirm('Deseja apagar este procedimento?')) return;
        try {
            await apiFetch(`/odonto/procedures/${procId}/`, { method: 'DELETE' });
            await loadArcade();
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : 'Nao foi possivel apagar o procedimento.';
            setError(message || 'Nao foi possivel apagar o procedimento.');
        }
    }

    function isProcedurePaid(proc: ProcedureItem): boolean {
        return !!proc.paid_at;
    }

    async function toggleProcedurePaid(proc: ProcedureItem) {
        const currentlyPaid = isProcedurePaid(proc);
        if (currentlyPaid) {
            const confirmed = window.confirm(
                'Atenção: este procedimento voltará para pendente de pagamento. Deseja continuar?',
            );
            if (!confirmed) return;
        }

        try {
            const patientAmount = toNumber(proc.patient_amount);
            await apiFetch(`/odonto/procedures/${proc.id}/`, {
                method: 'PATCH',
                body: {
                    paid_amount: currentlyPaid ? null : patientAmount,
                    paid_at: currentlyPaid ? null : todayISODate(),
                },
            });
            await loadArcade();
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : 'Nao foi possivel atualizar o pagamento do procedimento.';
            setError(
                message ||
                    'Nao foi possivel atualizar o pagamento do procedimento.',
            );
        }
    }

    function needsAttention(proc: ProcedureItem): boolean {
        if (validatedProcedureIds.has(proc.id)) return false;
        return isInconsistentStatus(proc) || (!proc.started_at && !proc.completed_at);
    }

    if (!canAccess) {
        return (
            <div className={styles.page}>
                <h1 className={styles.title}>Arcada odontologica</h1>
                <p className={styles.text}>
                    Este modulo esta disponivel apenas para profissionais da area odontologica.
                </p>
                <div>
                    <button type='button' onClick={() => navigate('/')} className={styles.btn}>
                        Voltar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.headerCard}>
                <div>
                    <h1 className={styles.title}>Arcada odontologica</h1>
                    <p className={styles.text}>{clientName ?? `Cliente #${clientId}`}</p>
                </div>
                <div className={styles.headerActions}>
                    <button type='button' onClick={openCreateForm} className={styles.btnPrimary}>
                        + Novo procedimento
                    </button>
                    <button type='button' onClick={() => navigate('/')} className={styles.btn}>
                        Voltar para clientes
                    </button>
                </div>
            </header>

            {loading && <p className={styles.text}>Carregando arcada...</p>}

            {!loading && error && (
                <div className={styles.errorCard}>
                    <p className={styles.text}>{error}</p>
                    <button type='button' onClick={() => void loadArcade()} className={styles.btn}>
                        Tentar novamente
                    </button>
                </div>
            )}

            {!loading && !error && !arcade && (
                <div className={styles.emptyCard}>
                    <p className={styles.text}>Este cliente ainda nao possui arcada cadastrada.</p>
                </div>
            )}

            {!loading && !error && arcade && (
                <>
                    <section className={styles.arcadeCard}>
                        <div className={styles.arcadeHeader}>
                            <div className={styles.timelineHeader}>
                                <h2 className={styles.sectionTitle}>Mapa da arcada</h2>
                                <div className={styles.timelineNav}>
                                    <button
                                        type='button'
                                        className={styles.btn}
                                        onClick={() =>
                                            setActiveDateIndex(prev => Math.max(0, prev - 1))
                                        }
                                        disabled={activeDateIndex <= 0 || dateKeys.length === 0}
                                    >
                                        {'<'}
                                    </button>
                                    <span className={styles.timelineDateLabel}>
                                        {activeDateKey ? formatDate(activeDateKey) : 'Sem data'}
                                    </span>
                                    <button
                                        type='button'
                                        className={styles.btn}
                                        onClick={() =>
                                            setActiveDateIndex(prev =>
                                                Math.min(dateKeys.length - 1, prev + 1),
                                            )
                                        }
                                        disabled={
                                            activeDateIndex >= dateKeys.length - 1 ||
                                            dateKeys.length === 0
                                        }
                                    >
                                        {'>'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className={styles.svgWrap}>
                            <svg
                                className={styles.arcadeSvg}
                                viewBox='0 0 760 390'
                                role='img'
                                aria-label='Mapa da arcada com 32 dentes'
                            >
                                <text x='24' y='24' className={styles.quadrantLabel}>
                                    Q1 - SUPERIOR DIREITO
                                </text>
                                <text x='386' y='24' className={styles.quadrantLabel}>
                                    Q2 - SUPERIOR ESQUERDO
                                </text>
                                <text x='24' y='222' className={styles.quadrantLabel}>
                                    Q4 - INFERIOR DIREITO
                                </text>
                                <text x='386' y='222' className={styles.quadrantLabel}>
                                    Q3 - INFERIOR ESQUERDO
                                </text>
                                <line
                                    x1='371'
                                    y1='34'
                                    x2='371'
                                    y2='376'
                                    className={styles.quadrantGuide}
                                />
                                <line
                                    x1='20'
                                    y1='200'
                                    x2='740'
                                    y2='200'
                                    className={styles.quadrantGuide}
                                />
                                {orderedTeeth.map((tooth, index) => {
                                    const row = Math.floor(index / 8);
                                    const col = index % 8;
                                    const x = 20 + col * 90;
                                    const lowerOffset = row >= 2 ? 24 : 0;
                                    const y = 40 + row * 82 + lowerOffset;
                                    const selected = selectedToothId === tooth.id;

                                    return (
                                        <g
                                            key={tooth.id}
                                            className={styles.toothGroup}
                                            onClick={() => setSelectedToothId(tooth.id)}
                                            onKeyDown={event => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    setSelectedToothId(tooth.id);
                                                }
                                            }}
                                            role='button'
                                            tabIndex={0}
                                            aria-label={`Dente ${tooth.international_number}`}
                                        >
                                            <rect
                                                x={x}
                                                y={y}
                                                width='72'
                                                height='62'
                                                rx='10'
                                                className={`${styles.toothRect} ${styles.toothEmpty} ${
                                                    selected ? styles.toothSelected : ''
                                                }`}
                                            />
                                            <text
                                                x={x + 36}
                                                y={y + 34}
                                                className={styles.toothNumber}
                                            >
                                                {tooth.international_number}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>

                        <div className={styles.composerDivider} />

                        {formOpen && (
                            <div className={styles.inlineComposer}>
                                <div className={styles.composerHeader}>
                                    <h3 className={styles.sectionTitle}>
                                        {formMode === 'create'
                                            ? 'Adicionar procedimento'
                                            : 'Editar procedimento'}
                                    </h3>
                                    <div className={styles.typeToggle}>
                                        <label
                                            className={`${styles.typeOption} ${
                                                inlineForm.kind === 'tooth'
                                                    ? styles.typeOptionActive
                                                    : ''
                                            }`}
                                        >
                                            <input
                                                type='radio'
                                                name='procedure-kind'
                                                value='tooth'
                                                checked={inlineForm.kind === 'tooth'}
                                                onChange={() =>
                                                    setInlineForm(prev => ({
                                                        ...prev,
                                                        kind: 'tooth',
                                                        toothId:
                                                            prev.toothId ||
                                                            (selectedToothId
                                                                ? String(selectedToothId)
                                                                : ''),
                                                    }))
                                                }
                                                disabled={savingForm}
                                            />
                                            Por dente
                                        </label>
                                        <label
                                            className={`${styles.typeOption} ${
                                                inlineForm.kind === 'general'
                                                    ? styles.typeOptionActive
                                                    : ''
                                            }`}
                                        >
                                            <input
                                                type='radio'
                                                name='procedure-kind'
                                                value='general'
                                                checked={inlineForm.kind === 'general'}
                                                onChange={() =>
                                                    setInlineForm(prev => ({
                                                        ...prev,
                                                        kind: 'general',
                                                        toothId: '',
                                                        faces_raw: '',
                                                    }))
                                                }
                                                disabled={savingForm}
                                            />
                                            Geral
                                        </label>
                                    </div>
                                </div>

                                {formError && <p className={styles.modalError}>{formError}</p>}

                                <div className={styles.formGrid}>
                                    {inlineForm.kind === 'tooth' && (
                                        <label className={styles.formLabel}>
                                            Dente
                                            <select
                                                value={inlineForm.toothId}
                                                onChange={event =>
                                                    setInlineForm(prev => ({
                                                        ...prev,
                                                        toothId: event.target.value,
                                                    }))
                                                }
                                                className={styles.input}
                                                disabled={savingForm}
                                            >
                                                <option value=''>Selecione um dente</option>
                                                {orderedTeeth.map(tooth => (
                                                    <option key={tooth.id} value={tooth.id}>
                                                        Dente {tooth.international_number}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}

                                    <label className={styles.formLabel}>
                                        Nome do procedimento *
                                        <input
                                            value={inlineForm.name}
                                            list='inline-procedure-suggestions'
                                            onChange={event =>
                                                setInlineForm(prev => ({
                                                    ...prev,
                                                    name: event.target.value,
                                                }))
                                            }
                                            className={styles.input}
                                            placeholder='Ex.: Restauracao em resina'
                                            disabled={savingForm}
                                        />
                                        <datalist id='inline-procedure-suggestions'>
                                            {standardProcedureSuggestions.map(name => (
                                                <option key={name} value={name} />
                                            ))}
                                        </datalist>
                                    </label>

                                    {inlineForm.kind === 'tooth' && (
                                        <label className={styles.formLabel}>
                                            Face (opcional)
                                            <select
                                                value={inlineForm.faces_raw}
                                                onChange={event =>
                                                    setInlineForm(prev => ({
                                                        ...prev,
                                                        faces_raw: event.target.value,
                                                    }))
                                                }
                                                className={styles.input}
                                                disabled={savingForm}
                                            >
                                                <option value=''>- Nenhuma face -</option>
                                                <option value='O'>O - Oclusal</option>
                                                <option value='V'>V - Vestibular</option>
                                                <option value='P'>P - Palatina / Lingual</option>
                                                <option value='M'>M - Mesial</option>
                                                <option value='D'>D - Distal</option>
                                                <option value='MO'>MO - Mesial / Oclusal</option>
                                                <option value='DO'>DO - Distal / Oclusal</option>
                                                <option value='VO'>VO - Vestibular / Oclusal</option>
                                                <option value='PO'>PO - Palatina / Oclusal</option>
                                                <option value='MDO'>MDO - Mesial / Distal / Oclusal</option>
                                            </select>
                                        </label>
                                    )}

                                    <label className={styles.formLabel}>
                                        Data
                                        <input
                                            type='date'
                                            value={inlineForm.date}
                                            min={formMode === 'create' ? todayISODate() : undefined}
                                            onChange={event =>
                                                setInlineForm(prev => ({
                                                    ...prev,
                                                    date: event.target.value,
                                                }))
                                            }
                                            className={styles.input}
                                            disabled={savingForm}
                                        />
                                    </label>

                                    <label className={styles.formLabel}>
                                        Valor
                                        <input
                                            type='text'
                                            inputMode='decimal'
                                            value={inlineForm.patient_amount}
                                            onChange={event =>
                                                setInlineForm(prev => ({
                                                    ...prev,
                                                    patient_amount: event.target.value,
                                                }))
                                            }
                                            className={styles.input}
                                            placeholder='0,00'
                                            disabled={savingForm}
                                        />
                                    </label>

                                    <label className={styles.formLabel}>
                                        Observacao
                                        <textarea
                                            value={inlineForm.notes}
                                            onChange={event =>
                                                setInlineForm(prev => ({
                                                    ...prev,
                                                    notes: event.target.value,
                                                }))
                                            }
                                            className={styles.textarea}
                                            rows={3}
                                            placeholder='Anotacoes breves do atendimento'
                                            disabled={savingForm}
                                        />
                                    </label>
                                </div>

                                <div className={styles.modalActions}>
                                    <button
                                        type='button'
                                        className={styles.btn}
                                        onClick={() => setFormOpen(false)}
                                        disabled={savingForm}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type='button'
                                        className={styles.btnPrimary}
                                        onClick={() => void saveInlineProcedure()}
                                        disabled={savingForm}
                                    >
                                        {savingForm ? 'Salvando...' : 'Salvar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                    <section className={styles.detailCard}>
                        <div className={styles.sectionHeaderWithAction}>
                            <h2 className={styles.sectionTitle}>Procedimentos</h2>
                            <div className={styles.procedureLegend}>
                                <span className={styles.procedureLegendItem}>
                                    <span
                                        className={`${styles.statusDot} ${styles.statusDotPending}`}
                                        aria-hidden='true'
                                    />
                                    Pendente
                                </span>
                                <span className={styles.procedureLegendItem}>
                                    <span
                                        className={`${styles.statusDot} ${styles.statusDotCompleted}`}
                                        aria-hidden='true'
                                    />
                                    Concluido
                                </span>
                            </div>
                        </div>
                        <details className={styles.faceLegend}>
                            <summary>Legenda das faces (V, D, VO, DVMO...)</summary>
                            <p>
                                O: Oclusal, V: Vestibular, P: Palatina/Lingual, M: Mesial,
                                D: Distal, MO: Mesial/Oclusal, DO: Distal/Oclusal, VO:
                                Vestibular/Oclusal, PO: Palatina/Oclusal, MDO: Mesial/Distal/Oclusal.
                            </p>
                        </details>

                        {procedureGroups.length === 0 ? (
                            <p className={styles.textMuted}>Nenhum procedimento cadastrado.</p>
                        ) : (
                            <div className={styles.groupList}>
                                {procedureGroups.map(group => (
                                    <div key={group.key} className={styles.groupCard}>
                                        <div className={styles.groupHeader}>
                                            <strong className={styles.groupTitle}>{group.label}</strong>
                                        </div>
                                        <ul className={styles.procList}>
                                            {group.procedures.map(proc => {
                                                const tooth = proc.tooth
                                                    ? toothById.get(proc.tooth)
                                                    : null;
                                                return (
                                                    <li key={proc.id} className={styles.procItem}>
                                                        <span className={styles.procName}>
                                                            <span
                                                                className={`${styles.statusDot} ${
                                                                    isProcedureCompleted(proc)
                                                                        ? styles.statusDotCompleted
                                                                        : styles.statusDotPending
                                                                }`}
                                                                title={
                                                                    isProcedureCompleted(proc)
                                                                        ? 'Procedimento concluido'
                                                                        : 'Procedimento pendente'
                                                                }
                                                            />
                                                            {needsAttention(proc) && (
                                                                <span
                                                                    className={styles.attentionDot}
                                                                    title='Atencao: verifique este dado'
                                                                />
                                                            )}
                                                            <strong>
                                                                {tooth
                                                                    ? `Dente ${tooth.international_number}`
                                                                    : 'Geral'}
                                                            </strong>{' '}
                                                            · {proc.name}
                                                            {proc.faces_raw && (
                                                                <span className={styles.faceBadge}>
                                                                    {proc.faces_raw}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className={styles.procMeta}>
                                                            <span className={styles.procValueWrap}>
                                                                <span>{formatAmount(proc.patient_amount)}</span>
                                                                {proc.paid_at && (
                                                                    <>
                                                                        <span className={styles.paidDateDesktop}>
                                                                            {formatDate(proc.paid_at)}
                                                                        </span>
                                                                        <span className={styles.paidDateMobile}>
                                                                            {formatDateShort(proc.paid_at)}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </span>
                                                            <span className={styles.rowActions}>
                                                                <button
                                                                    type='button'
                                                                    className={`${styles.iconBtn} ${
                                                                        isProcedurePaid(proc)
                                                                            ? styles.iconBtnPaidActive
                                                                            : ''
                                                                    }`}
                                                                    onClick={() =>
                                                                        void toggleProcedurePaid(proc)
                                                                    }
                                                                    aria-label={
                                                                        isProcedurePaid(proc)
                                                                            ? 'Marcar como pendente de pagamento'
                                                                            : 'Marcar como pago'
                                                                    }
                                                                    title={
                                                                        isProcedurePaid(proc)
                                                                            ? `Pago em ${formatDate(proc.paid_at)}`
                                                                            : 'Marcar como pago'
                                                                    }
                                                                >
                                                                    <svg
                                                                        viewBox='0 0 24 24'
                                                                        aria-hidden='true'
                                                                        className={styles.iconSvg}
                                                                    >
                                                                        <path
                                                                            d='M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm2 0v2h14V7H5zm7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
                                                                            fill='currentColor'
                                                                        />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    type='button'
                                                                    className={styles.iconBtn}
                                                                    onClick={() => openEditForm(proc)}
                                                                    aria-label='Editar procedimento'
                                                                    title='Editar procedimento'
                                                                >
                                                                    <svg
                                                                        viewBox='0 0 24 24'
                                                                        aria-hidden='true'
                                                                        className={styles.iconSvg}
                                                                    >
                                                                        <path
                                                                            d='M4 20h4l10-10-4-4L4 16v4zm13.7-11.3 1.6-1.6a1 1 0 0 0 0-1.4l-1.3-1.3a1 1 0 0 0-1.4 0L15 6l2.7 2.7z'
                                                                            fill='currentColor'
                                                                        />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    type='button'
                                                                    className={styles.iconBtnDanger}
                                                                    onClick={() =>
                                                                        void deleteProcedure(proc.id)
                                                                    }
                                                                    aria-label='Apagar procedimento'
                                                                    title='Apagar procedimento'
                                                                >
                                                                    <svg
                                                                        viewBox='0 0 24 24'
                                                                        aria-hidden='true'
                                                                        className={styles.iconSvg}
                                                                    >
                                                                        <path
                                                                            d='M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9zm-1 11h12a2 2 0 0 0 2-2V7H4v11a2 2 0 0 0 2 2z'
                                                                            fill='currentColor'
                                                                        />
                                                                    </svg>
                                                                </button>
                                                            </span>
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
