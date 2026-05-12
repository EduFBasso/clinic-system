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
import { dispatchLogout, hasActiveSession , getAccessToken } from '../utils/auth/session';
import { apiFetch } from '../utils/apiFetch';
import { useNowTick } from '../hooks/useNowTick';
import { useOngoingSweep } from '../hooks/useOngoingSweep';

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

type FilterMode = 'all' | 'pending' | 'today' | 'tomorrow' | 'ongoing';

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

const CLIENTS_PER_PAGE_OPTIONS = [50, 200, 'all'] as const;
type ClientsPerPageOption = (typeof CLIENTS_PER_PAGE_OPTIONS)[number];
const PAGINATION_STORAGE_KEY = 'ui.clientsPerPage';
const SCROLL_SESSION_KEY = 'home.scrollY';
const FILTER_SESSION_KEY = 'home.filter';
function readStoredClientsPerPage(): ClientsPerPageOption {
    try {
        const raw = localStorage.getItem(PAGINATION_STORAGE_KEY);
        const n = Number(raw);
        // 'all' never persisted; only restore numeric options
        if (Number.isFinite(n) && n > 0 && (CLIENTS_PER_PAGE_OPTIONS as readonly (number | string)[]).includes(n)) {
            return n as ClientsPerPageOption;
        }
    } catch { /* noop */ }
    return 50;
}

