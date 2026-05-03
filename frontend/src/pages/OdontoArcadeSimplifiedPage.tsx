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

const PHASE_OPTIONS: Array<{ value: string; label: string }> = [
    { value: '', label: 'Opcional' },
    { value: 'O', label: 'Oclusal' },
    { value: 'V', label: 'Vestibular' },
    { value: 'P', label: 'Palatino' },
    { value: 'M', label: 'Mesial' },
    { value: 'D', label: 'Distal' },
    { value: 'MO', label: 'Mesio-oclusal' },
    { value: 'DO', label: 'Disto-oclusal' },
    { value: 'VO', label: 'Vestibulo-oclusal' },
    { value: 'PO', label: 'Palatino-oclusal' },
    { value: 'MDO', label: 'Mesio-disto-oclusal' },
];

const ARCADE_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'SUPERIOR', label: 'Superior' },
    { value: 'INFERIOR', label: 'Inferior' },
    { value: 'AMBAS', label: 'Ambas' },
];

function normalizeMoneyInput(value: string): string {
    const parsed = parseAmount(value);
    if (parsed == null) return value;
    return toInputAmount(parsed.toFixed(2));
}

function normalizeSearchText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
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
    const [expandedProcedureIds, setExpandedProcedureIds] = React.useState<Set<number>>(
        new Set(),
    );
    const [editingProcedure, setEditingProcedure] = React.useState<ProcedureItem | null>(null);
    const [editingProcedureName, setEditingProcedureName] = React.useState('');
    const [editingProcedureValue, setEditingProcedureValue] = React.useState('');
    const [editingProcedureNotes, setEditingProcedureNotes] = React.useState('');
    const [savingEditProcedure, setSavingEditProcedure] = React.useState(false);

    const [serviceFlowType, setServiceFlowType] = React.useState<ServiceFlowType>('tooth');
    const [serviceRows, setServiceRows] = React.useState<ServiceRow[]>([]);
    const [productRows, setProductRows] = React.useState<ProductRow[]>([]);
    const [procedureNames, setProcedureNames] = React.useState<string[]>([]);
    const [openTreatmentDropdownIndex, setOpenTreatmentDropdownIndex] = React.useState<number | null>(null);
    const [savingSuggestionIndex, setSavingSuggestionIndex] = React.useState<number | null>(null);

    const arcadeLabelByValue = React.useMemo(
        () =>
            new Map(ARCADE_OPTIONS.map(option => [option.value, option.label])),
        [],
    );

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

    const loadProcedureNames = React.useCallback(async () => {
        try {
            const response = await apiFetch('/odonto/procedures/distinct-names/');
            if (response && typeof response === 'object' && 'names' in response) {
                const names = Array.isArray(response.names)
                    ? (response.names as string[])
                          .map(name => String(name))
                          .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
                    : [];
                setProcedureNames(names);
            }
        } catch {
            // Keep UX functional with empty suggestions if fetch fails.
        }
    }, []);

    React.useEffect(() => {
        if (!serviceFlowOpen) return;
        void loadProcedureNames();
    }, [serviceFlowOpen, loadProcedureNames]);

    function openServiceFlowModal() {
        setServiceFlowType('tooth');
        setServiceRows([]);
        setOpenTreatmentDropdownIndex(null);
        setServiceFlowOpen(true);
    }

    function buildEmptyServiceRow(flowType: ServiceFlowType): ServiceRow {
        return {
            toothId: null,
            phase: flowType === 'arcade' ? 'AMBAS' : '',
            treatment: '',
            value: '',
            notes: '',
        };
    }

    function changeServiceFlowType(nextType: ServiceFlowType) {
        if (nextType === serviceFlowType) return;

        setServiceFlowType(nextType);
        setOpenTreatmentDropdownIndex(null);

        setServiceRows(prev => {
            if (nextType === 'tooth') {
                return [];
            }

            if (serviceFlowType === 'tooth') {
                return [buildEmptyServiceRow(nextType)];
            }

            if (prev.length === 0) {
                return [buildEmptyServiceRow(nextType)];
            }

            return prev.map(item => ({
                ...item,
                toothId: null,
                phase: nextType === 'arcade' ? item.phase || 'AMBAS' : '',
            }));
        });
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
        if (!savingServiceFlow) {
            setServiceFlowOpen(false);
            setOpenTreatmentDropdownIndex(null);
        }
    }

    function closeProductFlowModal() {
        if (!savingProductFlow) setProductFlowOpen(false);
    }

    async function saveServiceFlow() {
        if (!arcade) return;
        if (serviceRows.length === 0) {
            emit('systemMessage', {
                text: 'Selecione ao menos um dente no mapa para criar o servico.',
                type: 'warning',
            });
            return;
        }

        for (const row of serviceRows) {
            if (!row.treatment.trim()) {
                emit('systemMessage', {
                    text: 'Preencha o tratamento em todos os itens de servico.',
                    type: 'warning',
                });
                return;
            }
            if (serviceFlowType === 'tooth' && row.toothId == null) {
                emit('systemMessage', {
                    text: 'Selecione o dente em todos os itens por dente.',
                    type: 'warning',
                });
                return;
            }
            if (serviceFlowType === 'arcade' && !row.phase) {
                emit('systemMessage', {
                    text: 'Selecione Superior, Inferior ou Ambas em todos os itens.',
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

    function updateServiceRow(index: number, patch: Partial<ServiceRow>) {
        setServiceRows(prev =>
            prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
        );
    }

    function filteredProcedureNames(searchRaw: string): string[] {
        const sortedNames = [...procedureNames].sort((a, b) =>
            a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
        );
        const search = normalizeSearchText(searchRaw);
        if (!search) return sortedNames.slice(0, 24);

        return sortedNames
            .filter(name => normalizeSearchText(name).includes(search))
            .sort((a, b) => {
                const aNormalized = normalizeSearchText(a);
                const bNormalized = normalizeSearchText(b);
                const aStarts = aNormalized.startsWith(search) ? 0 : 1;
                const bStarts = bNormalized.startsWith(search) ? 0 : 1;
                if (aStarts !== bStarts) return aStarts - bStarts;

                const aIndex = aNormalized.indexOf(search);
                const bIndex = bNormalized.indexOf(search);
                if (aIndex !== bIndex) return aIndex - bIndex;

                return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
            })
            .slice(0, 24);
    }

    function treatmentExistsInSuggestions(treatmentRaw: string): boolean {
        const normalized = treatmentRaw.trim().toLowerCase();
        if (!normalized) return false;
        return procedureNames.some(name => name.trim().toLowerCase() === normalized);
    }

    async function saveTreatmentSuggestion(index: number) {
        const row = serviceRows[index];
        if (!row || !arcade) return;
        const name = row.treatment.trim();
        if (!name || treatmentExistsInSuggestions(name)) return;

        setSavingSuggestionIndex(index);
        try {
            await apiFetch('/odonto/procedures/suggest-name/', {
                method: 'POST',
                body: {
                    name,
                    arcade_id: arcade.id,
                },
            });
            await loadProcedureNames();
            emit('systemMessage', {
                text: `Tratamento "${name}" salvo na lista.`,
                type: 'success',
            });
        } catch {
            emit('systemMessage', {
                text: 'Nao foi possivel salvar o tratamento na lista.',
                type: 'error',
            });
        } finally {
            setSavingSuggestionIndex(null);
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

    function toggleProcedureDetails(procId: number) {
        setExpandedProcedureIds(prev => {
            const next = new Set(prev);
            if (next.has(procId)) {
                next.delete(procId);
            } else {
                next.add(procId);
            }
            return next;
        });
    }

    function openEditProcedure(proc: ProcedureItem) {
        setEditingProcedure(proc);
        setEditingProcedureName(proc.name || '');
        setEditingProcedureValue(toInputAmount(proc.patient_amount ?? ''));
        setEditingProcedureNotes(proc.notes || '');
    }

    function closeEditProcedureModal() {
        if (!savingEditProcedure) {
            setEditingProcedure(null);
        }
    }

    async function saveEditedProcedure() {
        if (!editingProcedure) return;
        const name = editingProcedureName.trim();
        if (!name) {
            emit('systemMessage', {
                text: 'Informe o nome do tratamento.',
                type: 'warning',
            });
            return;
        }

        if (editingProcedureValue.trim()) {
            const validation = validateAmount(editingProcedureValue, 'Valor');
            if (!validation.valid) {
                emit('systemMessage', {
                    text: validation.message || 'Valor invalido.',
                    type: 'warning',
                });
                return;
            }
        }

        setSavingEditProcedure(true);
        try {
            await apiFetch(`/odonto/procedures/${editingProcedure.id}/`, {
                method: 'PATCH',
                body: {
                    name,
                    patient_amount: editingProcedureValue.trim()
                        ? parseAmount(editingProcedureValue)
                        : null,
                    notes: editingProcedureNotes.trim(),
                },
            });

            closeEditProcedureModal();
            await loadArcade();
            emit('systemMessage', {
                text: 'Item atualizado com sucesso.',
                type: 'success',
            });
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : 'Nao foi possivel atualizar o item.';
            emit('systemMessage', {
                text: message || 'Nao foi possivel atualizar o item.',
                type: 'error',
            });
        } finally {
            setSavingEditProcedure(false);
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
                                            const isExpanded = expandedProcedureIds.has(proc.id);
                                            const isArcadeItem = !proc.tooth && proc.faces_raw;
                                            const phaseLabel = isArcadeItem
                                                ? arcadeLabelByValue.get(proc.faces_raw || '') || proc.faces_raw
                                                : proc.faces_raw || '-';

                                            return (
                                                <div key={proc.id} className={styles.procItem}>
                                                    <div className={styles.procMain}>
                                                        <div className={styles.procInfoBlock}>
                                                            <div className={styles.procTitleRow}>
                                                                <strong>{proc.name}</strong>
                                                                <button
                                                                    type='button'
                                                                    className={`${styles.miniActionBtn} ${styles.miniActionDetail}`}
                                                                    onClick={() => toggleProcedureDetails(proc.id)}
                                                                >
                                                                    {isExpanded ? 'Ocultar' : 'Detalhes'}
                                                                </button>
                                                            </div>
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
                                                                className={`${styles.miniActionBtn} ${styles.miniActionEdit}`}
                                                                onClick={() => openEditProcedure(proc)}
                                                            >
                                                                Editar
                                                            </button>
                                                            <button
                                                                type='button'
                                                                className={`${styles.miniActionBtn} ${styles.miniActionDelete}`}
                                                                onClick={() => void deleteProcedure(proc.id)}
                                                            >
                                                                Apagar
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {isExpanded && (
                                                        <div className={styles.procDetailsBox}>
                                                            <p className={styles.textMuted}>
                                                                <strong>Tipo:</strong>{' '}
                                                                {tooth ? 'Por dente' : isArcadeItem ? 'Arcada' : 'Outros'}
                                                            </p>
                                                            <p className={styles.textMuted}>
                                                                <strong>{isArcadeItem ? 'Arcada:' : 'Fases:'}</strong>{' '}
                                                                {phaseLabel}
                                                            </p>
                                                            {proc.notes && (
                                                                <p className={styles.textMuted}>
                                                                    <strong>Observações:</strong> {proc.notes}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}

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
                                                                            className={`${styles.miniActionBtn} ${styles.miniActionEdit}`}
                                                                            onClick={() => openEditProcedure(product)}
                                                                        >
                                                                            Editar
                                                                        </button>
                                                                        <button
                                                                            type='button'
                                                                            className={`${styles.miniActionBtn} ${styles.miniActionDelete}`}
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
                                onClick={() => changeServiceFlowType('tooth')}
                                className={`${styles.tabBtn} ${serviceFlowType === 'tooth' ? styles.tabActive : ''}`}
                                disabled={savingServiceFlow}
                            >
                                Por dente
                            </button>
                            <button
                                type='button'
                                onClick={() => changeServiceFlowType('arcade')}
                                className={`${styles.tabBtn} ${serviceFlowType === 'arcade' ? styles.tabActive : ''}`}
                                disabled={savingServiceFlow}
                            >
                                Arcada
                            </button>
                            <button
                                type='button'
                                onClick={() => changeServiceFlowType('other')}
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

                        {serviceFlowType === 'tooth' && serviceRows.length === 0 && (
                            <p className={styles.textMuted}>
                                Toque nos dentes do mapa para adicionar os containers do servico.
                            </p>
                        )}

                        <div className={styles.modalRows}>
                            {serviceRows.map((row, index) => {
                                const treatmentSuggestions = filteredProcedureNames(row.treatment);

                                return <div key={index} className={styles.modalRow}>
                                    <div className={styles.modalRowHeader}>
                                        <strong>
                                            {row.toothId != null
                                                ? `Dente ${toothById.get(row.toothId)?.international_number ?? row.toothId}`
                                                : `Item ${index + 1}`}
                                        </strong>
                                        {(serviceFlowType === 'tooth' || serviceFlowType === 'arcade') && (
                                            <label className={styles.phaseInlineLabel}>
                                                {serviceFlowType === 'arcade'
                                                    ? 'Arcada'
                                                    : 'Fases (opcional)'}
                                                <select
                                                    className={`${styles.input} ${styles.phaseSelect}`}
                                                    value={row.phase}
                                                    onChange={event =>
                                                        updateServiceRow(index, {
                                                            phase: event.target.value,
                                                        })
                                                    }
                                                    disabled={savingServiceFlow}
                                                >
                                                    {(serviceFlowType === 'arcade'
                                                        ? ARCADE_OPTIONS
                                                        : PHASE_OPTIONS
                                                    ).map(option => (
                                                        <option
                                                            key={option.value || 'empty'}
                                                            value={option.value}
                                                        >
                                                            {serviceFlowType === 'arcade'
                                                                ? option.label
                                                                : option.value
                                                                  ? `${option.value} - ${option.label}`
                                                                  : option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}
                                    </div>

                                    <div className={styles.formGrid}>
                                        <label className={styles.label}>
                                            Tratamento
                                            <div className={styles.autocompleteWrap}>
                                                <input
                                                    className={styles.input}
                                                    value={row.treatment}
                                                    onFocus={() => setOpenTreatmentDropdownIndex(index)}
                                                    onBlur={() =>
                                                        window.setTimeout(() => {
                                                            setOpenTreatmentDropdownIndex(current =>
                                                                current === index ? null : current,
                                                            );
                                                        }, 160)
                                                    }
                                                    onChange={event => {
                                                        updateServiceRow(index, { treatment: event.target.value });
                                                        setOpenTreatmentDropdownIndex(index);
                                                    }}
                                                    disabled={savingServiceFlow}
                                                    autoComplete='off'
                                                    placeholder='Ex.: Restauracao em resina'
                                                />

                                                {openTreatmentDropdownIndex === index && (
                                                    <div className={styles.autocompleteList}>
                                                        {treatmentSuggestions.length === 0 ? (
                                                            <div className={styles.autocompleteEmpty}>
                                                                Nenhuma sugestao encontrada.
                                                            </div>
                                                        ) : (
                                                            treatmentSuggestions.map(name => (
                                                                <button
                                                                    key={name}
                                                                    type='button'
                                                                    className={styles.autocompleteItem}
                                                                    onMouseDown={event => event.preventDefault()}
                                                                    onClick={() => {
                                                                        updateServiceRow(index, { treatment: name });
                                                                        setOpenTreatmentDropdownIndex(null);
                                                                    }}
                                                                >
                                                                    {name}
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {!treatmentExistsInSuggestions(row.treatment) && row.treatment.trim() && (
                                                <button
                                                    type='button'
                                                    className={styles.saveSuggestionBtn}
                                                    onMouseDown={event => event.preventDefault()}
                                                    onClick={() => void saveTreatmentSuggestion(index)}
                                                    disabled={savingServiceFlow || savingSuggestionIndex === index}
                                                >
                                                    {savingSuggestionIndex === index
                                                        ? 'Salvando...'
                                                        : `✓ Salvar "${row.treatment.trim()}" na lista`}
                                                </button>
                                            )}
                                        </label>

                                        <label className={styles.label}>
                                            Valor (R$)
                                            <input
                                                className={styles.input}
                                                inputMode='decimal'
                                                value={row.value}
                                                placeholder='0,00'
                                                onChange={event =>
                                                    updateServiceRow(index, { value: event.target.value })
                                                }
                                                onBlur={event =>
                                                    updateServiceRow(index, {
                                                        value: normalizeMoneyInput(event.target.value),
                                                    })
                                                }
                                                disabled={savingServiceFlow}
                                            />
                                        </label>

                                        <label className={styles.labelWide}>
                                            Observações
                                            <textarea
                                                className={styles.textarea}
                                                rows={3}
                                                value={row.notes}
                                                onChange={event =>
                                                    updateServiceRow(index, { notes: event.target.value })
                                                }
                                                disabled={savingServiceFlow}
                                            />
                                        </label>
                                    </div>
                                </div>;
                            })}
                        </div>

                        <div className={styles.modalActions}>
                            {serviceFlowType !== 'tooth' && (
                                <button
                                    type='button'
                                    className={styles.btn}
                                    onClick={() =>
                                        setServiceRows(prev => [
                                            ...prev,
                                            buildEmptyServiceRow(serviceFlowType),
                                        ])
                                    }
                                    disabled={savingServiceFlow}
                                >
                                    + Item
                                </button>
                            )}
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

            {editingProcedure && (
                <div className={styles.modalOverlay} role='presentation' onClick={closeEditProcedureModal}>
                    <div className={styles.modalCard} role='dialog' onClick={event => event.stopPropagation()}>
                        <h3 className={styles.sectionTitle}>Editar item</h3>
                        <div className={styles.formGrid}>
                            <label className={styles.labelWide}>
                                Tratamento
                                <input
                                    className={styles.input}
                                    value={editingProcedureName}
                                    onChange={event => setEditingProcedureName(event.target.value)}
                                    disabled={savingEditProcedure}
                                />
                            </label>
                            <label className={styles.label}>
                                Valor (R$)
                                <input
                                    className={styles.input}
                                    inputMode='decimal'
                                    value={editingProcedureValue}
                                    onChange={event => setEditingProcedureValue(event.target.value)}
                                    onBlur={event =>
                                        setEditingProcedureValue(normalizeMoneyInput(event.target.value))
                                    }
                                    disabled={savingEditProcedure}
                                />
                            </label>
                            <label className={styles.labelWide}>
                                Observações
                                <textarea
                                    className={styles.textarea}
                                    rows={3}
                                    value={editingProcedureNotes}
                                    onChange={event => setEditingProcedureNotes(event.target.value)}
                                    disabled={savingEditProcedure}
                                />
                            </label>
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                type='button'
                                className={styles.btn}
                                onClick={closeEditProcedureModal}
                                disabled={savingEditProcedure}
                            >
                                Cancelar
                            </button>
                            <button
                                type='button'
                                className={styles.btnPrimary}
                                onClick={() => void saveEditedProcedure()}
                                disabled={savingEditProcedure}
                            >
                                {savingEditProcedure ? 'Salvando...' : 'Salvar alterações'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
