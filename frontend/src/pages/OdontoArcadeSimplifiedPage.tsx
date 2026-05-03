import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { OdontoToothGrid } from '../components/OdontoToothGrid';
import OdontoProcedureCard from '../components/odonto/OdontoProcedureCard';
import OdontoServiceModal from '../components/odonto/OdontoServiceModal';
import OdontoProductModal from '../components/odonto/OdontoProductModal';
import OdontoEditProcedureModal from '../components/odonto/OdontoEditProcedureModal';
import { emit } from '../events/bus';
import { ApiError, apiFetch } from '../utils/apiFetch';
import { parseAmount, toInputAmount, validateAmount } from '../utils/currency';
import {
    ARCADE_OPTIONS,
    asList,
    eventDateISO,
    formatDate,
    hasOdontoAccess,
    INTERNATIONAL_NUMBERS,
    todayISODate,
} from './odontoArcadeHelpers';
import type {
    ArcadeListItem,
    ProcedureItem,
    ProductCatalogItem,
    ProductRow,
    ServiceFlowType,
    ServiceRow,
    ToothItem,
} from './odontoArcadeHelpers';
import styles from '../styles/pages/OdontoArcadeSimplifiedPage.module.css';

function dateKeyFromProcedure(proc: ProcedureItem): string {
    const eventDate = eventDateISO(proc);
    if (eventDate) return eventDate;
    const createdAt = (proc as ProcedureItem & { created_at?: string }).created_at;
    if (createdAt && createdAt.length >= 10) return createdAt.slice(0, 10);
    return todayISODate();
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
    const [savingSuggestionIndex, setSavingSuggestionIndex] = React.useState<number | null>(null);
    const [productCatalog, setProductCatalog] = React.useState<ProductCatalogItem[]>([]);
    const [savingProductSuggestionIndex, setSavingProductSuggestionIndex] = React.useState<number | null>(null);

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

    const loadProductCatalog = React.useCallback(async () => {
        try {
            const response = await apiFetch('/odonto/procedures/products/distinct-names/');
            if (response && typeof response === 'object' && 'catalog' in response) {
                const catalog = Array.isArray(response.catalog)
                    ? (response.catalog as ProductCatalogItem[])
                    : [];
                setProductCatalog(catalog);
            }
        } catch {
            // Keep UX functional with empty catalog if fetch fails.
        }
    }, []);

    React.useEffect(() => {
        if (!productFlowOpen) return;
        void loadProductCatalog();
    }, [productFlowOpen, loadProductCatalog]);

    function openServiceFlowModal() {
        setServiceFlowType('tooth');
        setServiceRows([]);
        setServiceFlowOpen(true);
    }

    function changeServiceFlowType(nextType: ServiceFlowType) {
        if (nextType === serviceFlowType) return;

        setServiceFlowType(nextType);
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
        setProductRows([{ name: '', value: '', notes: '' }]);
        setProductFlowOpen(true);
    }

    function closeServiceFlowModal() {
        if (!savingServiceFlow) setServiceFlowOpen(false);
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

    async function saveProductNameSuggestion(index: number) {
        const row = productRows[index];
        if (!row || !arcade) return;
        const name = row.name.trim();
        if (!name) return;

        setSavingProductSuggestionIndex(index);
        try {
            await apiFetch('/odonto/procedures/products/suggest-name/', {
                method: 'POST',
                body: {
                    name,
                    arcade_id: arcade.id,
                    ...(row.value.trim() && { value: row.value.replace(',', '.') }),
                },
            });
            await loadProductCatalog();
            emit('systemMessage', {
                text: `Produto "${name}" salvo no catálogo.`,
                type: 'success',
            });
        } catch {
            emit('systemMessage', {
                text: 'Nao foi possivel salvar o produto no catálogo.',
                type: 'error',
            });
        } finally {
            setSavingProductSuggestionIndex(null);
        }
    }

    async function saveTreatmentSuggestion(index: number) {
        const row = serviceRows[index];
        if (!row || !arcade) return;
        const name = row.treatment.trim();
        if (!name) return;

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
                        notes: row.notes.trim(),
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
                <div className={styles.headerInfo}>
                    <div className={styles.headerTitleRow}>
                        <h1 className={styles.title}>Arcada odontologica</h1>
                        <button
                            type='button'
                            onClick={() => navigate('/')}
                            className={styles.closeBtn}
                            aria-label='Voltar para clientes'
                            title='Voltar para clientes'
                        >
                            X
                        </button>
                    </div>
                    <p className={styles.subtitle}>{clientName ?? `Cliente #${clientId}`}</p>
                </div>

                <div className={styles.headerActions}>
                    <div className={styles.headerActionsBottomRow}>
                        <button
                            type='button'
                            onClick={openServiceFlowModal}
                            className={styles.btnPrimary}
                            disabled={!arcade}
                        >
                            Novo Tratamento
                        </button>

                        <button
                            type='button'
                            onClick={openProductFlowModal}
                            className={styles.btnPrimary}
                            disabled={!arcade}
                        >
                            Novo Produto
                        </button>
                    </div>
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
                                        selectedToothId={null}
                                        suppressDateHighlights={false}
                                        activeDateToothIds={activeToothIds}
                                        readOnly
                                    />
                                </div>
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
                                            const tooth = proc.tooth
                                                ? toothById.get(proc.tooth) ?? null
                                                : null;
                                            const products = procedures.filter(
                                                item =>
                                                    item.is_product &&
                                                    item.parent_procedure === proc.id,
                                            );
                                            return (
                                                <OdontoProcedureCard
                                                    key={proc.id}
                                                    proc={proc}
                                                    tooth={tooth}
                                                    products={products}
                                                    isExpanded={expandedProcedureIds.has(proc.id)}
                                                    arcadeLabelByValue={arcadeLabelByValue}
                                                    onToggleDetails={toggleProcedureDetails}
                                                    onEdit={openEditProcedure}
                                                    onDelete={id => void deleteProcedure(id)}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}

            <OdontoServiceModal
                open={serviceFlowOpen}
                saving={savingServiceFlow}
                flowType={serviceFlowType}
                serviceRows={serviceRows}
                orderedTeeth={orderedTeeth}
                toothById={toothById}
                procedureNames={procedureNames}
                savingSuggestionIndex={savingSuggestionIndex}
                onClose={closeServiceFlowModal}
                onSave={() => void saveServiceFlow()}
                onFlowTypeChange={changeServiceFlowType}
                onUpdateRow={updateServiceRow}
                onToggleToothRow={toggleToothServiceRow}
                onAddItem={() =>
                    setServiceRows(prev => [...prev, buildEmptyServiceRow(serviceFlowType)])
                }
                onSaveSuggestion={index => void saveTreatmentSuggestion(index)}
            />

            <OdontoProductModal
                open={productFlowOpen}
                saving={savingProductFlow}
                productRows={productRows}
                productCatalog={productCatalog}
                savingSuggestionIndex={savingProductSuggestionIndex}
                onClose={closeProductFlowModal}
                onSave={() => void saveProductFlow()}
                onRowsChange={setProductRows}
                onSaveSuggestion={index => void saveProductNameSuggestion(index)}
            />

            <OdontoEditProcedureModal
                procedure={editingProcedure}
                name={editingProcedureName}
                value={editingProcedureValue}
                notes={editingProcedureNotes}
                saving={savingEditProcedure}
                onNameChange={setEditingProcedureName}
                onValueChange={setEditingProcedureValue}
                onNotesChange={setEditingProcedureNotes}
                onClose={closeEditProcedureModal}
                onSave={() => void saveEditedProcedure()}
            />
        </div>
    );
}
