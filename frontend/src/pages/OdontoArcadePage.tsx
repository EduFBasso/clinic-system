import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../utils/apiFetch';
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
    if (procs.some(p => p.status === 'pending')) return 'pending';
    if (procs.some(p => p.status === 'completed')) return 'completed';
    return 'canceled';
}

export default function OdontoArcadePage() {
    const navigate = useNavigate();
    const { clientId } = useParams();

    const canAccess = React.useMemo(() => hasOdontoAccess(), []);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [arcade, setArcade] = React.useState<ArcadeListItem | null>(null);
    const [teeth, setTeeth] = React.useState<ToothItem[]>([]);
    const [procedures, setProcedures] = React.useState<ProcedureItem[]>([]);
    const [selectedToothId, setSelectedToothId] = React.useState<number | null>(
        null,
    );

    const numericClientId = React.useMemo(
        () => Number(clientId || 0),
        [clientId],
    );

    const loadArcade = React.useCallback(async () => {
        if (!numericClientId || !canAccess) return;
        setLoading(true);
        setError(null);
        try {
            const arcadesRes = await apiFetch(
                `/odonto/arcades/?client=${numericClientId}`,
            );
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

    return (
        <div className={styles.page}>
            <header className={styles.headerCard}>
                <div>
                    <h1 className={styles.title}>Arcada odontologica</h1>
                    <p className={styles.text}>Cliente #{clientId}</p>
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
                                Toque em um dente para abrir o detalhe.
                            </p>
                        </div>
                        <div className={styles.svgWrap}>
                            <svg
                                className={styles.arcadeSvg}
                                viewBox='0 0 760 340'
                                role='img'
                                aria-label='Mapa da arcada com 32 dentes'
                            >
                                {orderedTeeth.map((tooth, index) => {
                                    const row = Math.floor(index / 8);
                                    const col = index % 8;
                                    const x = 20 + col * 90;
                                    const y = 20 + row * 76;
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
                                                height='56'
                                                rx='10'
                                                className={`${styles.toothRect} ${stateClass} ${
                                                    selected ? styles.toothSelected : ''
                                                }`}
                                            />
                                            <text
                                                x={x + 36}
                                                y={y + 24}
                                                className={styles.toothNumber}
                                            >
                                                {tooth.international_number}
                                            </text>
                                            <text
                                                x={x + 36}
                                                y={y + 43}
                                                className={styles.toothSequence}
                                            >
                                                #{tooth.sequence}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </section>

                    <section className={styles.detailCard}>
                        <h2 className={styles.sectionTitle}>Detalhe do dente</h2>
                        {selectedTooth ? (
                            <>
                                <p className={styles.text}>
                                    Dente {selectedTooth.international_number} (sequencia #{' '}
                                    {selectedTooth.sequence})
                                </p>
                                <p className={styles.textMuted}>
                                    Procedimentos: {selectedToothProcedures.length}
                                </p>
                                {selectedToothProcedures.length === 0 ? (
                                    <p className={styles.textMuted}>
                                        Nenhum procedimento neste dente ainda.
                                    </p>
                                ) : (
                                    <ul className={styles.procList}>
                                        {selectedToothProcedures
                                            .slice(0, 8)
                                            .map(proc => (
                                                <li key={proc.id} className={styles.procItem}>
                                                    <span>
                                                        {proc.name}
                                                        {proc.code
                                                            ? ` (${proc.code})`
                                                            : ''}
                                                    </span>
                                                    <span className={styles.procMeta}>
                                                        {labelStatus(proc.status)}
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
                        <h2 className={styles.sectionTitle}>
                            Procedimentos gerais (sem dente)
                        </h2>
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
        </div>
    );
}
