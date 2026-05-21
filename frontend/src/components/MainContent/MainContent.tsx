// frontend\src\components\MainContent.tsx
import React, { useState } from 'react';
import styles from '../../styles/components/Main.module.css';
import { useClients } from '../../hooks/useClients';
import { ClientCard } from '../clientCard/ClientCard';
import type { ClientBasic } from '../../types/ClientBasic';
import { AppModal } from '../Modal/Modal';
import type { ClientData } from '../../types/ClientData';
import { SessionExpiredModal } from '../SessionExpiredModal/SessionExpiredModal';
import { dispatchLogout, hasActiveSession } from '../../utils/auth/session';
import { apiFetch } from '../../utils/apiFetch';
import { useAppointmentSets } from '../../hooks/useAppointmentSets';

import { useScrollPersistence } from '../../hooks/useScrollPersistence';
import { useIosKeyboard } from '../../hooks/useIosKeyboard';
import { FilterBar } from '../FilterBar/FilterBar';
import type { FilterMode } from '../FilterBar/FilterBar';

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

const FILTER_SESSION_KEY = 'home.filter';
const LOAD_BATCH = 50;

// ─────────────────────────────────────────────────────────────────────────────

export const MainContent: React.FC<MainContentProps> = ({
    selectedClientId,
    setSelectedClientId,
    onClientViewData,
    // ...outros props...
}) => {
    const { clients, loading, error, setError } = useClients();
    const [filter, setFilter] = useState<string>(() => {
        try { return sessionStorage.getItem(FILTER_SESSION_KEY) ?? ''; } catch { return ''; }
    });
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const { pendingIds: pendingClientIds, pendingAppts: pendingClientAppts, tomorrowIds: tomorrowClientIds, tomorrowAppts: tomorrowClientAppts } =
        useAppointmentSets(clients.length);
    const [visibleCount, setVisibleCount] = useState(LOAD_BATCH);
    const sentinelRef = React.useRef<HTMLDivElement | null>(null);
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
            React.startTransition(() => {
                setFilterMode(prev => (prev === mode ? 'all' : mode));
                setVisibleCount(LOAD_BATCH);
            });
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

    useIosKeyboard(styles.filterContainer);

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

    // Persiste texto do filtro para sobreviver à navegação (editar e voltar).
    React.useEffect(() => {
        try { sessionStorage.setItem(FILTER_SESSION_KEY, filter); } catch { /* noop */ }
    }, [filter]);

    // Salva posição de scroll e restaura após carregamento inicial.
    useScrollPersistence(loading, clients.length);

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

    // Clientes em atendimento agora: status 'ongoing' vem do servidor.
    const ongoingClients = React.useMemo(() => {
        return clients.filter(c => c.next_appointment_status === 'ongoing');
    }, [clients]);
    const ongoingCount = ongoingClients.length;

    // Fase 2: estado de fade suave para reset do filtro ongoing
    const [isResettingFilter, setIsResettingFilter] = React.useState(false);

    // Se o filtro de pendentes estiver ativo mas não houver mais pendentes, desativa
    React.useEffect(() => {
        if (filterMode === 'pending' && pendingCount === 0) {
            React.startTransition(() => setFilterMode('all'));
        }
    }, [filterMode, pendingCount]);

    // Se o filtro de em atendimento estiver ativo mas não houver mais, desativa com fade
    React.useEffect(() => {
        if (filterMode === 'ongoing' && ongoingCount === 0) {
            setIsResettingFilter(true);
            const timer = setTimeout(() => {
                setFilterMode('all');
                setVisibleCount(LOAD_BATCH);
                setIsResettingFilter(false);
            }, 280);
            return () => clearTimeout(timer);
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
    const totalDisplayed = deferredDisplayedClients.length;
    const hasMore = visibleCount < totalDisplayed;
    const visibleClients = React.useMemo(
        () => deferredDisplayedClients.slice(0, visibleCount),
        [deferredDisplayedClients, visibleCount],
    );

    // Ao mudar filterMode: reseta contagem e volta ao topo
    React.useEffect(() => {
        React.startTransition(() => setVisibleCount(LOAD_BATCH));
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }, [filterMode]);

    // IntersectionObserver: carrega mais ao rolar até o sentinela
    React.useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore) {
                    React.startTransition(() => {
                        setVisibleCount(n => Math.min(n + LOAD_BATCH, totalDisplayed));
                    });
                }
            },
            { rootMargin: '200px' },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, totalDisplayed]);

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

    const handleFilterChange = React.useCallback((value: string) => {
        setFilter(value);
        if (filterMode !== 'all') React.startTransition(() => setFilterMode('all'));
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
            <div
                ref={cardsGridRef}
                className={styles.cardsGrid}
                style={{
                    opacity: isResettingFilter ? 0 : 1,
                    transition: 'opacity 280ms ease',
                }}
            >
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
                            pendingAppt={pendingClientIds.has(client.id) ? pendingClientAppts.get(client.id) : undefined}
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
            {/* sentinela: IntersectionObserver dispara quando chega ao fim da lista */}
            <div ref={sentinelRef} aria-hidden='true' style={{ height: 1 }} />

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

