import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { OdontoToothGrid } from '../components/OdontoToothGrid';
import { emit } from '../events/bus';
import { ApiError, apiFetch } from '../utils/apiFetch';
import { parseAmount, toInputAmount, validateAmount } from '../utils/currency';
import {
    asList,
    eventDateISO,
    formatDate,
    formatMoney,
    hasOdontoAccess,
    INTERNATIONAL_NUMBERS,
    todayISODate,
} from './odontoArcadeHelpers';
import type { ArcadeListItem, ProcedureItem, ToothItem } from './odontoArcadeHelpers';
import styles from '../styles/pages/OdontoArcadeSimplifiedPage.module.css';

type ServiceFlowType = 'tooth' | 'arcade' | 'other';

type ServiceRow = {
    toothId: number | null;
    phase: string;
    treatment: string;
    value: string;
    notes: string;
};

type ProductRow = {
    name: string;
    value: string;
};

function dateKeyFromProcedure(proc: ProcedureItem): string {
    const eventDate = eventDateISO(proc);
    if (eventDate) return eventDate;
    const createdAt = (proc as ProcedureItem & { created_at?: string }).created_at;
    if (createdAt && createdAt.length >= 10) return createdAt.slice(0, 10);
    return todayISODate();
}

const PHASE_OPTIONS = [
    '',
    'O',
    'V',
    'P',
    'M',
    'D',
    'MO',
    'DO',
    'VO',
    'PO',
    'MDO',
];

function normalizeMoneyInput(value: string): string {
    const parsed = parseAmount(value);
    if (parsed == null) return value;
    return toInputAmount(parsed.toFixed(2));
}