const MainContent: React.FC<MainContentProps> = ({
    selectedClientId,
    setSelectedClientId,
    onClientViewData,
    // ...outros props...
}) => {
    const { clients, loading, error, setError } = useClients();
    const now = useNowTick(30_000);
    const ongoingSweepMap = useOngoingSweep(now, 2 * 60 * 60 * 1000);
    const [filter, setFilter] = useState<string>(() => {
        try { return sessionStorage.getItem(FILTER_SESSION_KEY) ?? ''; } catch { return ''; }
    });
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    // Agrupado em único objeto para que a atualização destes 3 valores seja 1 render,
    // não 3 renders separados (React 18 faz batch dentro do mesmo event loop, mas
    // setState assíncrono ainda gera flushes independentes quando vêm de Promises).
    const [apptSets, setApptSets] = useState<{
        pendingIds: Set<number>;
        tomorrowIds: Set<number>;
        tomorrowAppts: Map<number, PendingAppointmentLike>;
    }>(() => ({
        pendingIds: new Set(),
        tomorrowIds: new Set(),
        tomorrowAppts: new Map(),
    }));
    const pendingClientIds  = apptSets.pendingIds;
    const tomorrowClientIds = apptSets.tomorrowIds;
    const tomorrowClientAppts = apptSets.tomorrowAppts;
    const [clientsPerPage, setClientsPerPage] = useState<ClientsPerPageOption>(readStoredClientsPerPage);
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

    // Pós-exclusão: limpa o filtro e foca o input.
    React.useEffect(() => {
        try {
            const action = localStorage.getItem('postDeleteAction');
            if (action === 'clearFilter') {
                localStorage.removeItem('postDeleteAction');
                setFilter('');
                setSelectedClientId(null);
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
    const hasRestoredScrollRef = React.useRef(false);

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

    // Persiste texto do filtro para sobreviver à navegação (editar e voltar).
    React.useEffect(() => {
        try { sessionStorage.setItem(FILTER_SESSION_KEY, filter); } catch { /* noop */ }
    }, [filter]);

    // Salva posição de scroll continuamente (debounce 200ms) e imediatamente ao sair da página.
    // Permite restaurar exatamente onde o usuário estava ao voltar da edição/criação de clientes.
    React.useEffect(() => {
        let saveTimer: number | null = null;
        const save = () => {
            try {
                sessionStorage.setItem(SCROLL_SESSION_KEY, String(Math.round(window.scrollY)));
            } catch { /* noop */ }
        };
        const onScroll = () => {
            if (saveTimer) window.clearTimeout(saveTimer);
            saveTimer = window.setTimeout(save, 200);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('pagehide', save);
        return () => {
            if (saveTimer) window.clearTimeout(saveTimer);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('pagehide', save);
        };
    }, []);

    // Restaura posição de scroll após o carregamento inicial dos clientes.
    // Só executa uma vez por montagem; ignora atualizações subsequentes.
    React.useEffect(() => {
        if (loading || clients.length === 0) return;
        if (hasRestoredScrollRef.current) return;
        hasRestoredScrollRef.current = true;
        try {
            const saved = sessionStorage.getItem(SCROLL_SESSION_KEY);
            if (saved) {
                const y = Number(saved);
                if (Number.isFinite(y) && y > 0) {
                    requestAnimationFrame(() => {
                        window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
                    });
                }
            }
        } catch { /* noop */ }
    }, [loading, clients.length]);

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

    // Filtra clientes por nome (acentos/maiúsculas ignorados) e ordena com colisão pt-BR.
    // Memoizado: só recalcula quando `clients` ou `filter` mudam — evita .sort() de 1235 itens a cada render.
    const filteredClients = React.useMemo(() => {
        const norm = normalizeText(filter);
        return clients
            .filter(client =>
                normalizeText(`${client.first_name} ${client.last_name}`).includes(norm),
            )
            .sort((a, b) =>
                `${a.first_name} ${a.last_name}`.localeCompare(
                    `${b.first_name} ${b.last_name}`,
                    'pt-BR',
                    { sensitivity: 'base' },
                ),
            );
    }, [clients, filter]);

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
            const token = getAccessToken();
            if (!token || clients.length === 0) {
                if (!cancelled) {
                    setApptSets({ pendingIds: new Set(), tomorrowIds: new Set(), tomorrowAppts: new Map() });
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

                // Fonte de verdade: apenas o retorno do endpoint /pending.
                // NÃO suplementamos com campos do objeto client (next_appointment_status /
                // last_appointment_status) porque esses campos são cache estático que só
                // atualiza quando useClients refaz o fetch completo — causaria contador stale.
                pendingData.forEach(appt => {
                    const clientId = resolveAppointmentClientId(appt);
                    if (clientId != null) ids.add(clientId);
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
                    setApptSets({ pendingIds: ids, tomorrowIds, tomorrowAppts });
                }
            } catch {
                if (!cancelled) {
                    setApptSets({ pendingIds: new Set(), tomorrowIds: new Set(), tomorrowAppts: new Map() });
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

    // Clientes em atendimento agora: usa o sweep (mesma fonte que ClientCard) como sinal
    // primário; complementa com a janela de tempo + 90s de grace (espelha a latch do ClientCard).
    const ongoingClients = React.useMemo(() => {
        const t = now.getTime();
        const GRACE_MS = 90_000;
        return clients.filter(c => {
            if (ongoingSweepMap.has(c.id)) return true;
            if (c.next_appointment_status !== 'scheduled') return false;
            const s = c.next_appointment_start_at ? new Date(c.next_appointment_start_at).getTime() : NaN;
            const e = c.next_appointment_end_at   ? new Date(c.next_appointment_end_at).getTime()   : NaN;
            return Number.isFinite(s) && Number.isFinite(e) && s <= t && t < e + GRACE_MS;
        });
    }, [clients, ongoingSweepMap, now]);
    const ongoingCount = ongoingClients.length;

    // Se o filtro de pendentes estiver ativo mas não houver mais pendentes, desativa
    React.useEffect(() => {
        if (filterMode === 'pending' && pendingCount === 0) {
            setFilterMode('all');
        }
    }, [filterMode, pendingCount]);

    // Se o filtro de em atendimento estiver ativo mas não houver mais, desativa
    React.useEffect(() => {
        if (filterMode === 'ongoing' && ongoingCount === 0) {
            setFilterMode('all');
        }
    }, [filterMode, ongoingCount]);

    const displayedClients = React.useMemo(() => {
        if (filterMode === 'pending') return pendingClients;
        if (filterMode === 'today') return todayClients;
        if (filterMode === 'tomorrow') return tomorrowClients;
        if (filterMode === 'ongoing') return ongoingClients;
        return filteredClients;
    }, [
        filterMode,
        pendingClients,
        todayClients,
        tomorrowClients,
        ongoingClients,
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

    // Reseta referência de notificação quando o filtro muda (não exibe modal — apenas tracking interno).
    React.useEffect(() => {
        if (!filter) lastNotifiedFilterRef.current = '';
    }, [filter]);

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
                // Se o input de filtro ainda estiver focado (usuário digitando), não rola a página
                // para evitar que o iOS dispense o teclado virtual ao detectar scroll programático.
                if (document.activeElement === inputEl) return;
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
            });
        }, 140);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
        };
    }, [filter, filteredClients, selectedClientId, setSelectedClientId]);

// ─── FilterBar ────────────────────────────────────────────────────────────────
// Memoizado: re-renderiza apenas quando filter/filterMode/counts ou callbacks mudam,
// nunca quando visibleClients ou paginação mudam.

interface FilterBarProps {
    filter: string;
    filterMode: FilterMode;
    pendingCount: number;
    todayCount: number;
    tomorrowCount: number;
    ongoingCount: number;
    mobileFiltersOpen: boolean;
    mobileFiltersMenuStyle: React.CSSProperties;
    mobileFiltersButtonRef: React.RefObject<HTMLButtonElement | null>;
    onFilterChange: (value: string) => void;
    onFilterClear: () => void;
    onApplyFilterMode: (mode: FilterMode) => void;
    onOpenMobileFilters: (e: React.MouseEvent) => void;
    onCloseMobileFilters: () => void;
    onCloseMobileFiltersFromBackdrop: () => void;
}

const FilterBar = React.memo(function FilterBar({
    filter,
    filterMode,
    pendingCount,
    todayCount,
    tomorrowCount,
    ongoingCount,
    mobileFiltersOpen,
    mobileFiltersMenuStyle,
    mobileFiltersButtonRef,
    onFilterChange,
    onFilterClear,
    onApplyFilterMode,
    onOpenMobileFilters,
    onCloseMobileFilters,
    onCloseMobileFiltersFromBackdrop,
}: FilterBarProps) {
    return (
        <div
            className={`${styles.filterContainer}${mobileFiltersOpen ? ` ${styles.filterContainerMenuOpen}` : ''}`}
        >
            <div className={styles.filterRow}>
                <div className={styles.filterInputWrapper}>
                    <input
                        id='client-filter'
                        type='text'
                        className={styles.filterInput}
                        placeholder='Digite o nome do cliente...'
                        value={filter}
                        onChange={e => onFilterChange(e.target.value)}
                    />
                    {filter && (
                        <button
                            type='button'
                            className={styles.filterClearBtn}
                            onClick={onFilterClear}
                            aria-label='Limpar filtro'
                            tabIndex={-1}
                        >
                            ×
                        </button>
                    )}
                </div>
                <div className={styles.filterActionsDesktop}>
                    <button
                        className={`${styles.filterToggleBtn}${filterMode === 'ongoing' ? ' ' + styles.filterToggleBtnActive : ''}`}
                        onClick={() => onApplyFilterMode('ongoing')}
                        title='Filtrar clientes em atendimento agora'
                        style={ongoingCount === 0 ? { opacity: 0.5 } : undefined}
                    >
                        Em atendimento {ongoingCount > 0 ? `(${ongoingCount})` : ''}
                    </button>
                    <button
                        className={`${styles.filterToggleBtn}${filterMode === 'pending' ? ' ' + styles.filterToggleBtnActive : ''}`}
                        onClick={() => onApplyFilterMode('pending')}
                        title='Filtrar por compromissos pendentes'
                    >
                        {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                    </button>
                    <button
                        className={`${styles.filterToggleBtn}${filterMode === 'today' ? ' ' + styles.filterToggleBtnActive : ''}`}
                        onClick={() => onApplyFilterMode('today')}
                        title='Filtrar compromissos de hoje'
                    >
                        Hoje {todayCount > 0 ? `(${todayCount})` : ''}
                    </button>
                    <button
                        className={`${styles.filterToggleBtn}${filterMode === 'tomorrow' ? ' ' + styles.filterToggleBtnActive : ''}`}
                        onClick={() => onApplyFilterMode('tomorrow')}
                        title='Filtrar compromissos de amanhã'
                    >
                        Amanhã {tomorrowCount > 0 ? `(${tomorrowCount})` : ''}
                    </button>
                </div>

                <div className={styles.filterActionsMobile}>
                    <button
                        ref={mobileFiltersButtonRef}
                        className={`${styles.filtersMenuButton}${filterMode !== 'all' ? ' ' + styles.filtersMenuButtonActive : pendingCount > 0 ? ' ' + styles.filtersMenuButtonPending : ''}`}
                        onClick={e => {
                            e.stopPropagation();
                            if (mobileFiltersOpen) {
                                onCloseMobileFilters();
                            } else {
                                onOpenMobileFilters(e);
                            }
                        }}
                        aria-expanded={mobileFiltersOpen}
                        aria-haspopup='menu'
                        title='Abrir filtros'
                    >
                        Filtros{pendingCount > 0 && filterMode !== 'pending' ? ` (${pendingCount})` : ''}
                    </button>

                    {mobileFiltersOpen && (
                        <button
                            type='button'
                            className={styles.filtersMenuBackdrop}
                            onClick={onCloseMobileFiltersFromBackdrop}
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
                                    onApplyFilterMode('all');
                                }}
                                role='menuitem'
                            >
                                Sem filtro
                            </button>
                            <button
                                className={`${styles.filtersMenuItem}${filterMode === 'ongoing' ? ' ' + styles.filtersMenuItemActive : ''}`}
                                onClick={() => onApplyFilterMode('ongoing')}
                                role='menuitem'
                            >
                                Em atendimento ({ongoingCount})
                            </button>
                            <button
                                className={`${styles.filtersMenuItem}${filterMode === 'pending' ? ' ' + styles.filtersMenuItemActive : ''}`}
                                onClick={() => onApplyFilterMode('pending')}
                                role='menuitem'
                            >
                                Pendentes ({pendingCount})
                            </button>
                            <button
                                className={`${styles.filtersMenuItem}${filterMode === 'today' ? ' ' + styles.filtersMenuItemActive : ''}`}
                                onClick={() => onApplyFilterMode('today')}
                                role='menuitem'
                            >
                                Hoje ({todayCount})
                            </button>
                            <button
                                className={`${styles.filtersMenuItem}${filterMode === 'tomorrow' ? ' ' + styles.filtersMenuItemActive : ''}`}
                                onClick={() => onApplyFilterMode('tomorrow')}
                                role='menuitem'
                            >
                                Amanhã ({tomorrowCount})
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

// ─── PaginationBar ─────────────────────────────────────────────────────────────
// Memoizado: re-renderiza apenas quando page/total/counts mudam,
// nunca quando os cards (visibleClients) mudam.

type ClientsPerPageOptionPag = 50 | 200 | 'all';
const CLIENTS_PER_PAGE_OPTIONS_PAG = [50, 200, 'all'] as const;

interface PaginationBarProps {
    loading: boolean;
    clientsLength: number;
    displayedCount: number;
    pageStartIndex: number;
    pageEndIndex: number;
    safeCurrentPage: number;
    totalPages: number;
    clientsPerPage: ClientsPerPageOptionPag;
    onPageSizeChange: (next: ClientsPerPageOptionPag) => void;
    onPrev: () => void;
    onNext: () => void;
}

const PaginationBar = React.memo(function PaginationBar({
    loading,
    clientsLength,
    displayedCount,
    pageStartIndex,
    pageEndIndex,
    safeCurrentPage,
    totalPages,
    clientsPerPage,
    onPageSizeChange,
    onPrev,
    onNext,
}: PaginationBarProps) {
    return (
        <div
            className={styles.paginationBar}
            style={loading || clientsLength === 0 ? { visibility: 'hidden' } : undefined}
        >
            <div className={styles.paginationSummary}>
                {displayedCount > 0
                    ? `Exibindo ${pageStartIndex + 1} a ${pageEndIndex} de ${displayedCount} clientes.`
                    : 'Nenhum cliente para exibir.'}
            </div>
            <div className={styles.paginationRow2}>
                <label className={styles.paginationPageSizeLabel}>
                    <span>Por página</span>
                    <select
                        className={styles.paginationPageSizeSelect}
                        value={clientsPerPage}
                        onChange={event => {
                            const rawValue = event.target.value;
                            const next: ClientsPerPageOptionPag =
                                rawValue === 'all' ? 'all' : (Number(rawValue) as ClientsPerPageOptionPag);
                            if (rawValue !== 'all' && !Number.isFinite(Number(rawValue))) return;
                            onPageSizeChange(next);
                        }}
                    >
                        {CLIENTS_PER_PAGE_OPTIONS_PAG.map(option => (
                            <option key={option} value={option}>
                                {option === 'all' ? 'Todos' : option}
                            </option>
                        ))}
                    </select>
                </label>
                <span className={styles.paginationPageIndicator}>
                    Página {safeCurrentPage} de {totalPages}
                </span>
            </div>
            <div className={styles.paginationButtons}>
                <button
                    type='button'
                    className={styles.paginationButton}
                    onClick={onPrev}
                    disabled={safeCurrentPage <= 1}
                >
                    Anterior
                </button>
                <button
                    type='button'
                    className={styles.paginationButton}
                    onClick={onNext}
                    disabled={safeCurrentPage >= totalPages}
                >
                    Próxima
                </button>
            </div>
        </div>
    );
});

    const handleFilterChange = React.useCallback((value: string) => {
        setFilter(value);
        if (filterMode !== 'all') setFilterMode('all');
    }, [filterMode]);

    const handleFilterClear = React.useCallback(() => {
        setFilter('');
        document.getElementById('client-filter')?.focus();
    }, []);

    const handleOpenMobileFilters = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        updateMobileFiltersMenuPosition();
        mobileFiltersOpenedAtRef.current = Date.now();
        setMobileFiltersOpen(true);
    }, [updateMobileFiltersMenuPosition]);

    const handlePageSizeChange = React.useCallback((next: ClientsPerPageOption) => {
        if (next !== 'all') {
            try { localStorage.setItem(PAGINATION_STORAGE_KEY, String(next)); } catch { /* noop */ }
        }
        setClientsPerPage(next);
    }, []);

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
            .then((data) => {
                const clientData = data as unknown as ClientData;
                detailCacheRef.current.set(cliente.id, clientData);
                onClientViewData?.(clientData);
            })
            .catch(() => {
                alert('Erro ao buscar dados completos do cliente');
            });
    }

    return (
        <main className={styles.main}>
            <FilterBar
                filter={filter}
                filterMode={filterMode}
                pendingCount={pendingCount}
                todayCount={todayCount}
                tomorrowCount={tomorrowCount}
                ongoingCount={ongoingCount}
                mobileFiltersOpen={mobileFiltersOpen}
                mobileFiltersMenuStyle={mobileFiltersMenuStyle}
                mobileFiltersButtonRef={mobileFiltersButtonRef}
                onFilterChange={handleFilterChange}
                onFilterClear={handleFilterClear}
                onApplyFilterMode={applyFilterMode}
                onOpenMobileFilters={handleOpenMobileFilters}
                onCloseMobileFilters={closeMobileFilters}
                onCloseMobileFiltersFromBackdrop={closeMobileFiltersFromBackdrop}
            />
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
                {!loading && filter && visibleClients.length === 0 && (
                    <p className={styles.noResultsMessage}>
                        Nenhum cliente encontrado para &ldquo;{filter}&rdquo;.
                    </p>
                )}
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
                            filterMode={filterMode === 'ongoing' ? undefined : filterMode}
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
            <PaginationBar
                loading={loading}
                clientsLength={clients.length}
                displayedCount={deferredDisplayedClients.length}
                pageStartIndex={pageStartIndex}
                pageEndIndex={pageEndIndex}
                safeCurrentPage={safeCurrentPage}
                totalPages={totalPages}
                clientsPerPage={clientsPerPage as ClientsPerPageOptionPag}
                onPageSizeChange={handlePageSizeChange as (next: ClientsPerPageOptionPag) => void}
                onPrev={() => goToPage(safeCurrentPage - 1)}
                onNext={() => goToPage(safeCurrentPage + 1)}
            />

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

            {/* modal removido — nenhum resultado é exibido inline no cardsGrid */}
        </main>
    );
};

export default MainContent;
