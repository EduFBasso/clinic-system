// frontend\src\components\MainContent.tsx
import { API_BASE } from '../config/api';
import React, { useState } from 'react';
import styles from '../styles/components/Main.module.css';
import { useClients } from '../hooks/useClients';
import ClientCard from './ClientCard';
import type { ClientBasic } from '../types/ClientBasic';
import AppModal from './Modal';
import type { ClientData } from '../types/ClientData';
import SessionExpiredModal from './SessionExpiredModal';
import { dispatchLogout, hasActiveSession } from '../utils/auth/session';
import { apiFetch } from '../utils/apiFetch';

// Normaliza texto para comparação: remove acentos, espaços extras e ignora caixa
function normalizeText(s: string) {
    return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

interface MainContentProps {
    selectedClientId: number | null;
    setSelectedClientId: (id: number | null) => void;
    onClientViewData?: (client: ClientData) => void;
    // ...outros props se necessário...
}

type FilterMode = 'all' | 'pending' | 'today' | 'tomorrow';

interface PendingAppointmentLike {
    id: number;
    status: 'scheduled' | 'pending';
    start_at?: string;
    end_at?: string;
    client?: number | { id?: number } | null;
    title?: string;
}

function unwrapAppointmentsList(
    payload: unknown,
): PendingAppointmentLike[] {
    if (Array.isArray(payload)) {
        return payload as PendingAppointmentLike[];
    }
    if (
        payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { results?: unknown[] }).results)
    ) {
        return (payload as { results: PendingAppointmentLike[] }).results;
    }
    return [];
}

function resolveAppointmentClientId(appt: PendingAppointmentLike): number | null {
    if (typeof appt.client === 'number') return appt.client;
    if (appt.client && typeof appt.client === 'object') {
        const id = appt.client.id;
        return typeof id === 'number' ? id : null;
    }
    return null;
}

const CLIENTS_PER_PAGE_OPTIONS = [200, 300, 'all'] as const;
type ClientsPerPageOption = (typeof CLIENTS_PER_PAGE_OPTIONS)[number];

