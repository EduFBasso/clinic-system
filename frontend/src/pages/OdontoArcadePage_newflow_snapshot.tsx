import React from 'react';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { emit } from '../events/bus';
import { ApiError, apiFetch } from '../utils/apiFetch';
import { parseAmount, validateAmount, toInputAmount } from '../utils/currency';
import { OdontoToothGrid } from '../components/OdontoToothGrid';
import {
    asList, hasOdontoAccess, eventDateISO, isProcedureCompleted,
    formatDate, formatDateShort, formatMoney, todayISODate,
    INTERNATIONAL_NUMBERS,
} from './odontoArcadeHelpers';
import type {
    ArcadeListItem, ToothItem, ProcedureItem, EditProductItem,
    ProcedureFormKind, ProcedureGroup,
} from './odontoArcadeHelpers';
import styles from '../styles/pages/OdontoArcadePage.module.css';

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
    // -1 means "not yet navigated by user" → useMemo below defaults to last (most recent) date
    const [rawActiveDateIndex, setActiveDateIndex] = React.useState(-1);

    const [serviceFlowOpen, setServiceFlowOpen] = React.useState(false);
    const [productFlowOpen, setProductFlowOpen] = React.useState(false);
    const [savingServiceFlow, setSavingServiceFlow] = React.useState(false);
    const [savingProductFlow, setSavingProductFlow] = React.useState(false);

    const [serviceFlowType, setServiceFlowType] = React.useState<
        'tooth' | 'arcade' | 'other'
    >('tooth');
    const [serviceRows, setServiceRows] = React.useState<
        Array<{
            toothId: number | null;
            name: string;
            value: string;
        }>
    >([]);

    const [productRows, setProductRows] = React.useState<
        Array<{ name: string; value: string }>
    >([]);

    const [formOpen, setFormOpen] = React.useState(false);
    const [formMode, setFormMode] = React.useState<'create' | 'edit'>('create');
    const [editingProcedureId, setEditingProcedureId] = React.useState<number | null>(
        null,
    );
    const [savingForm, setSavingForm] = React.useState(false);
    const [formError, setFormError] = React.useState<string | null>(null);
    const [procedureNames, setProcedureNames] = React.useState<string[]>([]);
    const [showProcedureDropdown, setShowProcedureDropdown] = React.useState(false);
    const [shouldSaveToList, setShouldSaveToList] = React.useState(false);
    const [inlineForm, setInlineForm] = React.useState({
        kind: 'tooth' as ProcedureFormKind,
        name: '',
        faces_raw: '',
        date: todayISODate(),
        patient_amount: '',
        notes: '',
    });

    // Product catalog and edit-mode product list
    const [productCatalog, setProductCatalog] = React.useState<{ name: string; last_value: string | null }[]>([]);
    const [editProducts, setEditProducts] = React.useState<EditProductItem[]>([]);
    const [deletedProductIds, setDeletedProductIds] = React.useState<number[]>([]);

    const filteredProcedureNames = React.useMemo(() => {
        if (!showProcedureDropdown || !inlineForm.name.trim()) {
            return procedureNames;
        }
        
        const searchTerm = inlineForm.name.toLowerCase().trim();
        return procedureNames.filter(name =>
            name.toLowerCase().includes(searchTerm)
        );
    }, [procedureNames, showProcedureDropdown, inlineForm.name]);

    const isNameInList = React.useMemo(() => {
        const normalized = inlineForm.name.toLowerCase().trim();
        return procedureNames.some(name => name.toLowerCase() === normalized);
    }, [procedureNames, inlineForm.name]);

    const productNames = React.useMemo(
        () => productCatalog.map(p => p.name),
        [productCatalog],
    );

    const productValueMap = React.useMemo(
        () => new Map(productCatalog.map(p => [p.name.toLowerCase(), p.last_value])),
        [productCatalog],
    );

    const numericClientId = React.useMemo(() => Number(clientId || 0), [clientId]);

    const loadArcade = React.useCallback(async (silent = false) => {
        if (!numericClientId || !canAccess) return;
        if (!silent) setLoading(true);
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

    // Carrega nomes de procedimentos do backend
    const loadProcedureNames = React.useCallback(async () => {
        try {
            const response = await apiFetch('/odonto/procedures/distinct-names/');
            if (response && typeof response === 'object' && 'names' in response) {
                const names = (response.names as string[]).sort();
                setProcedureNames(names);
            }
        } catch (err) {
            // silenciosamente falha se não conseguir carregar - usa array vazio
            console.error('Erro ao carregar nomes de procedimentos:', err);
        }
    }, []);

    // Carrega catálogo de produtos (nome + último valor) do backend
    const loadProductNames = React.useCallback(async (arcadeId?: number) => {
        try {
            const url = arcadeId
                ? `/odonto/procedures/products/distinct-names/?arcade=${arcadeId}`
                : '/odonto/procedures/products/distinct-names/';
            const response = await apiFetch(url);
            if (response && typeof response === 'object' && 'catalog' in response) {
                const catalog = (response.catalog as { name: string; last_value: string | null }[]).sort(
                    (a, b) => a.name.localeCompare(b.name),
                );
                setProductCatalog(catalog);
            }
        } catch (err) {
            console.error('Erro ao carregar catálogo de produtos:', err);
        }
    }, []);

    React.useEffect(() => {
        if (canAccess) {
            void loadProcedureNames();
        }
    }, [canAccess, loadProcedureNames]);

    // Recarrega nomes de produtos quando arcade ID muda
    React.useEffect(() => {
        if (arcade?.id && canAccess) {
            void loadProductNames(arcade.id);
        }
    }, [arcade?.id, canAccess, loadProductNames]);

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

    // Derived — no setState cascade. On first load shows most recent date; on updates clamps.
    const activeDateIndex = React.useMemo(() => {
        if (dateKeys.length === 0) return 0;
        if (rawActiveDateIndex < 0) return dateKeys.length - 1;
        return Math.min(rawActiveDateIndex, dateKeys.length - 1);
    }, [rawActiveDateIndex, dateKeys.length]);

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
        // Reseta o checkbox e o dropdown quando o formulário abre/fecha
        if (!formOpen) {
            setShouldSaveToList(false);
            setShowProcedureDropdown(false);
        }
    }, [formOpen]);

    const orderedTeeth = React.useMemo(() => {
        if (teeth.length > 0) return teeth;
        return INTERNATIONAL_NUMBERS.map((internationalNumber, index) => ({
            id: -(index + 1),
            sequence: index + 1,
            international_number: internationalNumber,
        }));
    }, [teeth]);

    const selectedTooth = React.useMemo(() => {
        if (selectedToothId == null) return null;
        return (
            toothById.get(selectedToothId) ||
            orderedTeeth.find(tooth => tooth.id === selectedToothId) ||
            null
        );
    }, [orderedTeeth, selectedToothId, toothById]);

    const isCreateMode =
        serviceFlowOpen || productFlowOpen || (formOpen && formMode === 'create');
    const suppressDateHighlights = isCreateMode && inlineForm.kind === 'tooth';

    const procedureGroups = React.useMemo(() => {
        const sorted = [...procedures]
            .filter(p => !p.is_product)
            .sort((a, b) => {
            const ad = eventDateISO(a);
            const bd = eventDateISO(b);
            if (!ad && !bd) return a.id - b.id;
            if (!ad) return 1;
            if (!bd) return -1;
            const t = new Date(ad).getTime() - new Date(bd).getTime();
            if (t !== 0) return t;
            return a.id - b.id;
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

    function selectToothFromGrid(toothId: number) {
        setSelectedToothId(toothId);
        if (formOpen && inlineForm.kind === 'tooth' && formError) {
            setFormError(null);
        }
    }

    function openCreateForm() {
        setFormError(null);
        setFormMode('create');
        setEditingProcedureId(null);
        setSelectedToothId(null);
        setInlineForm({
            kind: 'tooth',
            name: '',
            faces_raw: '',
            date: todayISODate(),
            patient_amount: '',
            notes: '',
        });
        setEditProducts([]);
        setDeletedProductIds([]);
        setFormOpen(true);
    }

    function openServiceFlowModal() {
        const defaultToothId = selectedToothId ?? teeth[0]?.id ?? null;
        setServiceFlowType('tooth');
        setServiceRows([
            {
                toothId: defaultToothId,
                name: '',
                value: '',
            },
        ]);
        setServiceFlowOpen(true);
    }

    function openProductFlowModal() {
        setProductRows([{ name: '', value: '' }]);
        setProductFlowOpen(true);
    }

    function closeServiceFlowModal() {
        if (savingServiceFlow) return;
        setServiceFlowOpen(false);
    }

    function closeProductFlowModal() {
        if (savingProductFlow) return;
        setProductFlowOpen(false);
    }

    async function saveServiceFlow() {
        if (!arcade || serviceRows.length === 0) return;

        for (const row of serviceRows) {
            if (!row.name.trim()) {
                emit('systemMessage', {
                    text: 'Preencha o nome em todas as linhas de serviço.',
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
                const amount = row.value.trim()
                    ? parseAmount(row.value)
                    : null;
                await apiFetch('/odonto/procedures/', {
                    method: 'POST',
                    body: {
                        arcade: arcade.id,
                        tooth: serviceFlowType === 'tooth' ? row.toothId : null,
                        surface: null,
                        faces_raw: '',
                        code: '',
                        name: row.name.trim(),
                        status: 'pending',
                        started_at: todayISODate(),
                        completed_at: null,
                        patient_amount: amount,
                        paid_amount: null,
                        notes: '',
                        is_active: true,
                    },
                });
            }

            closeServiceFlowModal();
            await loadArcade(true);
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
            await loadArcade(true);
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

    function openEditForm(proc: ProcedureItem) {
        setFormError(null);
        setFormMode('edit');
        setEditingProcedureId(proc.id);
        if (proc.tooth != null) {
            setSelectedToothId(proc.tooth);
        }
        setInlineForm({
            kind: proc.tooth == null ? 'general' : 'tooth',
            name: proc.name,
            faces_raw: proc.faces_raw || '',
            date: eventDateISO(proc) || '',
            patient_amount: toInputAmount(proc.patient_amount),
            notes: proc.notes || '',
        });
        const existing = procedures
            .filter(p => p.is_product && p.parent_procedure === proc.id)
            .map(p => ({
                id: p.id,
                name: p.name,
                value: toInputAmount(p.patient_amount),
                saveNameToList: false,
                saveValueToList: false,
                showDropdown: false,
            }));
        setEditProducts(existing);
        setDeletedProductIds([]);
        setFormOpen(true);
    }

    async function saveInlineProcedure() {
        if (!arcade) return;

        const name = inlineForm.name.trim();
        if (!name) {
            setFormError('Informe o nome do procedimento.');
            emit('systemMessage', {
                text: 'Informe o nome do procedimento antes de salvar.',
                type: 'warning',
            });
            return;
        }

        const isTooth = inlineForm.kind === 'tooth';
        const toothId = isTooth ? selectedToothId : null;
        if (isTooth && toothId == null) {
            setFormError('Selecione o dente na grade para salvar o procedimento.');
            emit('systemMessage', {
                text: 'Selecione um dente na grade acima antes de salvar.',
                type: 'warning',
            });
            return;
        }

        let amount: number | null = null;
        const amountRaw = inlineForm.patient_amount.trim();
        if (amountRaw) {
            const validation = validateAmount(amountRaw);
            if (!validation.valid) {
                setFormError(validation.message || 'Valor inválido.');
                emit('systemMessage', {
                    text: validation.message || 'Valor inválido.',
                    type: 'warning',
                });
                return;
            }
            amount = validation.numericValue!;
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
                    emit('systemMessage', {
                        text: 'Nao e permitido cadastrar novo procedimento com data retroativa.',
                        type: 'warning',
                    });
                    setSavingForm(false);
                    return;
                }

                const newProc = await apiFetch('/odonto/procedures/', {
                    method: 'POST',
                    body: {
                        arcade: arcade.id,
                        tooth: isTooth ? toothId : null,
                        surface: null,
                        faces_raw: isTooth ? inlineForm.faces_raw.trim() : '',
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
                }) as { id: number };

                // Se marcou para salvar na lista e o nome é novo
                if (shouldSaveToList && !isNameInList) {
                    try {
                        await apiFetch('/odonto/procedures/suggest-name/', {
                            method: 'POST',
                            body: {
                                name: name.trim(),
                                arcade_id: arcade.id,
                            },
                        });
                    } catch (err) {
                        // Silenciosamente falha se não conseguir adicionar à lista
                        console.error('Erro ao salvar nome na lista:', err);
                    }
                }

                // Salva produtos associados
                if (newProc?.id) {
                    for (const product of editProducts) {
                        if (!product.name.trim()) continue;
                        const valueValidation = product.value.trim()
                            ? validateAmount(product.value)
                            : { valid: true, numericValue: null };
                        if (!valueValidation.valid) continue;
                        const productAmount = valueValidation.numericValue ?? null;
                        const isInProdList = productNames.some(
                            n => n.toLowerCase() === product.name.toLowerCase().trim(),
                        );
                        try {
                            await apiFetch('/odonto/procedures/', {
                                method: 'POST',
                                body: {
                                    arcade: arcade.id,
                                    name: product.name.trim(),
                                    is_product: true,
                                    parent_procedure: newProc.id,
                                    patient_amount: productAmount,
                                    started_at: dateToUse,
                                    status: 'pending',
                                    is_active: true,
                                    tooth: null,
                                    surface: null,
                                    faces_raw: '',
                                    code: '',
                                },
                            });
                            if (product.saveNameToList && !isInProdList) {
                                await apiFetch('/odonto/procedures/products/suggest-name/', {
                                    method: 'POST',
                                    body: {
                                        name: product.name.trim(),
                                        arcade_id: arcade.id,
                                        value: productAmount,
                                    },
                                }).catch(() => null);
                            }
                        } catch (err) {
                            console.error('Erro ao salvar produto:', err);
                        }
                    }
                }
            } else {
                const original = procedures.find(p => p.id === editingProcedureId);
                if (!original) {
                    setFormError('Procedimento nao encontrado para edicao.');
                    emit('systemMessage', {
                        text: 'Procedimento nao encontrado para edicao.',
                        type: 'error',
                    });
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
                        faces_raw: isTooth ? inlineForm.faces_raw.trim() : '',
                        name,
                        patient_amount: amount,
                        notes: inlineForm.notes.trim(),
                        started_at: startedAt,
                        completed_at: completedAt,
                    },
                });

                const dateToUse = startedAt || completedAt || todayISODate();

                // Delete removed products
                for (const pid of deletedProductIds) {
                    try {
                        await apiFetch(`/odonto/procedures/${pid}/`, { method: 'DELETE' });
                    } catch (err) {
                        console.error('Erro ao remover produto:', err);
                    }
                }

                // Save / update products
                for (const product of editProducts) {
                    if (!product.name.trim()) continue;
                    const valueValidation = product.value.trim()
                        ? validateAmount(product.value)
                        : { valid: true, numericValue: null };
                    if (!valueValidation.valid) continue;
                    const productAmount = valueValidation.numericValue ?? null;
                    const isInList = productNames.some(
                        n => n.toLowerCase() === product.name.toLowerCase().trim(),
                    );
                    const catalogVal = productValueMap.get(product.name.toLowerCase().trim());

                    if (product.id !== undefined) {
                        await apiFetch(`/odonto/procedures/${product.id}/`, {
                            method: 'PATCH',
                            body: {
                                name: product.name.trim(),
                                patient_amount: productAmount,
                                started_at: dateToUse,
                            },
                        });
                    } else {
                        await apiFetch('/odonto/procedures/', {
                            method: 'POST',
                            body: {
                                arcade: arcade.id,
                                name: product.name.trim(),
                                is_product: true,
                                parent_procedure: original.id,
                                patient_amount: productAmount,
                                started_at: dateToUse,
                                status: 'pending',
                                is_active: true,
                                tooth: null,
                                surface: null,
                                faces_raw: '',
                                code: '',
                            },
                        });
                    }

                    // Persist name to catalog if new
                    if (product.saveNameToList && !isInList) {
                        try {
                            await apiFetch('/odonto/procedures/products/suggest-name/', {
                                method: 'POST',
                                body: {
                                    name: product.name.trim(),
                                    arcade_id: arcade.id,
                                    value: productAmount,
                                },
                            });
                        } catch (err) {
                            console.error('Erro ao salvar nome do produto no catálogo:', err);
                        }
                    }

                    // Persist updated value to catalog if changed
                    if (product.saveValueToList && isInList && productAmount !== null) {
                        const currentCatalogValue =
                            catalogVal != null ? parseAmount(catalogVal) : null;
                        if (productAmount !== currentCatalogValue) {
                            try {
                                await apiFetch('/odonto/procedures/products/suggest-name/', {
                                    method: 'POST',
                                    body: {
                                        name: product.name.trim(),
                                        arcade_id: arcade.id,
                                        value: productAmount,
                                    },
                                });
                            } catch (err) {
                                console.error('Erro ao atualizar valor do produto no catálogo:', err);
                            }
                        }
                    }
                }

            }

            setFormOpen(false);
            await Promise.all([
                loadArcade(true),
                loadProcedureNames(),
                loadProductNames(arcade.id),
            ]);
            emit('systemMessage', {
                text: 'Dados salvos com sucesso.',
                type: 'success',
            });
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
            await loadArcade(true);
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

    async function toggleProcedureCompleted(proc: ProcedureItem) {
        const currentlyCompleted = isProcedureCompleted(proc);
        if (currentlyCompleted) {
            const confirmed = window.confirm(
                'Este procedimento voltará para pendente. Deseja continuar?',
            );
            if (!confirmed) return;
        }

        try {
            const today = todayISODate();
            const hasDate = !!(proc.started_at || proc.completed_at);
            const body = currentlyCompleted
                ? {
                      // revert to pending: clear completed_at but preserve date in started_at
                      status: 'pending' as const,
                      completed_at: null,
                      started_at: proc.started_at || proc.completed_at || today,
                  }
                : {
                      // mark completed: keep original completed_at only (historical migration date).
                      // never carry started_at into completed_at — that causes stale dates on re-toggle.
                      status: 'completed' as const,
                      completed_at: proc.completed_at || today,
                      ...(!hasDate ? { started_at: today } : {}),
                  };
            await apiFetch(`/odonto/procedures/${proc.id}/`, {
                method: 'PATCH',
                body,
            });
            await loadArcade(true);
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : 'Nao foi possivel atualizar a conclusao do procedimento.';
            setError(
                message ||
                    'Nao foi possivel atualizar a conclusao do procedimento.',
            );
        }
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
            const today = todayISODate();
            const hasDate = !!(proc.started_at || proc.completed_at);
            const patientAmount = parseAmount(proc.patient_amount);
            await apiFetch(`/odonto/procedures/${proc.id}/`, {
                method: 'PATCH',
                body: {
                    paid_amount: currentlyPaid ? null : patientAmount,
                    paid_at: currentlyPaid ? null : today,
                    // if dateless legacy procedure, assign today on first interaction
                    ...(!currentlyPaid && !hasDate ? { started_at: today } : {}),
                },
            });
            await loadArcade(true);
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
                    <button
                        type='button'
                        onClick={openServiceFlowModal}
                        className={styles.btnPrimary}
                    >
                        <span className={styles.desktopOnly}>+ Novo servico</span>
                        <span className={styles.mobileOnly}>+ Novo</span>
                    </button>
                    <button type='button' onClick={openProductFlowModal} className={styles.btn}>
                        + Produto
                    </button>
                    <button type='button' onClick={() => navigate('/')} className={styles.btn}>
                        <span className={styles.desktopOnly}>Voltar para clientes</span>
                        <span className={styles.mobileOnly}>Voltar</span>
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
                    {serviceFlowOpen && (
                        <div
                            className={styles.serviceFlowOverlay}
                            role='presentation'
                            onClick={closeServiceFlowModal}
                        >
                            <div
                                className={styles.serviceFlowModal}
                                role='dialog'
                                aria-modal='true'
                                aria-label='Novo servico'
                                onClick={event => event.stopPropagation()}
                            >
                                <div className={styles.serviceFlowHeader}>
                                    <div className={styles.serviceFlowHeaderMain}>
                                        <h3 className={styles.sectionTitle}>Novo servico</h3>
                                        <div className={styles.serviceFlowStepChoices}>
                                            <button
                                                type='button'
                                                className={`${styles.serviceFlowChoiceBtn} ${
                                                    serviceFlowType === 'tooth'
                                                        ? styles.serviceFlowChoiceBtnActive
                                                        : ''
                                                }`}
                                                onClick={() =>
                                                    setServiceFlowType('tooth')
                                                }
                                                disabled={savingServiceFlow}
                                            >
                                                Por dente
                                            </button>
                                            <button
                                                type='button'
                                                className={`${styles.serviceFlowChoiceBtn} ${
                                                    serviceFlowType === 'arcade'
                                                        ? styles.serviceFlowChoiceBtnActive
                                                        : ''
                                                }`}
                                                onClick={() =>
                                                    setServiceFlowType('arcade')
                                                }
                                                disabled={savingServiceFlow}
                                            >
                                                Arcada
                                            </button>
                                            <button
                                                type='button'
                                                className={`${styles.serviceFlowChoiceBtn} ${
                                                    serviceFlowType === 'other'
                                                        ? styles.serviceFlowChoiceBtnActive
                                                        : ''
                                                }`}
                                                onClick={() =>
                                                    setServiceFlowType('other')
                                                }
                                                disabled={savingServiceFlow}
                                            >
                                                Outro
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.serviceFlowBody}>
                                    <div className={styles.productFlowTopActions}>
                                        <button
                                            type='button'
                                            className={styles.btnPrimary}
                                            onClick={() =>
                                                setServiceRows(prev => [
                                                    ...prev,
                                                    {
                                                        toothId:
                                                            selectedToothId ??
                                                            teeth[0]?.id ??
                                                            null,
                                                        name: '',
                                                        value: '',
                                                    },
                                                ])
                                            }
                                            disabled={savingServiceFlow}
                                        >
                                            + Linha
                                        </button>
                                    </div>

                                    <div className={styles.serviceFlowRows}>
                                        {serviceRows.map((row, index) => (
                                            <div
                                                key={index}
                                                className={styles.serviceFlowRow}
                                            >
                                                <div className={styles.productFlowRowHeader}>
                                                    <strong>
                                                        Linha {index + 1}
                                                    </strong>
                                                    <button
                                                        type='button'
                                                        className={styles.iconBtnDanger}
                                                        onClick={() =>
                                                            setServiceRows(prev =>
                                                                prev.filter(
                                                                    (_, i) =>
                                                                        i !==
                                                                        index,
                                                                ),
                                                            )
                                                        }
                                                        disabled={
                                                            savingServiceFlow ||
                                                            serviceRows.length ===
                                                                1
                                                        }
                                                        title='Remover linha'
                                                        aria-label='Remover linha'
                                                    >
                                                        <svg
                                                            viewBox='0 0 24 24'
                                                            aria-hidden='true'
                                                            className={styles.iconSvg}
                                                        >
                                                            <path
                                                                d='M18 6 6 18M6 6l12 12'
                                                                fill='none'
                                                                stroke='currentColor'
                                                                strokeWidth='2.5'
                                                                strokeLinecap='round'
                                                            />
                                                        </svg>
                                                    </button>
                                                </div>

                                                {serviceFlowType === 'tooth' && (
                                                    <label className={styles.formLabel}>
                                                        Dente
                                                        <select
                                                            className={styles.input}
                                                            value={
                                                                row.toothId ?? ''
                                                            }
                                                            onChange={event =>
                                                                setServiceRows(
                                                                    prev =>
                                                                        prev.map(
                                                                            (
                                                                                item,
                                                                                i,
                                                                            ) =>
                                                                                i ===
                                                                                index
                                                                                    ? {
                                                                                          ...item,
                                                                                          toothId:
                                                                                              event
                                                                                                  .target
                                                                                                  .value
                                                                                                  ? Number(
                                                                                                        event
                                                                                                            .target
                                                                                                            .value,
                                                                                                    )
                                                                                                  : null,
                                                                                      }
                                                                                    : item,
                                                                        ),
                                                                )
                                                            }
                                                            disabled={
                                                                savingServiceFlow
                                                            }
                                                        >
                                                            <option value=''>
                                                                Selecione
                                                            </option>
                                                            {orderedTeeth.map(
                                                                tooth => (
                                                                    <option
                                                                        key={
                                                                            tooth.id
                                                                        }
                                                                        value={
                                                                            tooth.id
                                                                        }
                                                                    >
                                                                        Dente{' '}
                                                                        {
                                                                            tooth.international_number
                                                                        }
                                                                    </option>
                                                                ),
                                                            )}
                                                        </select>
                                                    </label>
                                                )}

                                                <div className={styles.formGrid}>
                                                    <label
                                                        className={styles.formLabel}
                                                    >
                                                        Nome do procedimento *
                                                        <input
                                                            className={styles.input}
                                                            value={row.name}
                                                            onChange={event =>
                                                                setServiceRows(
                                                                    prev =>
                                                                        prev.map(
                                                                            (
                                                                                item,
                                                                                i,
                                                                            ) =>
                                                                                i ===
                                                                                index
                                                                                    ? {
                                                                                          ...item,
                                                                                          name: event
                                                                                              .target
                                                                                              .value,
                                                                                      }
                                                                                    : item,
                                                                        ),
                                                                )
                                                            }
                                                            disabled={
                                                                savingServiceFlow
                                                            }
                                                        />
                                                    </label>

                                                    <label
                                                        className={styles.formLabel}
                                                    >
                                                        Valor
                                                        <input
                                                            type='text'
                                                            inputMode='decimal'
                                                            className={
                                                                styles.input
                                                            }
                                                            value={row.value}
                                                            placeholder='0,00'
                                                            onChange={event =>
                                                                setServiceRows(
                                                                    prev =>
                                                                        prev.map(
                                                                            (
                                                                                item,
                                                                                i,
                                                                            ) =>
                                                                                i ===
                                                                                index
                                                                                    ? {
                                                                                          ...item,
                                                                                          value: event
                                                                                              .target
                                                                                              .value,
                                                                                      }
                                                                                    : item,
                                                                        ),
                                                                )
                                                            }
                                                            disabled={
                                                                savingServiceFlow
                                                            }
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className={styles.modalActions}>
                                    <button
                                        type='button'
                                        className={styles.btn}
                                        onClick={closeServiceFlowModal}
                                        disabled={savingServiceFlow}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type='button'
                                        className={styles.btnPrimary}
                                        onClick={() => void saveServiceFlow()}
                                        disabled={savingServiceFlow}
                                    >
                                        {savingServiceFlow
                                            ? 'Salvando...'
                                            : 'Salvar servicos'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {productFlowOpen && (
                        <div
                            className={styles.serviceFlowOverlay}
                            role='presentation'
                            onClick={closeProductFlowModal}
                        >
                            <div
                                className={styles.serviceFlowModal}
                                role='dialog'
                                aria-modal='true'
                                aria-label='Novo produto'
                                onClick={event => event.stopPropagation()}
                            >
                                <div className={styles.serviceFlowHeader}>
                                    <div className={styles.serviceFlowHeaderMain}>
                                        <h3 className={styles.sectionTitle}>
                                            Novo fluxo de produtos
                                        </h3>
                                    </div>
                                </div>

                                <div className={styles.productFlowTopActions}>
                                    <button
                                        type='button'
                                        className={styles.btnPrimary}
                                        onClick={() =>
                                            setProductRows(prev => [
                                                ...prev,
                                                {
                                                    name: '',
                                                    value: '',
                                                },
                                            ])
                                        }
                                        disabled={savingProductFlow}
                                    >
                                        + Produto
                                    </button>
                                </div>

                                <div className={styles.serviceFlowRows}>
                                    {productRows.length === 0 && (
                                        <p className={styles.textMuted}>
                                            Nenhum produto adicionado.
                                        </p>
                                    )}
                                    {productRows.map((row, index) => (
                                        <div
                                            key={index}
                                            className={styles.serviceFlowRow}
                                        >
                                            <div
                                                className={
                                                    styles.productFlowRowHeader
                                                }
                                            >
                                                <strong>
                                                    Produto {index + 1}
                                                </strong>
                                                <button
                                                    type='button'
                                                    className={styles.iconBtnDanger}
                                                    onClick={() =>
                                                        setProductRows(prev =>
                                                            prev.filter(
                                                                (_, i) =>
                                                                    i !== index,
                                                            ),
                                                        )
                                                    }
                                                    disabled={
                                                        savingProductFlow
                                                    }
                                                    aria-label='Remover produto'
                                                    title='Remover produto'
                                                >
                                                    <svg
                                                        viewBox='0 0 24 24'
                                                        aria-hidden='true'
                                                        className={styles.iconSvg}
                                                    >
                                                        <path
                                                            d='M18 6 6 18M6 6l12 12'
                                                            fill='none'
                                                            stroke='currentColor'
                                                            strokeWidth='2.5'
                                                            strokeLinecap='round'
                                                        />
                                                    </svg>
                                                </button>
                                            </div>
                                            <div className={styles.formGrid}>
                                                <label
                                                    className={styles.formLabel}
                                                >
                                                    Nome *
                                                    <input
                                                        className={styles.input}
                                                        value={row.name}
                                                        onChange={event =>
                                                            setProductRows(
                                                                prev =>
                                                                    prev.map(
                                                                        (
                                                                            item,
                                                                            i,
                                                                        ) =>
                                                                            i ===
                                                                            index
                                                                                ? {
                                                                                      ...item,
                                                                                      name: event
                                                                                          .target
                                                                                          .value,
                                                                                  }
                                                                                : item,
                                                                    ),
                                                            )
                                                        }
                                                        disabled={
                                                            savingProductFlow
                                                        }
                                                    />
                                                </label>

                                                <label
                                                    className={styles.formLabel}
                                                >
                                                    Valor
                                                    <input
                                                        type='text'
                                                        inputMode='decimal'
                                                        className={styles.input}
                                                        placeholder='0,00'
                                                        value={row.value}
                                                        onChange={event =>
                                                            setProductRows(
                                                                prev =>
                                                                    prev.map(
                                                                        (
                                                                            item,
                                                                            i,
                                                                        ) =>
                                                                            i ===
                                                                            index
                                                                                ? {
                                                                                      ...item,
                                                                                      value: event
                                                                                          .target
                                                                                          .value,
                                                                                  }
                                                                                : item,
                                                                    ),
                                                            )
                                                        }
                                                        disabled={
                                                            savingProductFlow
                                                        }
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
                                        onClick={closeProductFlowModal}
                                        disabled={savingProductFlow}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type='button'
                                        className={styles.btnPrimary}
                                        onClick={() => void saveProductFlow()}
                                        disabled={savingProductFlow}
                                    >
                                        {savingProductFlow
                                            ? 'Salvando...'
                                            : 'Salvar produtos'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <section className={styles.arcadeCard}>
                        <div className={styles.arcadeHeader}>
                            <div className={styles.timelineHeader}>
                                <h2 className={styles.sectionTitle}>Mapa da arcada</h2>
                                <div
                                    className={`${styles.timelineNav} ${
                                        isCreateMode ? styles.timelineNavHidden : ''
                                    }`}
                                    aria-hidden={isCreateMode}
                                >
                                    <button
                                        type='button'
                                        className={styles.timelineArrowButton}
                                        onClick={() =>
                                            setActiveDateIndex(prev => Math.max(0, prev - 1))
                                        }
                                        disabled={activeDateIndex <= 0 || dateKeys.length === 0}
                                        aria-label='Data anterior'
                                    >
                                        <FaArrowLeft />
                                    </button>
                                    <span className={styles.timelineDateLabel}>
                                        {activeDateKey ? formatDate(activeDateKey) : 'Sem data'}
                                    </span>
                                    <button
                                        type='button'
                                        className={styles.timelineArrowButton}
                                        onClick={() =>
                                            setActiveDateIndex(prev =>
                                                Math.min(dateKeys.length - 1, prev + 1),
                                            )
                                        }
                                        disabled={
                                            activeDateIndex >= dateKeys.length - 1 ||
                                            dateKeys.length === 0
                                        }
                                        aria-label='Próxima data'
                                    >
                                        <FaArrowRight />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className={styles.svgWrap}>
                            <OdontoToothGrid
                                orderedTeeth={orderedTeeth}
                                selectedToothId={selectedToothId}
                                suppressDateHighlights={suppressDateHighlights}
                                activeDateToothIds={activeDateToothIds}
                                onToothClick={selectToothFromGrid}
                            />
                        </div>

                        <div className={styles.composerDivider} />

                        {formOpen && formMode === 'edit' && (
                            <div className={styles.inlineComposer}>
                                <div className={styles.composerHeader}>
                                    <h3 className={styles.sectionTitle}>
                                        Editar procedimento
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
                                        <div className={styles.formLabel}>
                                            <span>Dente selecionado</span>
                                            <div className={styles.selectedToothCard}>
                                                <div className={styles.selectedToothLine}>
                                                    <strong className={styles.selectedToothValue}>
                                                        {selectedTooth
                                                            ? `Dente ${selectedTooth.international_number}`
                                                            : 'Nenhum dente selecionado'}
                                                    </strong>
                                                    <span className={styles.selectedToothInlineHint}>
                                                        (clique na grade acima para escolher o dente)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <label className={styles.formLabel}>
                                        Nome do procedimento *
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                value={inlineForm.name}
                                                onFocus={() => setShowProcedureDropdown(true)}
                                                onBlur={() =>
                                                    setTimeout(
                                                        () => setShowProcedureDropdown(false),
                                                        200,
                                                    )
                                                }
                                                onChange={event =>
                                                    setInlineForm(prev => ({
                                                        ...prev,
                                                        name: event.target.value,
                                                    }))
                                                }
                                                onKeyDown={event => {
                                                    if (event.key === 'Escape') {
                                                        setShowProcedureDropdown(false);
                                                    }
                                                }}
                                                className={styles.input}
                                                placeholder='Ex.: Restauracao em resina'
                                                disabled={savingForm}
                                                autoComplete='off'
                                            />
                                            {showProcedureDropdown && filteredProcedureNames.length > 0 && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        left: 0,
                                                        right: 0,
                                                        backgroundColor: '#fff',
                                                        border: '1px solid #ccc',
                                                        borderRadius: '4px',
                                                        marginTop: '4px',
                                                        maxHeight: '200px',
                                                        overflowY: 'auto',
                                                        zIndex: 10,
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                    }}
                                                >
                                                    {filteredProcedureNames.map(name => (
                                                        <div
                                                            key={name}
                                                            onMouseDown={e => e.preventDefault()}
                                                            onClick={() => {
                                                                setInlineForm(prev => ({
                                                                    ...prev,
                                                                    name,
                                                                }));
                                                                setShowProcedureDropdown(false);
                                                                setShouldSaveToList(false);
                                                            }}
                                                            style={{
                                                                padding: '8px 12px',
                                                                cursor: 'pointer',
                                                                borderBottom: '1px solid #f0f0f0',
                                                                fontSize: '14px',
                                                            }}
                                                            onMouseEnter={e =>
                                                                (e.currentTarget.style.backgroundColor =
                                                                    '#f5f5f5')
                                                            }
                                                            onMouseLeave={e =>
                                                                (e.currentTarget.style.backgroundColor =
                                                                    '#fff')
                                                            }
                                                        >
                                                            {name}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </label>

                                    {!isNameInList && inlineForm.name.trim() && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '8px',
                                                backgroundColor: '#f9f9f9',
                                                borderRadius: '4px',
                                                fontSize: '13px',
                                            }}
                                        >
                                            <input
                                                type='checkbox'
                                                id='save-to-list-checkbox'
                                                checked={shouldSaveToList}
                                                onChange={e =>
                                                    setShouldSaveToList(e.target.checked)
                                                }
                                                disabled={savingForm}
                                            />
                                            <label
                                                htmlFor='save-to-list-checkbox'
                                                style={{ cursor: 'pointer', margin: 0 }}
                                            >
                                                Salvar "{inlineForm.name}" na lista de sugestões
                                            </label>
                                        </div>
                                    )}

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
                                            min={undefined}
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
                                        Observação.
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
                                            placeholder='Anotações breves do atendimento.'
                                            disabled={savingForm}
                                        />
                                    </label>
                                </div>

                                <div className={styles.productSection}>
                                        <div className={styles.productSectionHeader}>
                                            <span className={styles.productSectionTitle}>
                                                Produtos usados
                                            </span>
                                            <button
                                                type='button'
                                                className={styles.btnPrimary}
                                                onClick={() =>
                                                    setEditProducts(prev => [
                                                        ...prev,
                                                        {
                                                            name: '',
                                                            value: '',
                                                            saveNameToList: false,
                                                            saveValueToList: false,
                                                            showDropdown: false,
                                                        },
                                                    ])
                                                }
                                                disabled={savingForm}
                                            >
                                                + Produto
                                            </button>
                                        </div>

                                        {editProducts.length === 0 && (
                                            <p className={styles.textMuted} style={{ fontSize: '13px', margin: 0 }}>
                                                Nenhum produto adicionado.
                                            </p>
                                        )}

                                        {editProducts.map((product, idx) => {
                                            const isInList = productNames.some(
                                                n =>
                                                    n.toLowerCase() ===
                                                    product.name.toLowerCase().trim(),
                                            );
                                            const catalogVal = productValueMap.get(
                                                product.name.toLowerCase().trim(),
                                            );
                                            const valueChanged =
                                                isInList &&
                                                catalogVal != null &&
                                                product.value.trim() !== '' &&
                                                parseAmount(product.value) !==
                                                    parseAmount(catalogVal);
                                            const filteredNames = product.name.trim()
                                                ? productNames.filter(n =>
                                                      n
                                                          .toLowerCase()
                                                          .includes(
                                                              product.name.toLowerCase().trim(),
                                                          ),
                                                  )
                                                : productNames;

                                            return (
                                                <div
                                                    key={idx}
                                                    className={styles.productFormGroup}
                                                >
                                                    <div className={styles.productFormRow}>
                                                        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                                                            <input
                                                                type='text'
                                                                placeholder='Nome do produto'
                                                                value={product.name}
                                                                className={styles.input}
                                                                disabled={savingForm}
                                                                autoComplete='off'
                                                                onFocus={() =>
                                                                    setEditProducts(prev =>
                                                                        prev.map((p, i) =>
                                                                            i === idx
                                                                                ? { ...p, showDropdown: true }
                                                                                : p,
                                                                        ),
                                                                    )
                                                                }
                                                                onBlur={() =>
                                                                    setTimeout(
                                                                        () =>
                                                                            setEditProducts(prev =>
                                                                                prev.map((p, i) =>
                                                                                    i === idx
                                                                                        ? {
                                                                                              ...p,
                                                                                              showDropdown: false,
                                                                                          }
                                                                                        : p,
                                                                                ),
                                                                            ),
                                                                        200,
                                                                    )
                                                                }
                                                                onChange={e => {
                                                                    const newName = e.target.value;
                                                                    setEditProducts(prev =>
                                                                        prev.map((p, i) => {
                                                                            if (i !== idx) return p;
                                                                            const inList = productNames.some(
                                                                                n =>
                                                                                    n.toLowerCase() ===
                                                                                    newName.toLowerCase().trim(),
                                                                            );
                                                                            const catVal = productValueMap.get(
                                                                                newName.toLowerCase().trim(),
                                                                            );
                                                                            return {
                                                                                ...p,
                                                                                name: newName,
                                                                                value:
                                                                                    inList &&
                                                                                    catVal != null &&
                                                                                    !p.value.trim()
                                                                                        ? toInputAmount(catVal)
                                                                                        : p.value,
                                                                                showDropdown: true,
                                                                            };
                                                                        }),
                                                                    );
                                                                }}
                                                            />
                                                            {product.showDropdown &&
                                                                filteredNames.length > 0 && (
                                                                    <div
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: '100%',
                                                                            left: 0,
                                                                            right: 0,
                                                                            backgroundColor: '#fff',
                                                                            border: '1px solid #ccc',
                                                                            borderRadius: '4px',
                                                                            marginTop: '4px',
                                                                            maxHeight: '180px',
                                                                            overflowY: 'auto',
                                                                            zIndex: 20,
                                                                            boxShadow:
                                                                                '0 2px 8px rgba(0,0,0,0.1)',
                                                                        }}
                                                                    >
                                                                        {filteredNames.map(
                                                                            (name, ni) => (
                                                                                <div
                                                                                    key={ni}
                                                                                    onMouseDown={e =>
                                                                                        e.preventDefault()
                                                                                    }
                                                                                    onClick={() => {
                                                                                        const catVal =
                                                                                            productValueMap.get(
                                                                                                name.toLowerCase(),
                                                                                            );
                                                                                        setEditProducts(
                                                                                            prev =>
                                                                                                prev.map(
                                                                                                    (p, i) =>
                                                                                                        i === idx
                                                                                                            ? {
                                                                                                                  ...p,
                                                                                                                  name,
                                                                                                                  value:
                                                                                                                      (catVal
                                                                                                                          ? toInputAmount(
                                                                                                                                catVal,
                                                                                                                            )
                                                                                                                          : null) ??
                                                                                                                      p.value,
                                                                                                                  showDropdown:
                                                                                                                      false,
                                                                                                              }
                                                                                                            : p,
                                                                                                ),
                                                                                        );
                                                                                    }}
                                                                                    style={{
                                                                                        padding: '8px 12px',
                                                                                        cursor: 'pointer',
                                                                                        borderBottom:
                                                                                            '1px solid #f0f0f0',
                                                                                        fontSize: '14px',
                                                                                    }}
                                                                                    onMouseEnter={e =>
                                                                                        (e.currentTarget.style.backgroundColor =
                                                                                            '#f5f5f5')
                                                                                    }
                                                                                    onMouseLeave={e =>
                                                                                        (e.currentTarget.style.backgroundColor =
                                                                                            '#fff')
                                                                                    }
                                                                                >
                                                                                    {name}
                                                                                </div>
                                                                            ),
                                                                        )}
                                                                    </div>
                                                                )}
                                                        </div>

                                                        <input
                                                            type='text'
                                                            inputMode='decimal'
                                                            placeholder='0,00'
                                                            value={product.value}
                                                            className={styles.input}
                                                            style={{ width: '120px', flex: '0 0 120px' }}
                                                            disabled={savingForm}
                                                            onChange={e =>
                                                                setEditProducts(prev =>
                                                                    prev.map((p, i) =>
                                                                        i === idx
                                                                            ? { ...p, value: e.target.value }
                                                                            : p,
                                                                    ),
                                                                )
                                                            }
                                                        />

                                                        <button
                                                            type='button'
                                                            className={styles.iconBtnDanger}
                                                            onClick={() => {
                                                                if (product.id !== undefined) {
                                                                    setDeletedProductIds(prev => [
                                                                        ...prev,
                                                                        product.id!,
                                                                    ]);
                                                                }
                                                                setEditProducts(prev =>
                                                                    prev.filter((_, i) => i !== idx),
                                                                );
                                                            }}
                                                            disabled={savingForm}
                                                            aria-label='Remover produto'
                                                            title='Remover produto'
                                                        >
                                                            <svg
                                                                viewBox='0 0 24 24'
                                                                aria-hidden='true'
                                                                className={styles.iconSvg}
                                                            >
                                                                <path
                                                                    d='M18 6 6 18M6 6l12 12'
                                                                    fill='none'
                                                                    stroke='currentColor'
                                                                    strokeWidth='2.5'
                                                                    strokeLinecap='round'
                                                                />
                                                            </svg>
                                                        </button>
                                                    </div>

                                                    {!isInList && product.name.trim() && (
                                                        <div className={styles.productSaveCheckbox}>
                                                            <input
                                                                type='checkbox'
                                                                id={`save-pname-${idx}`}
                                                                checked={product.saveNameToList}
                                                                onChange={e =>
                                                                    setEditProducts(prev =>
                                                                        prev.map((p, i) =>
                                                                            i === idx
                                                                                ? {
                                                                                      ...p,
                                                                                      saveNameToList:
                                                                                          e.target.checked,
                                                                                  }
                                                                                : p,
                                                                        ),
                                                                    )
                                                                }
                                                                disabled={savingForm}
                                                            />
                                                            <label htmlFor={`save-pname-${idx}`}>
                                                                Salvar "{product.name}" no catálogo
                                                            </label>
                                                        </div>
                                                    )}

                                                    {valueChanged && (
                                                        <div className={styles.productSaveCheckbox}>
                                                            <input
                                                                type='checkbox'
                                                                id={`save-pval-${idx}`}
                                                                checked={product.saveValueToList}
                                                                onChange={e =>
                                                                    setEditProducts(prev =>
                                                                        prev.map((p, i) =>
                                                                            i === idx
                                                                                ? {
                                                                                      ...p,
                                                                                      saveValueToList:
                                                                                          e.target.checked,
                                                                                  }
                                                                                : p,
                                                                        ),
                                                                    )
                                                                }
                                                                disabled={savingForm}
                                                            />
                                                            <label htmlFor={`save-pval-${idx}`}>
                                                                Salvar valor atualizado no catálogo
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
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
                        </div>

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
                                                const linkedProducts = procedures.filter(
                                                    p => p.is_product && p.parent_procedure === proc.id,
                                                );
                                                return (
                                                    <li key={proc.id} className={styles.procItem}>
                                                        <div className={styles.procRow}>
                                                            <div className={styles.procMain}>
                                                                <div className={styles.procTextBlock}>
                                                                    <div className={styles.procLabelRow}>
                                                                        <button
                                                                            type='button'
                                                                            className={styles.checkBtn}
                                                                            onClick={() =>
                                                                                void toggleProcedureCompleted(proc)
                                                                            }
                                                                            aria-label={
                                                                                isProcedureCompleted(proc)
                                                                                    ? 'Marcar como pendente'
                                                                                    : 'Marcar como concluido'
                                                                            }
                                                                            title={
                                                                                isProcedureCompleted(proc)
                                                                                    ? 'Marcar como pendente'
                                                                                    : 'Marcar como concluido'
                                                                            }
                                                                        >
                                                                            <svg
                                                                                viewBox='0 0 24 24'
                                                                                aria-hidden='true'
                                                                                className={`${styles.statusCheck} ${
                                                                                    isProcedureCompleted(proc)
                                                                                        ? styles.statusCheckCompleted
                                                                                        : styles.statusCheckPending
                                                                                }`}
                                                                            >
                                                                                <path
                                                                                    d='M5 12.5 9.2 16.7 19 7.6'
                                                                                    fill='none'
                                                                                    stroke='currentColor'
                                                                                    strokeWidth='3.2'
                                                                                    strokeLinecap='round'
                                                                                    strokeLinejoin='round'
                                                                                />
                                                                            </svg>
                                                                        </button>
                                                                        <strong className={styles.procLabel}>
                                                                            {tooth
                                                                                ? `Dente ${tooth.international_number}`
                                                                                : 'Geral'}
                                                                        </strong>
                                                                    </div>
                                                                    <div className={styles.procDescriptionRow}>
                                                                        <span className={styles.procDescription}>
                                                                            {proc.name}
                                                                        </span>
                                                                        {proc.faces_raw && (
                                                                            <span className={styles.faceBadge}>
                                                                                {proc.faces_raw}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className={styles.procAside}>
                                                                <div className={styles.procFinanceGroup}>
                                                                    <div className={styles.procValueWrap}>
                                                                        <span className={styles.procValue}>
                                                                            {formatMoney(proc.patient_amount)}
                                                                        </span>
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
                                                                    </div>
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
                                                                        <span className={styles.paymentSymbol}>
                                                                            PG
                                                                        </span>
                                                                    </button>
                                                                </div>
                                                                <div className={styles.procManageGroup}>
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
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {linkedProducts.length > 0 && (
                                                            <div className={styles.procProductList}>
                                                                <div className={styles.procProductHeader}>
                                                                    Produto
                                                                </div>
                                                                {linkedProducts.map(product => (
                                                                    <div
                                                                        key={product.id}
                                                                        className={styles.productSubRow}
                                                                    >
                                                                        <div className={styles.productSubRowBody}>
                                                                            <span className={styles.productSubRowName}>
                                                                                {product.name}
                                                                            </span>
                                                                            <div className={styles.productSubRowActions}>
                                                                                <div className={styles.procFinanceGroup}>
                                                                                    <div className={styles.procValueWrap}>
                                                                                        <span className={styles.procValue}>
                                                                                            {formatMoney(
                                                                                                product.patient_amount,
                                                                                            )}
                                                                                        </span>
                                                                                        {product.paid_at && (
                                                                                            <>
                                                                                                <span
                                                                                                    className={
                                                                                                        styles.productPaidDateDesktop
                                                                                                    }
                                                                                                >
                                                                                                    {`Pago em ${formatDate(product.paid_at)}`}
                                                                                                </span>
                                                                                                <span
                                                                                                    className={
                                                                                                        styles.paidDateMobile
                                                                                                    }
                                                                                                >
                                                                                                    {formatDateShort(
                                                                                                        product.paid_at,
                                                                                                    )}
                                                                                                </span>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                    <button
                                                                                        type='button'
                                                                                        className={`${styles.iconBtn} ${
                                                                                            isProcedurePaid(product)
                                                                                                ? styles.iconBtnPaidActive
                                                                                                : ''
                                                                                        }`}
                                                                                        onClick={() =>
                                                                                            void toggleProcedurePaid(
                                                                                                product,
                                                                                            )
                                                                                        }
                                                                                        aria-label={
                                                                                            isProcedurePaid(product)
                                                                                                ? 'Marcar como pendente de pagamento'
                                                                                                : 'Marcar como pago'
                                                                                        }
                                                                                        title={
                                                                                            isProcedurePaid(product)
                                                                                                ? `Pago em ${formatDate(product.paid_at)}`
                                                                                                : 'Marcar produto como pago'
                                                                                        }
                                                                                    >
                                                                                        <span
                                                                                            className={
                                                                                                styles.paymentSymbol
                                                                                            }
                                                                                        >
                                                                                            {isProcedurePaid(product)
                                                                                                ? 'PAGO'
                                                                                                : 'PG'}
                                                                                        </span>
                                                                                    </button>
                                                                                </div>
                                                                                <div className={styles.procManageGroup}>
                                                                                    <button
                                                                                        type='button'
                                                                                        className={styles.iconBtn}
                                                                                        onClick={() =>
                                                                                            openEditForm(proc)
                                                                                        }
                                                                                        aria-label='Editar procedimento'
                                                                                        title='Editar procedimento (abre o formulário do procedimento pai)'
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
                                                                                            void deleteProcedure(
                                                                                                product.id,
                                                                                            )
                                                                                        }
                                                                                        aria-label='Apagar produto'
                                                                                        title='Apagar produto'
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
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className={styles.legendPanel}>
                            <details className={styles.faceLegend}>
                                <summary>Legenda das faces (V, D, VO, DVMO...)</summary>
                                <p>
                                    O: Oclusal, V: Vestibular, P: Palatina/Lingual, M: Mesial,
                                    D: Distal, MO: Mesial/Oclusal, DO: Distal/Oclusal, VO:
                                    Vestibular/Oclusal, PO: Palatina/Oclusal, MDO: Mesial/Distal/Oclusal.
                                </p>
                            </details>
                        </div>
                    </section>

                </>
            )}
        </div>
    );
}
