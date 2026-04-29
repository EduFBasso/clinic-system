import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../utils/apiFetch';
import AppModal from '../components/Modal';
import styles from '../styles/pages/OdontoArcadePage.module.css';

type ArcadeListItem = {
    id: number;
    status: 'pending' | 'completed';
    started_at?: string | null;
    completed_at?: string | null;
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
    patient_amount?: number | null;
    started_at?: string | null;
    completed_at?: string | null;
    is_active: boolean;
};

type ToothVisualState = 'empty' | 'pending' | 'completed' | 'canceled';

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

function labelStatus(status: ProcedureItem['status']): string {
    if (status === 'pending') return 'Pendente';
    if (status === 'completed') return 'Concluido';
    return 'Cancelado';
}

function getToothState(procs: ProcedureItem[]): ToothVisualState {
    if (procs.length === 0) return 'empty';

    // Tratamento pendente so entra no mapa quando ja foi iniciado no dente.
    if (procs.some(p => p.status === 'pending' && !!p.started_at)) {
        return 'pending';
    }
    if (procs.some(p => p.status === 'completed')) return 'completed';
    if (procs.some(p => p.status === 'canceled')) return 'canceled';

    // Ex.: procedimento criado como pending sem data de inicio -> manter neutro.
    return 'empty';
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
    const [generalModalOpen, setGeneralModalOpen] = React.useState(false);
    const [savingGeneral, setSavingGeneral] = React.useState(false);
    const [generalError, setGeneralError] = React.useState<string | null>(null);
    const [generalForm, setGeneralForm] = React.useState({
        name: '',
        code: '',
        status: 'pending' as ProcedureItem['status'],
        started_at: '',
        patient_amount: '',
        paid: false,
        notes: '',
    });
    const [toothModalOpen, setToothModalOpen] = React.useState(false);
    const [savingTooth, setSavingTooth] = React.useState(false);
    const [toothError, setToothError] = React.useState<string | null>(null);
    const [toothForm, setToothForm] = React.useState({
        name: '',
        code: '',
        faces_raw: '',
        status: 'pending' as ProcedureItem['status'],
        started_at: '',
        patient_amount: '',
        paid: false,
        notes: '',
    });

    const numericClientId = React.useMemo(
        () => Number(clientId || 0),
        [clientId],
    );

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

    const proceduresByTooth = React.useMemo(() => {
        const map = new Map<number, ProcedureItem[]>();
        for (const proc of procedures) {
            if (proc.tooth == null) continue;
            const list = map.get(proc.tooth) ?? [];
            list.push(proc);
            map.set(proc.tooth, list);
        }
        return map;
    }, [procedures]);

    const generalProcedures = React.useMemo(
        () => procedures.filter(proc => proc.tooth == null),
        [procedures],
    );

    const selectedTooth = React.useMemo(
        () => teeth.find(t => t.id === selectedToothId) ?? null,
        [teeth, selectedToothId],
    );

    const selectedToothProcedures = React.useMemo(() => {
        if (!selectedToothId) return [] as ProcedureItem[];
        return proceduresByTooth.get(selectedToothId) ?? [];
    }, [proceduresByTooth, selectedToothId]);

    const orderedTeeth = React.useMemo(() => {
        if (teeth.length > 0) return teeth;
        // fallback visual se ainda nao houver estrutura criada
        return INTERNATIONAL_NUMBERS.map((internationalNumber, index) => ({
            id: -(index + 1),
            sequence: index + 1,
            international_number: internationalNumber,
        }));
    }, [teeth]);

    if (!canAccess) {
        return (
            <div className={styles.page}>
                <h1 className={styles.title}>Arcada odontologica</h1>
                <p className={styles.text}>
                    Este modulo esta disponivel apenas para profissionais da
                    area odontologica.
                </p>
                <div>
                    <button type='button' onClick={() => navigate('/')} className={styles.btn}>
                        Voltar
                    </button>
                </div>
            </div>
        );
    }

    const pendingCount = procedures.filter(p => p.status === 'pending').length;
    const completedCount = procedures.filter(
        p => p.status === 'completed',
    ).length;
    const canceledCount = procedures.filter(p => p.status === 'canceled').length;

    function openGeneralModal() {
        setGeneralError(null);
        setGeneralForm({
            name: '',
            code: '',
            status: 'pending',
            started_at: '',
            patient_amount: '',
            paid: false,
            notes: '',
        });
        setGeneralModalOpen(true);
    }

    async function saveGeneralProcedure() {
        if (!arcade) return;
        const name = generalForm.name.trim();
        if (!name) {
            setGeneralError('Informe o nome do procedimento.');
            return;
        }

        let amount: number | null = null;
        const amountRaw = generalForm.patient_amount.replace(',', '.').trim();
        if (amountRaw) {
            const parsed = Number(amountRaw);
            if (Number.isNaN(parsed) || parsed < 0) {
                setGeneralError('Valor invalido. Use um numero maior ou igual a zero.');
                return;
            }
            amount = parsed;
        }

        setSavingGeneral(true);
        setGeneralError(null);
        try {
            const completedDate =
                generalForm.status === 'completed'
                    ? generalForm.started_at || todayISODate()
                    : null;

            await apiFetch('/odonto/procedures/', {
                method: 'POST',
                body: {
                    arcade: arcade.id,
                    tooth: null,
                    surface: null,
                    code: generalForm.code.trim(),
                    name,
                    status: generalForm.status,
                    started_at: generalForm.started_at || null,
                    completed_at: completedDate,
                    patient_amount: amount,
                    paid_amount: generalForm.paid ? amount : null,
                    notes: generalForm.notes.trim(),
                    is_active: true,
                },
            });

            setGeneralModalOpen(false);
            await loadArcade();
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : 'Nao foi possivel salvar o procedimento geral.';
            setGeneralError(message || 'Nao foi possivel salvar o procedimento geral.');
        } finally {
            setSavingGeneral(false);
        }
    }

    function openToothModal() {
        setToothError(null);
        setToothForm({
            name: '',
            code: '',
            faces_raw: '',
            status: 'pending',
            started_at: '',
            patient_amount: '',
            paid: false,
            notes: '',
        });
        setToothModalOpen(true);
    }

    async function saveToothProcedure() {
        if (!arcade || !selectedToothId) return;
        const name = toothForm.name.trim();
        if (!name) {
            setToothError('Informe o nome do procedimento.');
            return;
        }

        let amount: number | null = null;
        const amountRaw = toothForm.patient_amount.replace(',', '.').trim();
        if (amountRaw) {
            const parsed = Number(amountRaw);
            if (Number.isNaN(parsed) || parsed < 0) {
                setToothError('Valor invalido. Use um numero maior ou igual a zero.');
                return;
            }
            amount = parsed;
        }

        setSavingTooth(true);
        setToothError(null);
        try {
            const completedDate =
                toothForm.status === 'completed'
                    ? toothForm.started_at || todayISODate()
                    : null;

            await apiFetch('/odonto/procedures/', {
                method: 'POST',
                body: {
                    arcade: arcade.id,
                    tooth: selectedToothId,
                    surface: null,
                    faces_raw: toothForm.faces_raw || null,
                    code: toothForm.code.trim(),
                    name,
                    status: toothForm.status,
                    started_at: toothForm.started_at || null,
                    completed_at: completedDate,
                    patient_amount: amount,
                    paid_amount: toothForm.paid ? amount : null,
                    notes: toothForm.notes.trim(),
                    is_active: true,
                },
            });

            setToothModalOpen(false);
            await loadArcade();
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : 'Nao foi possivel salvar o procedimento.';
            setToothError(message || 'Nao foi possivel salvar o procedimento.');
        } finally {
            setSavingTooth(false);
        }
    }

    return (
        <div className={styles.page}>
            <header className={styles.headerCard}>
                <div>
                    <h1 className={styles.title}>Arcada odontologica</h1>
                    <p className={styles.text}>
                        {clientName ?? `Cliente #${clientId}`}
                    </p>
                </div>
                <div className={styles.headerActions}>
                    <span
                        className={`${styles.badge} ${
                            arcade?.status === 'completed'
                                ? styles.badgeCompleted
                                : styles.badgePending
                        }`}
                    >
                        {arcade?.status === 'completed'
                            ? 'Arcada concluida'
                            : 'Arcada pendente'}
                    </span>
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
                    <p className={styles.text}>
                        Este cliente ainda nao possui arcada cadastrada.
                    </p>
                    <p className={styles.textMuted}>
                        Proximo passo: criar a arcada e inicializar a estrutura
                        de 32 dentes.
                    </p>
                </div>
            )}

            {!loading && !error && arcade && (
                <>
                    <section className={styles.kpiGrid}>
                        <div className={styles.kpiCard}>
                            <span className={styles.kpiLabel}>Pendentes</span>
                            <strong className={styles.kpiValue}>{pendingCount}</strong>
                        </div>
                        <div className={styles.kpiCard}>
                            <span className={styles.kpiLabel}>Concluidos</span>
                            <strong className={styles.kpiValue}>{completedCount}</strong>
                        </div>
                        <div className={styles.kpiCard}>
                            <span className={styles.kpiLabel}>Cancelados</span>
                            <strong className={styles.kpiValue}>{canceledCount}</strong>
                        </div>
                        <div className={styles.kpiCard}>
                            <span className={styles.kpiLabel}>Gerais</span>
                            <strong className={styles.kpiValue}>{generalProcedures.length}</strong>
                        </div>
                    </section>

                    <section className={styles.arcadeCard}>
                        <div className={styles.arcadeHeader}>
                            <h2 className={styles.sectionTitle}>Mapa da arcada</h2>
                            <p className={styles.textMuted}>
                                Numeracao FDI em destaque. Toque em um dente
                                para abrir o detalhe.
                            </p>
                        </div>
                        <div className={styles.svgWrap}>
                            <svg
                                className={styles.arcadeSvg}
                                viewBox='0 0 760 390'
                                role='img'
                                aria-label='Mapa da arcada com 32 dentes'
                            >
                                <text x='24' y='24' className={styles.quadrantLabel}>
                                    Q1 - Superior Direito
                                </text>
                                <text x='386' y='24' className={styles.quadrantLabel}>
                                    Q2 - Superior Esquerdo
                                </text>
                                <text x='24' y='222' className={styles.quadrantLabel}>
                                    Q4 - Inferior Direito
                                </text>
                                <text x='386' y='222' className={styles.quadrantLabel}>
                                    Q3 - Inferior Esquerdo
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
                                    const state = getToothState(
                                        proceduresByTooth.get(tooth.id) ?? [],
                                    );
                                    const selected = selectedToothId === tooth.id;

                                    const stateClass =
                                        state === 'pending'
                                            ? styles.toothPending
                                            : state === 'completed'
                                              ? styles.toothCompleted
                                              : state === 'canceled'
                                                ? styles.toothCanceled
                                                : styles.toothEmpty;

                                    return (
                                        <g
                                            key={tooth.id}
                                            className={styles.toothGroup}
                                            onClick={() => setSelectedToothId(tooth.id)}
                                            onKeyDown={event => {
                                                if (
                                                    event.key === 'Enter' ||
                                                    event.key === ' '
                                                ) {
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
                                                className={`${styles.toothRect} ${stateClass} ${
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
                        <div className={styles.legendRow}>
                            <span className={styles.legendItem}>
                                <span
                                    className={`${styles.legendSwatch} ${styles.toothPending}`}
                                    aria-hidden
                                />
                                Pendente
                            </span>
                            <span className={styles.legendItem}>
                                <span
                                    className={`${styles.legendSwatch} ${styles.toothCompleted}`}
                                    aria-hidden
                                />
                                Concluido
                            </span>
                            <span className={styles.legendItem}>
                                <span
                                    className={`${styles.legendSwatch} ${styles.toothCanceled}`}
                                    aria-hidden
                                />
                                Cancelado
                            </span>
                            <span className={styles.legendItem}>
                                <span
                                    className={`${styles.legendSwatch} ${styles.toothEmpty}`}
                                    aria-hidden
                                />
                                Inicial (nao iniciado)
                            </span>
                        </div>
                    </section>

                    <section className={styles.detailCard}>
                        <div className={styles.sectionHeaderWithAction}>
                            <h2 className={styles.sectionTitle}>
                                {selectedTooth
                                    ? `Dente ${selectedTooth.international_number}`
                                    : 'Detalhe do dente'}
                            </h2>
                            {selectedTooth && (
                                <button
                                    type='button'
                                    className={styles.btnPrimary}
                                    onClick={openToothModal}
                                >
                                    + Novo procedimento
                                </button>
                            )}
                        </div>
                        {selectedTooth ? (
                            <>
                                {selectedToothProcedures.length === 0 ? (
                                    <p className={styles.textMuted}>
                                        Nenhum procedimento neste dente ainda.
                                    </p>
                                ) : (
                                    <ul className={styles.procList}>
                                        {[...selectedToothProcedures]
                                            .sort((a, b) => {
                                                const ta = new Date(
                                                    a.started_at || 0,
                                                ).getTime();
                                                const tb = new Date(
                                                    b.started_at || 0,
                                                ).getTime();
                                                return tb - ta;
                                            })
                                            .map(proc => (
                                                <li key={proc.id} className={styles.procItem}>
                                                    <span className={styles.procName}>
                                                        {proc.name}
                                                        {proc.code
                                                            ? ` (${proc.code})`
                                                            : ''}
                                                    </span>
                                                    <span className={styles.procMeta}>
                                                        {proc.faces_raw && (
                                                            <span className={styles.faceBadge}>
                                                                {proc.faces_raw}
                                                            </span>
                                                        )}
                                                        <span
                                                            className={`${styles.badge} ${
                                                                proc.status === 'pending'
                                                                    ? styles.badgePending
                                                                    : proc.status === 'completed'
                                                                      ? styles.badgeCompleted
                                                                      : styles.badgeCanceled
                                                            }`}
                                                        >
                                                            {labelStatus(proc.status)}
                                                        </span>
                                                        {formatDate(proc.started_at)}
                                                    </span>
                                                </li>
                                            ))}
                                    </ul>
                                )}
                            </>
                        ) : (
                            <p className={styles.textMuted}>
                                Selecione um dente para visualizar os
                                procedimentos vinculados.
                            </p>
                        )}
                    </section>

                    <section className={styles.generalCard}>
                        <div className={styles.sectionHeaderWithAction}>
                            <h2 className={styles.sectionTitle}>
                                Procedimentos gerais (sem dente)
                            </h2>
                            <button
                                type='button'
                                className={styles.btnPrimary}
                                onClick={openGeneralModal}
                            >
                                Novo geral
                            </button>
                        </div>
                        {generalProcedures.length === 0 ? (
                            <p className={styles.textMuted}>
                                Nenhum procedimento geral cadastrado.
                            </p>
                        ) : (
                            <ul className={styles.procList}>
                                {generalProcedures.slice(0, 8).map(proc => (
                                    <li key={proc.id} className={styles.procItem}>
                                        <span>{proc.name}</span>
                                        <span className={styles.procMeta}>
                                            {labelStatus(proc.status)} -{' '}
                                            {formatDate(
                                                proc.completed_at || proc.started_at,
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}

            <AppModal
                open={generalModalOpen}
                onClose={() => {
                    if (savingGeneral) return;
                    setGeneralModalOpen(false);
                }}
                closeOnEscape
                showCloseButton
            >
                <div className={styles.modalBody}>
                    <h3 className={styles.modalTitle}>Novo procedimento geral</h3>
                    <p className={styles.textMuted}>
                        Registro sem vinculo de dente/face.
                    </p>

                    {generalError && (
                        <p className={styles.modalError}>{generalError}</p>
                    )}

                    <div className={styles.formGrid}>
                        <label className={styles.formLabel}>
                            Nome do procedimento *
                            <input
                                value={generalForm.name}
                                onChange={event =>
                                    setGeneralForm(prev => ({
                                        ...prev,
                                        name: event.target.value,
                                    }))
                                }
                                className={styles.input}
                                placeholder='Ex.: Profilaxia'
                                disabled={savingGeneral}
                            />
                        </label>

                        <label className={styles.formLabel}>
                            Codigo (opcional)
                            <input
                                value={generalForm.code}
                                onChange={event =>
                                    setGeneralForm(prev => ({
                                        ...prev,
                                        code: event.target.value,
                                    }))
                                }
                                className={styles.input}
                                placeholder='Ex.: PRC-001'
                                disabled={savingGeneral}
                            />
                        </label>

                        <label className={styles.formLabel}>
                            Status
                            <select
                                value={generalForm.status}
                                onChange={event =>
                                    setGeneralForm(prev => ({
                                        ...prev,
                                        status:
                                            event.target
                                                .value as ProcedureItem['status'],
                                    }))
                                }
                                className={styles.input}
                                disabled={savingGeneral}
                            >
                                <option value='pending'>Pendente</option>
                                <option value='completed'>Concluido</option>
                                <option value='canceled'>Cancelado</option>
                            </select>
                        </label>

                        <label className={styles.formLabel}>
                            Data
                            <input
                                type='date'
                                value={generalForm.started_at}
                                onChange={event =>
                                    setGeneralForm(prev => ({
                                        ...prev,
                                        started_at: event.target.value,
                                    }))
                                }
                                className={styles.input}
                                disabled={savingGeneral}
                            />
                        </label>

                        <label className={styles.formLabel}>
                            Valor
                            <input
                                type='text'
                                inputMode='decimal'
                                value={generalForm.patient_amount}
                                onChange={event =>
                                    setGeneralForm(prev => ({
                                        ...prev,
                                        patient_amount: event.target.value,
                                    }))
                                }
                                className={styles.input}
                                placeholder='0,00'
                                disabled={savingGeneral}
                            />
                        </label>

                        <label className={styles.checkboxRow}>
                            <input
                                type='checkbox'
                                checked={generalForm.paid}
                                onChange={event =>
                                    setGeneralForm(prev => ({
                                        ...prev,
                                        paid: event.target.checked,
                                    }))
                                }
                                disabled={savingGeneral}
                            />
                            Marcar como pago
                        </label>

                        <label className={styles.formLabel}>
                            Observacao
                            <textarea
                                value={generalForm.notes}
                                onChange={event =>
                                    setGeneralForm(prev => ({
                                        ...prev,
                                        notes: event.target.value,
                                    }))
                                }
                                className={styles.textarea}
                                rows={3}
                                placeholder='Anotacoes breves do atendimento'
                                disabled={savingGeneral}
                            />
                        </label>
                    </div>

                    <div className={styles.modalActions}>
                        <button
                            type='button'
                            className={styles.btn}
                            onClick={() => setGeneralModalOpen(false)}
                            disabled={savingGeneral}
                        >
                            Cancelar
                        </button>
                        <button
                            type='button'
                            className={styles.btnPrimary}
                            onClick={() => void saveGeneralProcedure()}
                            disabled={savingGeneral}
                        >
                            {savingGeneral ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            </AppModal>

            <AppModal
                open={toothModalOpen}
                onClose={() => {
                    if (savingTooth) return;
                    setToothModalOpen(false);
                }}
                closeOnEscape
                showCloseButton
            >
                <div className={styles.modalBody}>
                    <h3 className={styles.modalTitle}>
                        Novo procedimento
                        {selectedTooth
                            ? ` — Dente ${selectedTooth.international_number}`
                            : ''}
                    </h3>

                    {toothError && (
                        <p className={styles.modalError}>{toothError}</p>
                    )}

                    <div className={styles.formGrid}>
                        <label className={styles.formLabel}>
                            Nome do procedimento *
                            <input
                                value={toothForm.name}
                                onChange={event =>
                                    setToothForm(prev => ({
                                        ...prev,
                                        name: event.target.value,
                                    }))
                                }
                                className={styles.input}
                                placeholder='Ex.: Restauracao em resina'
                                disabled={savingTooth}
                            />
                        </label>

                        <label className={styles.formLabel}>
                            Face (opcional)
                            <select
                                value={toothForm.faces_raw}
                                onChange={event =>
                                    setToothForm(prev => ({
                                        ...prev,
                                        faces_raw: event.target.value,
                                    }))
                                }
                                className={styles.input}
                                disabled={savingTooth}
                            >
                                <option value=''>— Nenhuma face —</option>
                                <option value='O'>O – Oclusal</option>
                                <option value='V'>V – Vestibular</option>
                                <option value='P'>P – Palatina / Lingual</option>
                                <option value='M'>M – Mesial</option>
                                <option value='D'>D – Distal</option>
                                <option value='MO'>MO – Mesial / Oclusal</option>
                                <option value='DO'>DO – Distal / Oclusal</option>
                                <option value='VO'>VO – Vestibular / Oclusal</option>
                                <option value='PO'>PO – Palatina / Oclusal</option>
                                <option value='MDO'>MDO – Mesial / Distal / Oclusal</option>
                            </select>
                        </label>

                        <label className={styles.formLabel}>
                            Codigo (opcional)
                            <input
                                value={toothForm.code}
                                onChange={event =>
                                    setToothForm(prev => ({
                                        ...prev,
                                        code: event.target.value,
                                    }))
                                }
                                className={styles.input}
                                placeholder='Ex.: PRC-001'
                                disabled={savingTooth}
                            />
                        </label>

                        <label className={styles.formLabel}>
                            Status
                            <select
                                value={toothForm.status}
                                onChange={event =>
                                    setToothForm(prev => ({
                                        ...prev,
                                        status:
                                            event.target
                                                .value as ProcedureItem['status'],
                                    }))
                                }
                                className={styles.input}
                                disabled={savingTooth}
                            >
                                <option value='pending'>Pendente</option>
                                <option value='completed'>Concluido</option>
                                <option value='canceled'>Cancelado</option>
                            </select>
                        </label>

                        <label className={styles.formLabel}>
                            Data
                            <input
                                type='date'
                                value={toothForm.started_at}
                                onChange={event =>
                                    setToothForm(prev => ({
                                        ...prev,
                                        started_at: event.target.value,
                                    }))
                                }
                                className={styles.input}
                                disabled={savingTooth}
                            />
                        </label>

                        <label className={styles.formLabel}>
                            Valor
                            <input
                                type='text'
                                inputMode='decimal'
                                value={toothForm.patient_amount}
                                onChange={event =>
                                    setToothForm(prev => ({
                                        ...prev,
                                        patient_amount: event.target.value,
                                    }))
                                }
                                className={styles.input}
                                placeholder='0,00'
                                disabled={savingTooth}
                            />
                        </label>

                        <label className={styles.checkboxRow}>
                            <input
                                type='checkbox'
                                checked={toothForm.paid}
                                onChange={event =>
                                    setToothForm(prev => ({
                                        ...prev,
                                        paid: event.target.checked,
                                    }))
                                }
                                disabled={savingTooth}
                            />
                            Marcar como pago
                        </label>

                        <label className={styles.formLabel}>
                            Observacao
                            <textarea
                                value={toothForm.notes}
                                onChange={event =>
                                    setToothForm(prev => ({
                                        ...prev,
                                        notes: event.target.value,
                                    }))
                                }
                                className={styles.textarea}
                                rows={3}
                                placeholder='Anotacoes breves do atendimento'
                                disabled={savingTooth}
                            />
                        </label>
                    </div>

                    <div className={styles.modalActions}>
                        <button
                            type='button'
                            className={styles.btn}
                            onClick={() => setToothModalOpen(false)}
                            disabled={savingTooth}
                        >
                            Cancelar
                        </button>
                        <button
                            type='button'
                            className={styles.btnPrimary}
                            onClick={() => void saveToothProcedure()}
                            disabled={savingTooth}
                        >
                            {savingTooth ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            </AppModal>
        </div>
    );
}