const MainContent: React.FC<MainContentProps> = ({
    selectedClientId,
    setSelectedClientId,
    onClientViewData,
    // ...outros props...
}) => {
    const { clients, loading, error, setError } = useClients();
    const [filter, setFilter] = useState('');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [pendingClientIds, setPendingClientIds] = useState<Set<number>>(
        () => new Set(),
    );
    const [tomorrowClientIds, setTomorrowClientIds] = useState<Set<number>>(
        () => new Set(),
    );
    // Mapa clientId → primeiro agendamento de amanhã (para o botão Avisar com horário correto)
    const [tomorrowClientAppts, setTomorrowClientAppts] = useState<Map<number, PendingAppointmentLike>>(
        () => new Map(),
    );
    const [noResultsOpen, setNoResultsOpen] = useState(false);
    const [clientsPerPage, setClientsPerPage] = useState<ClientsPerPageOption>(200);
    const [currentPage, setCurrentPage] = useState(1);
    // Agenda selection mode state
    const [selectMode, setSelectMode] = useState(false);
    const [returnUrl, setReturnUrl] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmClient, setConfirmClient] = useState<ClientBasic | null>(
        null,
    );
    const detailCacheRef = React.useRef<Map<number, ClientData>>(new Map());
    const cardsGridRef = React.useRef<HTMLDivElement | null>(null);
    const lastNotifiedFilterRef = React.useRef<string>('');
    const mobileFiltersOpenedAtRef = React.useRef(0);
    const mobileFiltersButtonRef = React.useRef<HTMLButtonElement | null>(
        null,
    );
    const [mobileFiltersMenuStyle, setMobileFiltersMenuStyle] = React.useState<
        React.CSSProperties
    >({});

    const updateMobileFiltersMenuPosition = React.useCallback(() => {
        const button = mobileFiltersButtonRef.current;
        if (!button) return;

        const rect = button.getBoundingClientRect();
        const menuWidth = Math.min(220, Math.max(180, Math.round(rect.width * 2.1)));
        const viewportWidth = window.innerWidth;
        const left = Math.max(
            16,
            Math.min(rect.right - menuWidth, viewportWidth - menuWidth - 16),
        );

        setMobileFiltersMenuStyle({
            top: rect.bottom + 8,
            left,
            width: menuWidth,
        });
    }, []);

    const openMobileFilters = React.useCallback(() => {
        updateMobileFiltersMenuPosition();
        mobileFiltersOpenedAtRef.current = Date.now();
        setMobileFiltersOpen(true);
    }, [updateMobileFiltersMenuPosition]);

    const closeMobileFilters = React.useCallback(() => {
        setMobileFiltersOpen(false);
    }, []);

    const closeMobileFiltersFromBackdrop = React.useCallback(() => {
        if (Date.now() - mobileFiltersOpenedAtRef.current < 250) {
            return;
        }
        setMobileFiltersOpen(false);
    }, []);

    React.useEffect(() => {
        if (!mobileFiltersOpen) return;

        const handleViewportChange = () => {
            updateMobileFiltersMenuPosition();
        };

        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);
        window.visualViewport?.addEventListener('resize', handleViewportChange);
        window.visualViewport?.addEventListener('scroll', handleViewportChange);

        return () => {
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
            window.visualViewport?.removeEventListener(
                'resize',
                handleViewportChange,
            );
            window.visualViewport?.removeEventListener(
                'scroll',
                handleViewportChange,
            );
        };
    }, [mobileFiltersOpen, updateMobileFiltersMenuPosition]);

    const applyFilterMode = React.useCallback(
        (mode: FilterMode) => {
            setFilterMode(prev => (prev === mode ? 'all' : mode));
            setFilter('');
            closeMobileFilters();
        },
        [closeMobileFilters],
    );

    const requireActiveSession = React.useCallback(() => {
        if (hasActiveSession()) {
            return true;
        }

        setSelectedClientId(null);
        setError(
            'Sessão expirada ou usuário não autenticado. Faça login novamente.',
        );
        dispatchLogout('session_expired');
        return false;
    }, [setError, setSelectedClientId]);

    // Limpa UI imediatamente ao receber evento de logout/clearClients
    React.useEffect(() => {
        const handleClear = () => {
            setFilter('');
            setNoResultsOpen(false);
            detailCacheRef.current.clear();
        };
        window.addEventListener('clearClients', handleClear);
        return () => window.removeEventListener('clearClients', handleClear);
    }, []);

    React.useEffect(() => {
        const handleRefreshSignals = () => {
            detailCacheRef.current.clear();
        };

        window.addEventListener('updateClients', handleRefreshSignals);
        window.addEventListener('clients:forceRefresh', handleRefreshSignals);

        return () => {
            window.removeEventListener('updateClients', handleRefreshSignals);
            window.removeEventListener(
                'clients:forceRefresh',
                handleRefreshSignals,
            );
        };
    }, []);

    // Pós-exclusão: se viermos da tela de edição após deletar, limpamos o filtro
    // e evitamos mostrar o modal de "nenhum resultado" para o termo anterior.
    React.useEffect(() => {
        try {
            const action = localStorage.getItem('postDeleteAction');
            if (action === 'clearFilter') {
                localStorage.removeItem('postDeleteAction');
                setFilter('');
                setSelectedClientId(null);
                setNoResultsOpen(false);
                lastNotifiedFilterRef.current = '';
                setTimeout(() => {
                    (
                        document.getElementById(
                            'client-filter',
                        ) as HTMLInputElement | null
                    )?.focus?.();
                }, 0);
            }
        } catch {
            /* noop */
        }
        // dependências: apenas setter de seleção vindo de props
    }, [setSelectedClientId]);

    // Mantém o filtro visível quando o teclado virtual abre (iOS/Android)
    React.useEffect(() => {
        const isMobileUA = /iPhone|iPad|iPod|Android/i.test(
            navigator.userAgent,
        );
        if (!isMobileUA) return;

        const input = document.getElementById('client-filter');
        const filterEl = document.querySelector(
            `.${styles.filterContainer}`,
        ) as HTMLElement | null;
        const add = () => document.body.classList.add('keyboardOpen');
        const remove = () => document.body.classList.remove('keyboardOpen');
        input?.addEventListener('focus', add);
        input?.addEventListener('blur', remove);

        // Apoio com VisualViewport: detecta redução de altura quando teclado aparece
        const vv = window.visualViewport;
        let baseline = vv?.height || window.innerHeight;
        const onResize = () => {
            if (!vv) return;
            const activeEl = document.activeElement as HTMLElement | null;
            const isInputFocused =
                !!activeEl &&
                (activeEl.tagName === 'INPUT' ||
                    activeEl.tagName === 'TEXTAREA');
            // Recalibra baseline quando nenhum input está focado (evita falso positivo por UI do Safari)
            if (!isInputFocused) {
                baseline = vv.height;
            }
            const delta = Math.max(0, baseline - vv.height);
            const keyboardLikelyOpen = isInputFocused && delta > 150;
            document.body.classList.toggle('keyboardOpen', keyboardLikelyOpen);
            // Expõe altura do teclado como variável CSS para ajustes visuais
            (document.documentElement as HTMLElement).style.setProperty(
                '--kb-h',
                keyboardLikelyOpen ? `${Math.round(delta)}px` : '0px',
            );
            // Atualiza a altura efetiva do filtro para o CSS calcular o painel
            const fh = filterEl?.getBoundingClientRect().height || 120;
            (document.documentElement as HTMLElement).style.setProperty(
                '--filter-h',
                `${Math.round(fh)}px`,
            );
            // Mantém input visível mesmo com reflows; força alinhamento do caret
            if (keyboardLikelyOpen && document.activeElement === input) {
                setTimeout(() => {
                    input?.scrollIntoView({
                        block: 'start',
                        behavior: 'instant' as ScrollBehavior,
                    });
                }, 0);
            }
        };
        vv?.addEventListener('resize', onResize);

        return () => {
            input?.removeEventListener('focus', add);
            input?.removeEventListener('blur', remove);
            vv?.removeEventListener('resize', onResize);
            document.body.classList.remove('keyboardOpen');
            (document.documentElement as HTMLElement).style.removeProperty(
                '--kb-h',
            );
            (document.documentElement as HTMLElement).style.removeProperty(
                '--filter-h',
            );
        };
    }, []);

    // Hard reset: garante que não iniciamos com o body travado no mobile
    React.useEffect(() => {
        document.body.classList.remove('keyboardOpen');
        try {
            (document.documentElement as HTMLElement).style.removeProperty(
                '--kb-h',
            );
            (document.documentElement as HTMLElement).style.removeProperty(
                '--filter-h',
            );
        } catch {
            /* noop */
        }
    }, []);
    const cardRefs = React.useRef<{ [key: number]: HTMLDivElement | null }>({});
    const lastPrefixTargetRef = React.useRef<number | null>(null);
    const debounceRef = React.useRef<number | null>(null);

    // Helper: desfoca, remove lock e pede atualização da lista
    const refreshAndUnlock = React.useCallback(() => {
        try {
            (document.activeElement as HTMLElement | null)?.blur?.();
            document.body.classList.remove('keyboardOpen');
            window.dispatchEvent(new Event('updateClients'));
        } catch {
            /* noop */
        }
    }, []);

    // Seleciona automaticamente o novo cliente cadastrado assim que aparecer na lista
    React.useEffect(() => {
        const newClientId = localStorage.getItem('newClientId');
        if (newClientId && clients.some(c => c.id === Number(newClientId))) {
            setSelectedClientId(Number(newClientId));
            localStorage.removeItem('newClientId');
        }
    }, [clients, setSelectedClientId]);

    // Se o cartão selecionado deixar de existir (ex.: após exclusão), limpa a seleção
    // e remove o foco de qualquer elemento dentro da grade para evitar travas no mobile.
    React.useEffect(() => {
        if (!selectedClientId) return;
        const stillExists = clients.some(c => c.id === selectedClientId);
        if (!stillExists) {
            setSelectedClientId(null);
            const active = document.activeElement as HTMLElement | null;
            if (active && active.closest?.(`.${styles.cardsGrid}`)) {
                active.blur?.();
            }
            // Garante atualização/realinhamento
            refreshAndUnlock();
        }
    }, [clients, selectedClientId, setSelectedClientId, refreshAndUnlock]);

    // Força uma atualização quando a tela monta (evita estados inconsistentes pós navegação)
    React.useEffect(() => {
        const t = window.setTimeout(() => refreshAndUnlock(), 0);
        return () => window.clearTimeout(t);
    }, [refreshAndUnlock]);

    // Modo seleção vindo da Agenda: se URL tiver selectClientFor=agenda, foca filtro e aplica retorno
    React.useEffect(() => {
        try {
            const url = new URL(window.location.href);
            const mode = url.searchParams.get('selectClientFor');
            const ret = url.searchParams.get('return');
            if (mode === 'agenda') {
                // Foca no filtro para o usuário digitar
                const input = document.getElementById(
                    'client-filter',
                ) as HTMLInputElement | null;
                input?.focus?.();
                // Guarda return para uso no clique de cartão
                if (ret) {
                    localStorage.setItem('agenda.returnUrl', ret);
                    setReturnUrl(ret);
                }
                setSelectMode(true);
            }
        } catch {
            /* noop */
        }
    }, []);

    // Integra com NavBar: foco no cartão selecionado ou solicitar seleção
    React.useEffect(() => {
        function onFocusSelectedClientCard() {
            if (!selectedClientId) return;
            const el = cardRefs.current[selectedClientId];
            if (el) {
                el.scrollIntoView({
                    block: 'center',
                    behavior: 'instant' as ScrollBehavior,
                });
                (
                    el.querySelector('button, [tabindex]') as HTMLElement | null
                )?.focus?.();
            }
        }
        function onScrollToClientCard(e: Event) {
            const detail = (e as CustomEvent).detail || {};
            const id: number | undefined = detail.clientId;
            if (!id) return;
            const el = cardRefs.current[id];
            if (el) {
                el.scrollIntoView({
                    block: 'center',
                    behavior: 'instant' as ScrollBehavior,
                });
            }
        }
        function onNeedClientSelectionForAgenda() {
            const input = document.getElementById(
                'client-filter',
            ) as HTMLInputElement | null;
            input?.focus?.();
        }
        window.addEventListener(
            'focusSelectedClientCard',
            onFocusSelectedClientCard,
        );
        window.addEventListener('scrollToClientCard', onScrollToClientCard);
        window.addEventListener(
            'needClientSelectionForAgenda',
            onNeedClientSelectionForAgenda,
        );
        return () => {
            window.removeEventListener(
                'focusSelectedClientCard',
                onFocusSelectedClientCard,
            );
            window.removeEventListener(
                'scrollToClientCard',
                onScrollToClientCard,
            );
            window.removeEventListener(
                'needClientSelectionForAgenda',
                onNeedClientSelectionForAgenda,
            );
        };
    }, [selectedClientId]);

    // Filtra clientes por nome (acentos/maiúsculas ignorados)
    const normalizedFilter = normalizeText(filter);
    const filteredClients = clients.filter(client =>
        normalizeText(`${client.first_name} ${client.last_name}`).includes(
            normalizedFilter,
        ),
    );

    const sortByPeriodThenTime = React.useCallback(
        (a: ClientBasic, b: ClientBasic) => {
            const getPeriodRank = (iso?: string | null) => {
                if (!iso) return 99;
                const d = new Date(iso);
                const hour = d.getHours();
                if (hour < 12) return 0; // morning
                if (hour < 18) return 1; // tarde
                return 2; // noite
            };

            const ra = getPeriodRank(a.next_appointment_start_at);
            const rb = getPeriodRank(b.next_appointment_start_at);
            if (ra !== rb) return ra - rb;

            const ta = a.next_appointment_start_at
                ? new Date(a.next_appointment_start_at).getTime()
                : Number.MAX_SAFE_INTEGER;
            const tb = b.next_appointment_start_at
                ? new Date(b.next_appointment_start_at).getTime()
                : Number.MAX_SAFE_INTEGER;
            return ta - tb;
        },
        [],
    );

    const isSameLocalDay = React.useCallback((iso: string, target: Date) => {
        const d = new Date(iso);
        return (
            d.getFullYear() === target.getFullYear() &&
            d.getMonth() === target.getMonth() &&
            d.getDate() === target.getDate()
        );
    }, []);

    const todayClients = React.useMemo(() => {
        const today = new Date();
        return clients
            .filter(c => {
                if (c.next_appointment_status !== 'scheduled') return false;
                if (!c.next_appointment_start_at) return false;
                return isSameLocalDay(c.next_appointment_start_at, today);
            })
            .sort(sortByPeriodThenTime);
    }, [clients, isSameLocalDay, sortByPeriodThenTime]);

    // Clientes com agendamento amanhã.
    // Usa tomorrowClientIds (Set<number>) construído no effect de carregamento de agendamentos
    // para cobrir TODOS os agendamentos do cliente amanhã — não apenas next_appointment_start_at.
    // Exemplo: cliente com next_appointment hoje + future_appointment amanhã seria ignorado
    // pelo filtro se só checássemos next_appointment_start_at.
    const tomorrowClients = React.useMemo(() => {
        return clients
            .filter(c => tomorrowClientIds.has(c.id))
            .sort(sortByPeriodThenTime);
    }, [clients, tomorrowClientIds, sortByPeriodThenTime]);

    // Clientes com compromisso pendente.
    // Fonte de verdade: backend (status='pending' + resumo no payload de clientes).
    // A lista scheduled abaixo é usada somente para o bloco de "amanhã".
    React.useEffect(() => {
        let cancelled = false;

        async function loadPendingClientIds() {
            const token = localStorage.getItem('accessToken');
            if (!token || clients.length === 0) {
                if (!cancelled) {
                    setPendingClientIds(new Set());
                    setTomorrowClientIds(new Set());
                    setTomorrowClientAppts(new Map());
                }
                return;
            }

            const pendingUrl = `${API_BASE}/agenda/appointments/?status=pending&ordering=-end_at&limit=300&ts=${Date.now()}`;
            const scheduledUrl = `${API_BASE}/agenda/appointments/?status=scheduled&ordering=-end_at&limit=300&ts=${Date.now()}`;

            try {
                const [pendingDataRaw, scheduledDataRaw] = await Promise.all([
                    apiFetch(pendingUrl, { cache: 'no-store', timeoutMs: 12000 }),
                    apiFetch(scheduledUrl, { cache: 'no-store', timeoutMs: 12000 }),
                ]);

                const pendingData = unwrapAppointmentsList(pendingDataRaw);
                const scheduledData = unwrapAppointmentsList(scheduledDataRaw);

                const ids = new Set<number>();
                const tomorrowIds = new Set<number>();
                // Primeiro agendamento de amanhã por cliente (horário mais cedo)
                const tomorrowAppts = new Map<number, PendingAppointmentLike>();

                // Calcula os limites do dia de amanhã em hora local
                const tmw = new Date();
                tmw.setDate(tmw.getDate() + 1);
                const tmwStart = new Date(tmw.getFullYear(), tmw.getMonth(), tmw.getDate(), 0, 0, 0, 0).getTime();
                const tmwEnd   = new Date(tmw.getFullYear(), tmw.getMonth(), tmw.getDate(), 23, 59, 59, 999).getTime();

                pendingData.forEach(appt => {
                    const clientId = resolveAppointmentClientId(appt);
                    if (clientId != null) ids.add(clientId);
                });

                // Complemento via resumo de clientes para consistência com cartões
                clients.forEach(c => {
                    const anyClient = c as unknown as Record<string, unknown>;
                    if (anyClient.has_pending_appointment === true) {
                        ids.add(c.id);
                        return;
                    }
                    if (
                        c.next_appointment_status === 'pending' ||
                        c.last_appointment_status === 'pending'
                    ) {
                        ids.add(c.id);
                    }
                });

                // Ordena agendados por start_at para garantir que o primeiro de amanhã seja o mais cedo
                const sortedScheduled = [...scheduledData].sort((a, b) => {
                    const ta = a.start_at ? new Date(a.start_at).getTime() : 0;
                    const tb = b.start_at ? new Date(b.start_at).getTime() : 0;
                    return ta - tb;
                });

                sortedScheduled.forEach(appt => {
                    const clientId = resolveAppointmentClientId(appt);
                    if (clientId == null) return;

                    // Agendados para amanhã (qualquer horário do dia)
                    const startMs = appt.start_at
                        ? new Date(appt.start_at).getTime()
                        : NaN;
                    if (Number.isFinite(startMs) && startMs >= tmwStart && startMs <= tmwEnd) {
                        tomorrowIds.add(clientId);
                        // Guarda apenas o mais cedo (lista já ordenada)
                        if (!tomorrowAppts.has(clientId)) {
                            tomorrowAppts.set(clientId, appt);
                        }
                    }
                });

                if (!cancelled) {
                    setPendingClientIds(ids);
                    setTomorrowClientIds(tomorrowIds);
                    setTomorrowClientAppts(tomorrowAppts);
                }
            } catch {
                if (!cancelled) {
                    setPendingClientIds(new Set());
                    setTomorrowClientIds(new Set());
                    setTomorrowClientAppts(new Map());
                }
            }
        }

        void loadPendingClientIds();

        const onUpdateClients = () => {
            void loadPendingClientIds();
        };
        window.addEventListener('updateClients', onUpdateClients);
        window.addEventListener('appointments:changed', onUpdateClients);

        return () => {
            cancelled = true;
            window.removeEventListener('updateClients', onUpdateClients);
            window.removeEventListener('appointments:changed', onUpdateClients);
        };
    }, [clients.length]);

    const pendingClients = React.useMemo(() => {
        return clients
            .filter(c => pendingClientIds.has(c.id))
            .sort((a, b) => {
                const ta = a.last_appointment_start_at
                    ? new Date(a.last_appointment_start_at).getTime()
                    : 0;
                const tb = b.last_appointment_start_at
                    ? new Date(b.last_appointment_start_at).getTime()
                    : 0;
                return ta - tb;
                });
            }, [clients, pendingClientIds]);

    const pendingCount = pendingClients.length;
    const todayCount = todayClients.length;
    const tomorrowCount = tomorrowClients.length;

    // Se o filtro de pendentes estiver ativo mas não houver mais pendentes, desativa
    React.useEffect(() => {
        if (filterMode === 'pending' && pendingCount === 0) {
            setFilterMode('all');
        }
    }, [filterMode, pendingCount]);

    const displayedClients = React.useMemo(() => {
        if (filterMode === 'pending') return pendingClients;
        if (filterMode === 'today') return todayClients;
        if (filterMode === 'tomorrow') return tomorrowClients;
        return filteredClients;
    }, [
        filterMode,
        pendingClients,
        todayClients,
        tomorrowClients,
        filteredClients,
    ]);

    const deferredDisplayedClients = React.useDeferredValue(displayedClients);
    const effectiveClientsPerPage =
        clientsPerPage === 'all'
            ? Math.max(1, deferredDisplayedClients.length || 1)
            : clientsPerPage;
    const totalPages = Math.max(
        1,
        Math.ceil(deferredDisplayedClients.length / effectiveClientsPerPage),
    );
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const pageStartIndex = (safeCurrentPage - 1) * effectiveClientsPerPage;
    const pageEndIndex = Math.min(
        pageStartIndex + effectiveClientsPerPage,
        deferredDisplayedClients.length,
    );
    const visibleClients = React.useMemo(
        () => deferredDisplayedClients.slice(pageStartIndex, pageEndIndex),
        [deferredDisplayedClients, pageEndIndex, pageStartIndex],
    );

    React.useEffect(() => {
        setCurrentPage(1);
    }, [filter, filterMode, clientsPerPage]);

    React.useEffect(() => {
        if (currentPage <= totalPages) {
            return;
        }
        setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const scrollCardsToTop = React.useCallback(() => {
        cardsGridRef.current?.scrollIntoView({
            block: 'start',
            behavior: 'smooth',
        });
    }, []);

    const goToPage = React.useCallback(
        (nextPage: number) => {
            const normalized = Math.max(1, Math.min(nextPage, totalPages));
            if (normalized === safeCurrentPage) {
                return;
            }
            React.startTransition(() => {
                setCurrentPage(normalized);
            });
            scrollCardsToTop();
        },
        [safeCurrentPage, scrollCardsToTop, totalPages],
    );

    // Abre modal de "Nenhum cliente encontrado" quando não houver resultados.
    React.useEffect(() => {
        if (!filter) {
            lastNotifiedFilterRef.current = '';
            if (noResultsOpen) setNoResultsOpen(false);
            return;
        }
        if (
            filteredClients.length === 0 &&
            lastNotifiedFilterRef.current !== filter
        ) {
            lastNotifiedFilterRef.current = filter;
            setNoResultsOpen(true);
        }
        if (filteredClients.length > 0 && noResultsOpen) {
            setNoResultsOpen(false);
        }
    }, [filter, filteredClients.length, noResultsOpen]);

    // Navega automaticamente para o primeiro cartão cujo nome comece com o filtro digitado.
    // Debounce curto e só rola se o alvo mudou, evitando "vai e volta" a cada tecla.
    React.useEffect(() => {
        // Se filtro vazio, reseta alvo e não faz scroll.
        if (!filter) {
            lastPrefixTargetRef.current = null;
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
            return;
        }
        if (!filteredClients.length) return;

        const normFilter = normalizeText(filter);
        let firstPrefix = filteredClients.find(c =>
            normalizeText(`${c.first_name} ${c.last_name}`).startsWith(
                normFilter,
            ),
        );
        // Se não houver começo exato, procura por substring para não "falhar" com uma letra só
        if (!firstPrefix) {
            firstPrefix = filteredClients.find(c =>
                normalizeText(`${c.first_name} ${c.last_name}`).includes(
                    normFilter,
                ),
            );
        }
        if (!firstPrefix) return;

        // Se o mesmo cartão já foi alvo, não rola novamente nesta digitação.
        if (lastPrefixTargetRef.current === firstPrefix.id) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
            lastPrefixTargetRef.current = firstPrefix.id;
            const el = cardRefs.current[firstPrefix.id];
            if (!el) return;
            // Seleciona o cartão para aplicar o mesmo destaque de salvar/editar
            if (selectedClientId !== firstPrefix.id) {
                setSelectedClientId(firstPrefix.id);
            }
            // Garante que o cartão fique imediatamente abaixo do filtro visível
            const inputEl = document.getElementById('client-filter');
            const filterEl = document.querySelector(
                `.${styles.filterContainer}`,
            ) as HTMLElement | null;
            requestAnimationFrame(() => {
                const targetRect = el.getBoundingClientRect();
                const filterRect = filterEl?.getBoundingClientRect();
                const desiredTop = (filterRect ? filterRect.bottom : 0) + 24; // respiro maior para não ficar sob o filtro
                const delta = targetRect.top - desiredTop;
                if (Math.abs(delta) > 1) {
                    const container = document.body.classList.contains(
                        'keyboardOpen',
                    )
                        ? (document.querySelector(
                              'main.' + styles.main,
                          ) as HTMLElement | null)
                        : null;
                    if (container) {
                        container.scrollBy({ top: delta, behavior: 'smooth' });
                    } else {
                        window.scrollBy({ top: delta, behavior: 'smooth' });
                    }
                }
                // Se o teclado estiver aberto, mantém o input visível
                if (
                    document.body.classList.contains('keyboardOpen') &&
                    document.activeElement === inputEl
                ) {
                    inputEl?.scrollIntoView({
                        block: 'start',
                        behavior: 'instant' as ScrollBehavior,
                    });
                }
            });
        }, 140);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
        };
    }, [filter, filteredClients, selectedClientId, setSelectedClientId]);

    function handleView(cliente: ClientBasic) {
        if (!requireActiveSession()) {
            return;
        }
        const cached = detailCacheRef.current.get(cliente.id);
        if (cached) {
            onClientViewData?.(cached);
            return;
        }
        // Solta qualquer foco ativo antes de abrir a visualização, evitando foco "grudado" caso o item seja removido depois
        try {
            (document.activeElement as HTMLElement | null)?.blur?.();
        } catch {
            /* noop */
        }
        apiFetch(`/register/clients/${cliente.id}/`, {
            timeoutMs: 12000,
        })
            .then((data: ClientData) => {
                detailCacheRef.current.set(cliente.id, data);
                onClientViewData?.(data);
            })
            .catch(() => {
                alert('Erro ao buscar dados completos do cliente');
            });
    }

    return (
        <main className={styles.main}>
            <div
                className={`${styles.filterContainer}${mobileFiltersOpen ? ` ${styles.filterContainerMenuOpen}` : ''}`}
            >
                <div className={styles.filterRow}>
                    <input
                        id='client-filter'
                        type='text'
                        className={styles.filterInput}
                        placeholder='Digite o nome do cliente...'
                        value={filter}
                        onChange={e => {
                            setFilter(e.target.value);
                            if (filterMode !== 'all') setFilterMode('all');
                        }}
                    />
                    <div className={styles.filterActionsDesktop}>
                        <button
                            className={`${styles.filterToggleBtn}${filterMode === 'pending' ? ' ' + styles.filterToggleBtnActive : ''}`}
                            onClick={() => applyFilterMode('pending')}
                            title='Filtrar por compromissos pendentes'
                        >
                            {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                        </button>
                        <button
                            className={`${styles.filterToggleBtn}${filterMode === 'today' ? ' ' + styles.filterToggleBtnActive : ''}`}
                            onClick={() => applyFilterMode('today')}
                            title='Filtrar compromissos de hoje'
                        >
                            Hoje {todayCount > 0 ? `(${todayCount})` : ''}
                        </button>
                        <button
                            className={`${styles.filterToggleBtn}${filterMode === 'tomorrow' ? ' ' + styles.filterToggleBtnActive : ''}`}
                            onClick={() => applyFilterMode('tomorrow')}
                            title='Filtrar compromissos de amanhã'
                        >
                            Amanhã {tomorrowCount > 0 ? `(${tomorrowCount})` : ''}
                        </button>
                    </div>

                    <div className={styles.filterActionsMobile}>
                        <button
                            ref={mobileFiltersButtonRef}
                            className={`${styles.filtersMenuButton}${filterMode !== 'all' ? ' ' + styles.filtersMenuButtonActive : ''}`}
                            onClick={e => {
                                e.stopPropagation();
                                if (mobileFiltersOpen) {
                                    closeMobileFilters();
                                } else {
                                    openMobileFilters();
                                }
                            }}
                            aria-expanded={mobileFiltersOpen}
                            aria-haspopup='menu'
                            title='Abrir filtros'
                        >
                            Filtros
                        </button>

                        {mobileFiltersOpen && (
                            <button
                                type='button'
                                className={styles.filtersMenuBackdrop}
                                onClick={closeMobileFiltersFromBackdrop}
                                aria-label='Fechar filtros'
                            />
                        )}

                        {mobileFiltersOpen && (
                            <div
                                className={styles.filtersMenuPanel}
                                style={mobileFiltersMenuStyle}
                                role='menu'
                                onClick={e => e.stopPropagation()}
                            >
                                <button
                                    className={`${styles.filtersMenuItem}${filterMode === 'all' ? ' ' + styles.filtersMenuItemActive : ''}`}
                                    onClick={() => {
                                        setFilterMode('all');
                                        setFilter('');
                                        closeMobileFilters();
                                    }}
                                    role='menuitem'
                                >
                                    Sem filtro
                                </button>
                                <button
                                    className={`${styles.filtersMenuItem}${filterMode === 'pending' ? ' ' + styles.filtersMenuItemActive : ''}`}
                                    onClick={() => applyFilterMode('pending')}
                                    role='menuitem'
                                >
                                    Pendentes ({pendingCount})
                                </button>
                                <button
                                    className={`${styles.filtersMenuItem}${filterMode === 'today' ? ' ' + styles.filtersMenuItemActive : ''}`}
                                    onClick={() => applyFilterMode('today')}
                                    role='menuitem'
                                >
                                    Hoje ({todayCount})
                                </button>
                                <button
                                    className={`${styles.filtersMenuItem}${filterMode === 'tomorrow' ? ' ' + styles.filtersMenuItemActive : ''}`}
                                    onClick={() => applyFilterMode('tomorrow')}
                                    role='menuitem'
                                >
                                    Amanhã ({tomorrowCount})
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {loading && clients.length === 0 && (
                <div>Carregando clientes...</div>
            )}
            {error && error.includes('Sessão expirada') && (
                <SessionExpiredModal
                    open={true}
                    onClose={() => {
                        setError(null);
                        dispatchLogout('session_expired');
                    }}
                    message='Sua sessão expirou ou você não está autenticado. Por favor, faça login para acessar os clientes.'
                    color='var(--color-error-light)'
                />
            )}
            {error && !error.includes('Sessão expirada') && (
                <div style={{ color: 'red' }}>{error}</div>
            )}
            {/* Friendly selection banner for Agenda flow */}
            {selectMode && (
                <div
                    style={{
                        margin: '8px 0 12px',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid #f59e0b33',
                        background: 'var(--color-warning-bg)', // amber-50
                        color: 'var(--color-warning-dark)', // amber-700
                        fontWeight: 600,
                    }}
                >
                    Selecione um cliente para agendar
                </div>
            )}
            <div ref={cardsGridRef} className={styles.cardsGrid}>
                {visibleClients.map(client => (
                    <div
                        key={client.id}
                        ref={el => {
                            cardRefs.current[client.id] = el;
                        }}
                    >
                        <ClientCard
                            client={client}
                            selected={selectedClientId === client.id}
                            filterMode={filterMode}
                            notifyAppt={filterMode === 'tomorrow' ? tomorrowClientAppts.get(client.id) : undefined}
                            onSelect={() => {
                                if (!requireActiveSession()) {
                                    return;
                                }
                                setSelectedClientId(client.id);
                                // Se estamos em modo seleção para agenda, abre modal de confirmação customizado
                                try {
                                    const url = new URL(window.location.href);
                                    const mode =
                                        url.searchParams.get('selectClientFor');
                                    if (mode === 'agenda') {
                                        setConfirmClient(client);
                                        setConfirmOpen(true);
                                    }
                                } catch {
                                    /* noop */
                                }
                            }}
                            onView={handleView}
                        />
                    </div>
                ))}
            </div>
            <div className={styles.paginationBar}>
                <div className={styles.paginationSummary}>
                    {deferredDisplayedClients.length > 0
                        ? `Exibindo ${pageStartIndex + 1} a ${pageEndIndex} de ${deferredDisplayedClients.length} clientes.`
                        : 'Nenhum cliente para exibir.'}
                </div>
                <div className={styles.paginationControls}>
                    <label className={styles.paginationPageSizeLabel}>
                        <span>Por página</span>
                        <select
                            className={styles.paginationPageSizeSelect}
                            value={clientsPerPage}
                            onChange={event => {
                                const rawValue = event.target.value;
                                if (rawValue === 'all') {
                                    setClientsPerPage('all');
                                    return;
                                }
                                const nextSize = Number(rawValue);
                                if (!Number.isFinite(nextSize)) return;
                                setClientsPerPage(nextSize as ClientsPerPageOption);
                            }}
                        >
                            {CLIENTS_PER_PAGE_OPTIONS.map(option => (
                                <option key={option} value={option}>
                                    {option === 'all' ? 'Todos' : option}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className={styles.paginationButtons}>
                        <button
                            type='button'
                            className={styles.paginationButton}
                            onClick={() => goToPage(safeCurrentPage - 1)}
                            disabled={safeCurrentPage <= 1}
                        >
                            Anterior
                        </button>
                        <span className={styles.paginationPageIndicator}>
                            Página {safeCurrentPage} de {totalPages}
                        </span>
                        <button
                            type='button'
                            className={styles.paginationButton}
                            onClick={() => goToPage(safeCurrentPage + 1)}
                            disabled={safeCurrentPage >= totalPages}
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmation modal for Agenda selection */}
            <AppModal
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                showCloseButton={false}
                closeOnEscape
                disableBackdropClose
            >
                <div style={{ display: 'grid', gap: 12 }}>
                    <h3 style={{ margin: 0 }}>Confirmar agendamento</h3>
                    <div>
                        Usar o cliente{' '}
                        <strong>
                            {confirmClient
                                ? `${confirmClient.first_name} ${confirmClient.last_name}`.trim()
                                : ''}
                        </strong>{' '}
                        para um novo compromisso?
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            gap: 8,
                            justifyContent: 'flex-end',
                            marginTop: 4,
                        }}
                    >
                        <button
                            onClick={() => {
                                // Cancelar Agendamento: sair do fluxo e retornar à Agenda (sem new=1)
                                const ret =
                                    returnUrl ||
                                    localStorage.getItem('agenda.returnUrl') ||
                                    '/agenda'; // kept: Home handles /agenda via modals
                                try {
                                    const u = new URL(
                                        ret,
                                        window.location.origin,
                                    );
                                    u.searchParams.delete('new');
                                    window.location.href =
                                        u.pathname + (u.search || '');
                                } catch {
                                    window.location.href = '/agenda'; // triggers Home route which opens modals
                                }
                            }}
                            style={{
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1px solid #e5e7eb',
                                background: '#fff',
                            }}
                        >
                            Cancelar Agendamento
                        </button>
                        <button
                            onClick={() => {
                                if (!confirmClient) return;
                                // Confirm: continuar fluxo, voltar à Agenda com client
                                const label =
                                    `${confirmClient.first_name} ${confirmClient.last_name}`.trim();
                                localStorage.setItem(
                                    `client.name.${confirmClient.id}`,
                                    label,
                                );
                                const ret =
                                    returnUrl ||
                                    localStorage.getItem('agenda.returnUrl') ||
                                    '/agenda'; // kept for compatibility
                                const sep = ret.includes('?') ? '&' : '?';
                                window.location.href = `${ret}${sep}client=${confirmClient.id}`;
                            }}
                            style={{
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1px solid #059669',
                                background: '#10b981',
                                color: '#fff',
                            }}
                        >
                            Confirmar
                        </button>
                    </div>
                </div>
            </AppModal>

            {/* Modal de nenhum resultado encontrado */}
            <AppModal
                open={noResultsOpen}
                onClose={() => {
                    setNoResultsOpen(false);
                    const input = document.getElementById(
                        'client-filter',
                    ) as HTMLInputElement | null;
                    if (input) {
                        input.focus();
                        const len = input.value.length;
                        input.setSelectionRange(len, len);
                    }
                }}
                showCloseButton
                closeOnEnter
                closeOnEscape
                disableBackdropClose
                disableEscapeKeyDown
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                    }}
                >
                    <h3 style={{ margin: 0 }}>Nenhum cliente encontrado</h3>
                    <p style={{ margin: 0 }}>
                        Nenhum resultado para "{filter}". Apague uma letra ou
                        comece do zero.
                    </p>
                    <div
                        style={{
                            display: 'flex',
                            gap: 8,
                            marginTop: 12,
                            justifyContent: 'flex-end',
                        }}
                    >
                        <button
                            onClick={() => {
                                setFilter('');
                                setNoResultsOpen(false);
                                const input = document.getElementById(
                                    'client-filter',
                                ) as HTMLInputElement | null;
                                if (input) {
                                    input.focus();
                                }
                            }}
                            style={{
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: '1px solid var(--border-color, rgba(0,0,0,0.12))',
                                background: 'var(--color-bg, #fff)',
                                cursor: 'pointer',
                            }}
                        >
                            Começar do zero
                        </button>
                        <button
                            onClick={() => {
                                setNoResultsOpen(false);
                                const input = document.getElementById(
                                    'client-filter',
                                ) as HTMLInputElement | null;
                                if (input) {
                                    input.focus();
                                }
                            }}
                            style={{
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: 'none',
                                background: 'var(--color-primary, #1976d2)',
                                color: '#fff',
                                cursor: 'pointer',
                            }}
                        >
                            Ok
                        </button>
                    </div>
                </div>
            </AppModal>
        </main>
    );
};

export default MainContent;