export default function OdontoArcadeSimplifiedPage() {
    const navigate = useNavigate();
    const { clientId } = useParams();

    const canAccess = React.useMemo(() => hasOdontoAccess(), []);
    const numericClientId = React.useMemo(() => Number(clientId || 0), [clientId]);

    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [clientName, setClientName] = React.useState<string | null>(null);

    const [arcade, setArcade] = React.useState<ArcadeListItem | null>(null);
    const [teeth, setTeeth] = React.useState<ToothItem[]>([]);
    const [procedures, setProcedures] = React.useState<ProcedureItem[]>([]);
    const [selectedToothId, setSelectedToothId] = React.useState<number | null>(null);
    const [mapVisible, setMapVisible] = React.useState(false);

    const [serviceFlowOpen, setServiceFlowOpen] = React.useState(false);
    const [productFlowOpen, setProductFlowOpen] = React.useState(false);
    const [savingServiceFlow, setSavingServiceFlow] = React.useState(false);
    const [savingProductFlow, setSavingProductFlow] = React.useState(false);

    const [serviceFlowType, setServiceFlowType] = React.useState<ServiceFlowType>('tooth');
    const [serviceRows, setServiceRows] = React.useState<ServiceRow[]>([]);
    const [productRows, setProductRows] = React.useState<ProductRow[]>([]);

    const orderedTeeth = React.useMemo(() => {
        if (teeth.length > 0) return teeth;
        return INTERNATIONAL_NUMBERS.map((internationalNumber, index) => ({
            id: -(index + 1),
            sequence: index + 1,
            international_number: internationalNumber,
        }));
    }, [teeth]);

    const toothById = React.useMemo(() => {
        const map = new Map<number, ToothItem>();
        for (const tooth of teeth) map.set(tooth.id, tooth);
        return map;
    }, [teeth]);

    const activeToothIds = React.useMemo(() => {
        const ids = new Set<number>();
        for (const proc of procedures) {
            if (!proc.is_product && proc.tooth != null) ids.add(proc.tooth);
        }
        return ids;
    }, [procedures]);

    const groupedProcedures = React.useMemo(() => {
        const groups = new Map<string, ProcedureItem[]>();
        const nonProducts = procedures.filter(proc => !proc.is_product);

        for (const proc of nonProducts) {
            const key = dateKeyFromProcedure(proc);
            const list = groups.get(key) ?? [];
            list.push(proc);
            groups.set(key, list);
        }

        return Array.from(groups.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, list]) => ({
                key,
                label: formatDate(key),
                procedures: list.sort((a, b) => a.id - b.id),
            }));
    }, [procedures]);

    const loadArcade = React.useCallback(async () => {
        if (!canAccess || !numericClientId) return;

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
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : 'Nao foi possivel carregar os dados da arcada.';
            setError(message || 'Nao foi possivel carregar os dados da arcada.');
        } finally {
            setLoading(false);
        }
    }, [canAccess, numericClientId]);

    React.useEffect(() => {
        void loadArcade();
    }, [loadArcade]);

    function openServiceFlowModal() {
        const defaultToothId = selectedToothId ?? teeth[0]?.id ?? null;
        setServiceFlowType('tooth');
        setServiceRows([
            {
                toothId: defaultToothId,
                phase: '',
                treatment: '',
                value: '',
                notes: '',
            },
        ]);
        setServiceFlowOpen(true);
    }

    function toggleToothServiceRow(toothId: number) {
        setServiceRows(prev => {
            const exists = prev.some(row => row.toothId === toothId);
            if (exists) {
                return prev.filter(row => row.toothId !== toothId);
            }
            return [
                ...prev,
                {
                    toothId,
                    phase: '',
                    treatment: '',
                    value: '',
                    notes: '',
                },
            ];
        });
    }

    function openProductFlowModal() {
        setProductRows([{ name: '', value: '' }]);
        setProductFlowOpen(true);
    }

    function closeServiceFlowModal() {
        if (!savingServiceFlow) setServiceFlowOpen(false);
    }

    function closeProductFlowModal() {
        if (!savingProductFlow) setProductFlowOpen(false);
    }

    async function saveServiceFlow() {
        if (!arcade || serviceRows.length === 0) return;

        for (const row of serviceRows) {
            if (!row.treatment.trim()) {
                emit('systemMessage', {
                    text: 'Preencha o tratamento em todas as linhas de servico.',
                    type: 'warning',
                });
                return;
            }
            if (serviceFlowType === 'tooth' && row.toothId == null) {
                emit('systemMessage', {
                    text: 'Selecione o dente em todas as linhas por dente.',
                    type: 'warning',
                });
                return;
            }
            if (row.value.trim()) {
                const validation = validateAmount(row.value);
                if (!validation.valid) {
                    emit('systemMessage', {
                        text: validation.message || 'Valor invalido.',
                        type: 'warning',
                    });
                    return;
                }
            }
        }

        setSavingServiceFlow(true);
        try {
            for (const row of serviceRows) {
                const amount = row.value.trim() ? parseAmount(row.value) : null;
                await apiFetch('/odonto/procedures/', {
                    method: 'POST',
                    body: {
                        arcade: arcade.id,
                        tooth: serviceFlowType === 'tooth' ? row.toothId : null,
                        surface: null,
                        faces_raw: row.phase,
                        code: '',
                        name: row.treatment.trim(),
                        status: 'pending',
                        started_at: todayISODate(),
                        completed_at: null,
                        patient_amount: amount,
                        paid_amount: null,
                        notes: row.notes.trim(),
                        is_active: true,
                        is_product: false,
                    },
                });
            }

            closeServiceFlowModal();
            await loadArcade();
            emit('systemMessage', {
                text: 'Servicos salvos com sucesso.',
                type: 'success',
            });
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : 'Nao foi possivel salvar os servicos.';
            emit('systemMessage', {
                text: message || 'Nao foi possivel salvar os servicos.',
                type: 'error',
            });
        } finally {
            setSavingServiceFlow(false);
        }
    }

    async function saveProductFlow() {
        if (!arcade) return;

        const validProducts = productRows.filter(row => row.name.trim());
        if (validProducts.length === 0) {
            emit('systemMessage', {
                text: 'Adicione pelo menos um produto com nome.',
                type: 'warning',
            });
            return;
        }

        for (const row of validProducts) {
            if (row.value.trim()) {
                const validation = validateAmount(row.value);
                if (!validation.valid) {
                    emit('systemMessage', {
                        text: validation.message || 'Valor invalido.',
                        type: 'warning',
                    });
                    return;
                }
            }
        }

        setSavingProductFlow(true);
        try {
            const dateToUse = todayISODate();
            const parent = (await apiFetch('/odonto/procedures/', {
                method: 'POST',
                body: {
                    arcade: arcade.id,
                    tooth: null,
                    surface: null,
                    faces_raw: '',
                    code: '',
                    name: 'Produtos usados',
                    status: 'pending',
                    started_at: dateToUse,
                    completed_at: null,
                    patient_amount: null,
                    paid_amount: null,
                    notes: '',
                    is_active: true,
                    is_product: false,
                },
            })) as { id: number };

            for (const row of validProducts) {
                const amount = row.value.trim() ? parseAmount(row.value) : null;
                await apiFetch('/odonto/procedures/', {
                    method: 'POST',
                    body: {
                        arcade: arcade.id,
                        tooth: null,
                        surface: null,
                        faces_raw: '',
                        code: '',
                        name: row.name.trim(),
                        status: 'pending',
                        started_at: dateToUse,
                        completed_at: null,
                        patient_amount: amount,
                        paid_amount: null,
                        notes: '',
                        is_active: true,
                        is_product: true,
                        parent_procedure: parent.id,
                    },
                });
            }

            closeProductFlowModal();
            await loadArcade();
            emit('systemMessage', {
                text: 'Produtos salvos com sucesso.',
                type: 'success',
            });
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : 'Nao foi possivel salvar os produtos.';
            emit('systemMessage', {
                text: message || 'Nao foi possivel salvar os produtos.',
                type: 'error',
            });
        } finally {
            setSavingProductFlow(false);
        }
    }

    async function deleteProcedure(procId: number) {
        if (!window.confirm('Deseja apagar este item?')) return;
        try {
            await apiFetch(`/odonto/procedures/${procId}/`, { method: 'DELETE' });
            await loadArcade();
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : 'Nao foi possivel apagar o item.';
            emit('systemMessage', {
                text: message || 'Nao foi possivel apagar o item.',
                type: 'error',
            });
        }
    }

    if (!canAccess) {
        return (
            <div className={styles.page}>
                <h1 className={styles.title}>Arcada odontologica</h1>
                <p className={styles.text}>
                    Este modulo esta disponivel apenas para profissionais da area odontologica.
                </p>
                <button type='button' onClick={() => navigate('/')} className={styles.btn}>
                    Voltar
                </button>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.headerCard}>
                <div>
                    <h1 className={styles.title}>Arcada odontologica</h1>
                    <p className={styles.subtitle}>{clientName ?? `Cliente #${clientId}`}</p>
                </div>
                <div className={styles.headerActions}>
                    <button
                        type='button'
                        onClick={openServiceFlowModal}
                        className={styles.btnPrimary}
                        disabled={!arcade}
                    >
                        + Novo servico
                    </button>
                    <button
                        type='button'
                        onClick={openProductFlowModal}
                        className={styles.btn}
                        disabled={!arcade}
                    >
                        + Produto
                    </button>
                    <button type='button' onClick={() => navigate('/')} className={styles.btn}>
                        Voltar para clientes
                    </button>
                </div>
            </header>

            {loading && <p className={styles.text}>Carregando...</p>}

            {!loading && error && <div className={styles.errorCard}>{error}</div>}

            {!loading && !error && !arcade && (
                <div className={styles.emptyCard}>
                    <p className={styles.text}>Este cliente ainda nao possui arcada cadastrada.</p>
                </div>
            )}

            {!loading && !error && arcade && (
                <>
                    <section className={styles.card}>
                        <div className={styles.sectionHeaderRow}>
                            <h2 className={styles.sectionTitle}>Mapa da arcada</h2>
                            <button
                                type='button'
                                className={styles.viewBtn}
                                onClick={() => setMapVisible(prev => !prev)}
                                aria-label={mapVisible ? 'Ocultar mapa da arcada' : 'Ver mapa da arcada'}
                                title={mapVisible ? 'Ocultar mapa da arcada' : 'Ver mapa da arcada'}
                            >
                                <svg viewBox='0 0 24 24' aria-hidden='true' className={styles.viewIcon}>
                                    <path
                                        d='M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z'
                                        fill='none'
                                        stroke='currentColor'
                                        strokeWidth='1.8'
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    />
                                    <circle cx='12' cy='12' r='3.2' fill='none' stroke='currentColor' strokeWidth='1.8' />
                                </svg>
                                {mapVisible ? 'Ocultar' : 'Ver'}
                            </button>
                        </div>
                        {mapVisible && (
                            <>
                                <div className={styles.gridWrap}>
                                    <OdontoToothGrid
                                        orderedTeeth={orderedTeeth}
                                        selectedToothId={selectedToothId}
                                        suppressDateHighlights={false}
                                        activeDateToothIds={activeToothIds}
                                        onToothClick={setSelectedToothId}
                                    />
                                </div>
                                <p className={styles.textMuted}>
                                    Toque em um dente para marcar visualmente a selecao.
                                </p>
                            </>
                        )}
                    </section>

                    <section className={styles.card}>
                        <h2 className={styles.sectionTitle}>Atendimentos</h2>
                        {groupedProcedures.length === 0 ? (
                            <p className={styles.textMuted}>Nenhum procedimento cadastrado.</p>
                        ) : (
                            <div className={styles.groupList}>
                                {groupedProcedures.map(group => (
                                    <div key={group.key} className={styles.groupCard}>
                                        <strong className={styles.groupDate}>{group.label}</strong>
                                        {group.procedures.map(proc => {
                                            const tooth = proc.tooth ? toothById.get(proc.tooth) : null;
                                            const products = procedures.filter(
                                                item => item.is_product && item.parent_procedure === proc.id,
                                            );

                                            return (
                                                <div key={proc.id} className={styles.procItem}>
                                                    <div className={styles.procMain}>
                                                        <div>
                                                            <strong>{proc.name}</strong>
                                                            <p className={styles.textMuted}>
                                                                {tooth
                                                                    ? `Dente ${tooth.international_number}`
                                                                    : 'Arcada / Outros'}
                                                            </p>
                                                        </div>
                                                        <div className={styles.procActions}>
                                                            <span className={styles.value}>
                                                                {formatMoney(proc.patient_amount)}
                                                            </span>
                                                            <button
                                                                type='button'
                                                                className={styles.iconBtnDanger}
                                                                onClick={() => void deleteProcedure(proc.id)}
                                                            >
                                                                Apagar
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {products.length > 0 && (
                                                        <div className={styles.productsBlock}>
                                                            {products.map(product => (
                                                                <div key={product.id} className={styles.productRow}>
                                                                    <span>{product.name}</span>
                                                                    <div className={styles.procActions}>
                                                                        <span className={styles.value}>
                                                                            {formatMoney(product.patient_amount)}
                                                                        </span>
                                                                        <button
                                                                            type='button'
                                                                            className={styles.iconBtnDanger}
                                                                            onClick={() => void deleteProcedure(product.id)}
                                                                        >
                                                                            Apagar
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}

            {serviceFlowOpen && (
                <div className={styles.modalOverlay} role='presentation' onClick={closeServiceFlowModal}>
                    <div className={styles.modalCard} role='dialog' onClick={event => event.stopPropagation()}>
                        <h3 className={styles.sectionTitle}>Novo servico</h3>

                        <div className={styles.typeTabs}>
                            <button
                                type='button'
                                onClick={() => setServiceFlowType('tooth')}
                                className={`${styles.tabBtn} ${serviceFlowType === 'tooth' ? styles.tabActive : ''}`}
                                disabled={savingServiceFlow}
                            >
                                Por dente
                            </button>
                            <button
                                type='button'
                                onClick={() => setServiceFlowType('arcade')}
                                className={`${styles.tabBtn} ${serviceFlowType === 'arcade' ? styles.tabActive : ''}`}
                                disabled={savingServiceFlow}
                            >
                                Arcada
                            </button>
                            <button
                                type='button'
                                onClick={() => setServiceFlowType('other')}
                                className={`${styles.tabBtn} ${serviceFlowType === 'other' ? styles.tabActive : ''}`}
                                disabled={savingServiceFlow}
                            >
                                Outros
                            </button>
                        </div>

                        {serviceFlowType === 'tooth' && (
                            <div className={styles.modalToothSelector}>
                                <OdontoToothGrid
                                    orderedTeeth={orderedTeeth}
                                    selectedToothId={null}
                                    suppressDateHighlights={false}
                                    activeDateToothIds={new Set(serviceRows.map(row => row.toothId).filter((id): id is number => id != null))}
                                    onToothClick={toggleToothServiceRow}
                                />
                            </div>
                        )}

                        <div className={styles.modalRows}>
                            {serviceRows.map((row, index) => (
                                <div key={index} className={styles.modalRow}>
                                    <div className={styles.modalRowHeader}>
                                        <strong>
                                            {row.toothId != null
                                                ? `Dente ${toothById.get(row.toothId)?.international_number ?? row.toothId}`
                                                : `Linha ${index + 1}`}
                                        </strong>
                                        <label className={styles.phaseInlineLabel}>
                                            Fases
                                            <select
                                                className={styles.input}
                                                value={row.phase}
                                                onChange={event =>
                                                    setServiceRows(prev =>
                                                        prev.map((item, i) =>
                                                            i === index
                                                                ? { ...item, phase: event.target.value }
                                                                : item,
                                                        ),
                                                    )
                                                }
                                                disabled={savingServiceFlow}
                                            >
                                                {PHASE_OPTIONS.map(option => (
                                                    <option key={option || 'empty'} value={option}>
                                                        {option || 'Opcional'}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>

                                    <div className={styles.formGrid}>
                                        <label className={styles.label}>
                                            Tratamento
                                            <input
                                                className={styles.input}
                                                value={row.treatment}
                                                onChange={event =>
                                                    setServiceRows(prev =>
                                                        prev.map((item, i) =>
                                                            i === index
                                                                ? { ...item, treatment: event.target.value }
                                                                : item,
                                                        ),
                                                    )
                                                }
                                                disabled={savingServiceFlow}
                                            />
                                        </label>

                                        <label className={styles.label}>
                                            Valor (R$)
                                            <input
                                                className={styles.input}
                                                inputMode='decimal'
                                                value={row.value}
                                                placeholder='0,00'
                                                onChange={event =>
                                                    setServiceRows(prev =>
                                                        prev.map((item, i) =>
                                                            i === index
                                                                ? { ...item, value: event.target.value }
                                                                : item,
                                                        ),
                                                    )
                                                }
                                                onBlur={event =>
                                                    setServiceRows(prev =>
                                                        prev.map((item, i) =>
                                                            i === index
                                                                ? {
                                                                      ...item,
                                                                      value: normalizeMoneyInput(event.target.value),
                                                                  }
                                                                : item,
                                                        ),
                                                    )
                                                }
                                                disabled={savingServiceFlow}
                                            />
                                        </label>

                                        <label className={styles.labelWide}>
                                            Observacoes
                                            <textarea
                                                className={styles.textarea}
                                                rows={3}
                                                value={row.notes}
                                                onChange={event =>
                                                    setServiceRows(prev =>
                                                        prev.map((item, i) =>
                                                            i === index
                                                                ? { ...item, notes: event.target.value }
                                                                : item,
                                                        ),
                                                    )
                                                }
                                                disabled={savingServiceFlow}
                                            />
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                type='button'
                                className={styles.btn}
                                onClick={() =>
                                    setServiceRows(prev => [
                                        ...prev,
                                        {
                                            toothId: serviceFlowType === 'tooth' ? null : selectedToothId ?? teeth[0]?.id ?? null,
                                            phase: '',
                                            treatment: '',
                                            value: '',
                                            notes: '',
                                        },
                                    ])
                                }
                                disabled={savingServiceFlow || serviceFlowType === 'tooth'}
                            >
                                + Linha
                            </button>
                            <button type='button' className={styles.btn} onClick={closeServiceFlowModal}>
                                Cancelar
                            </button>
                            <button
                                type='button'
                                className={styles.btnPrimary}
                                onClick={() => void saveServiceFlow()}
                                disabled={savingServiceFlow}
                            >
                                {savingServiceFlow ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {productFlowOpen && (
                <div className={styles.modalOverlay} role='presentation' onClick={closeProductFlowModal}>
                    <div className={styles.modalCard} role='dialog' onClick={event => event.stopPropagation()}>
                        <h3 className={styles.sectionTitle}>Novo fluxo de produtos</h3>

                        <div className={styles.modalRows}>
                            {productRows.map((row, index) => (
                                <div key={index} className={styles.modalRow}>
                                    <div className={styles.modalRowHeader}>
                                        <strong>Produto {index + 1}</strong>
                                        <button
                                            type='button'
                                            className={styles.iconBtnDanger}
                                            onClick={() =>
                                                setProductRows(prev => prev.filter((_, i) => i !== index))
                                            }
                                            disabled={savingProductFlow || productRows.length === 1}
                                        >
                                            Remover
                                        </button>
                                    </div>

                                    <div className={styles.formGrid}>
                                        <label className={styles.label}>
                                            Nome
                                            <input
                                                className={styles.input}
                                                value={row.name}
                                                onChange={event =>
                                                    setProductRows(prev =>
                                                        prev.map((item, i) =>
                                                            i === index
                                                                ? { ...item, name: event.target.value }
                                                                : item,
                                                        ),
                                                    )
                                                }
                                                disabled={savingProductFlow}
                                            />
                                        </label>
                                        <label className={styles.label}>
                                            Valor
                                            <input
                                                className={styles.input}
                                                inputMode='decimal'
                                                value={row.value}
                                                placeholder='0,00'
                                                onChange={event =>
                                                    setProductRows(prev =>
                                                        prev.map((item, i) =>
                                                            i === index
                                                                ? { ...item, value: event.target.value }
                                                                : item,
                                                        ),
                                                    )
                                                }
                                                disabled={savingProductFlow}
                                            />
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                type='button'
                                className={styles.btn}
                                onClick={() => setProductRows(prev => [...prev, { name: '', value: '' }])}
                                disabled={savingProductFlow}
                            >
                                + Produto
                            </button>
                            <button type='button' className={styles.btn} onClick={closeProductFlowModal}>
                                Cancelar
                            </button>
                            <button
                                type='button'
                                className={styles.btnPrimary}
                                onClick={() => void saveProductFlow()}
                                disabled={savingProductFlow}
                            >
                                {savingProductFlow ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
