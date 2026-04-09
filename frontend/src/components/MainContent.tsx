// frontend\src\components\MainContent.tsx
import { API_BASE } from '../config/api';
import React, { useState } from 'react';
import styles from '../styles/components/Main.module.css';
import { useClients } from '../hooks/useClients';
import ClientCard from './ClientCard';
import type { ClientBasic } from '../types/ClientBasic';
import AppModal from './Modal';
import ClientView from './ClientView';
import type { ClientData } from '../types/ClientData';
import SessionExpiredModal from './SessionExpiredModal';

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
    // ...outros props se necessário...
}

const MainContent: React.FC<MainContentProps> = ({
    selectedClientId,
    setSelectedClientId,
    // ...outros props...
}) => {
    const { clients, loading, error, setError } = useClients();
    const [filter, setFilter] = useState('');
    const [showPending, setShowPending] = useState(false);
    const [selectedClient, setSelectedClient] = useState<ClientData | null>(
        null,
    );
    const [modalOpen, setModalOpen] = useState(false);
    const [noResultsOpen, setNoResultsOpen] = useState(false);
    // Agenda selection mode state
    const [selectMode, setSelectMode] = useState(false);
    const [returnUrl, setReturnUrl] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmClient, setConfirmClient] = useState<ClientBasic | null>(
        null,
    );
    const lastNotifiedFilterRef = React.useRef<string>('');
    // Limpa UI imediatamente ao receber evento de logout/clearClients
    React.useEffect(() => {
        const handleClear = () => {
            setFilter('');
            setSelectedClient(null);
            setModalOpen(false);
            setNoResultsOpen(false);
        };
        window.addEventListener('clearClients', handleClear);
        return () => window.removeEventListener('clearClients', handleClear);
    }, []);

    // Pós-exclusão: se viermos da tela de edição após deletar, limpamos o filtro
    // e evitamos mostrar o modal de "nenhum resultado" para o termo anterior.
    React.useEffect(() => {
        try {
            const action = localStorage.getItem('postDeleteAction');
            if (action === 'clearFilter') {
                localStorage.removeItem('postDeleteAction');
                setFilter('');
                setSelectedClient(null);
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

    // Clientes com compromisso pendente.
    // O backend popula next_appointment_* apenas com start_at >= now (futuro),
    // portanto um compromisso passado não finalizado aparece em last_appointment_status='scheduled'.
    // Excluímos appointments que ainda estão em andamento (start_at < now < end_at) — esses
    // são "ongoing" pelo horário e não devem aparecer como pendentes.
    const pendingClients = React.useMemo(() => {
        const nowMs = Date.now();
        return clients
            .filter(c => {
                if (c.last_appointment_status !== 'scheduled') return false;
                // Se temos end_at e ele ainda não passou, o atendimento está em andamento
                if (c.last_appointment_end_at) {
                    const endMs = new Date(c.last_appointment_end_at).getTime();
                    if (!isNaN(endMs) && endMs > nowMs) return false;
                }
                return true;
            })
            .sort((a, b) => {
                const ta = a.last_appointment_start_at
                    ? new Date(a.last_appointment_start_at).getTime()
                    : 0;
                const tb = b.last_appointment_start_at
                    ? new Date(b.last_appointment_start_at).getTime()
                    : 0;
                return ta - tb;
            });
    }, [clients]);

    const pendingCount = pendingClients.length;

    // Se o filtro de pendentes estiver ativo mas não houver mais pendentes, desativa
    React.useEffect(() => {
        if (showPending && pendingCount === 0) setShowPending(false);
    }, [showPending, pendingCount]);

    const displayedClients = showPending ? pendingClients : filteredClients;

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
        // Solta qualquer foco ativo antes de abrir a visualização, evitando foco "grudado" caso o item seja removido depois
        try {
            (document.activeElement as HTMLElement | null)?.blur?.();
        } catch {
            /* noop */
        }
        fetch(`${API_BASE}/register/clients/${cliente.id}/`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
        })
            .then(res => res.json())
            .then((data: ClientData) => {
                setSelectedClient(data);
                setModalOpen(true);
                // Integração com botão voltar do navegador (especialmente no mobile)
                // Empurra um novo estado; ao voltar (popstate) fechamos o modal.
                try {
                    window.history.pushState({ modal: 'clientView' }, '');
                } catch (err) {
                    // ignora navegadores antigos sem history API
                    void err;
                }
            })
            .catch(() => {
                alert('Erro ao buscar dados completos do cliente');
            });
    }

    function handleCloseModal() {
        setModalOpen(false);
        setSelectedClient(null);
        // Se o histórico tiver um estado de modal, volta um passo para restaurar URL anterior
        try {
            if (
                window.history.state &&
                window.history.state.modal === 'clientView'
            ) {
                window.history.back();
            }
        } catch (err) {
            void err;
        }
        // Após fechar o modal, garante refresh e desbloqueio
        refreshAndUnlock();
    }

    // Fecha modal quando usuário pressiona o botão voltar (popstate) se o modal estiver aberto
    React.useEffect(() => {
        function onPopState() {
            if (modalOpen) {
                setModalOpen(false);
                setSelectedClient(null);
            }
        }
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [modalOpen]);

    return (
        <main className={styles.main}>
            <div className={styles.filterContainer}>
                <div className={styles.filterRow}>
                    {pendingCount === 0 && (
                        <label
                            htmlFor='client-filter'
                            className={styles.filterLabel}
                        >
                            Filtrar Cliente:
                        </label>
                    )}
                    <input
                        id='client-filter'
                        type='text'
                        className={styles.filterInput}
                        placeholder='Digite o nome do cliente...'
                        value={filter}
                        onChange={e => {
                            setFilter(e.target.value);
                            if (showPending) setShowPending(false);
                        }}
                    />
                    {pendingCount > 0 && (
                        <button
                            className={`${styles.pendingFilterBtn}${showPending ? ' ' + styles.pendingFilterBtnActive : ''}`}
                            onClick={() => {
                                setShowPending(p => !p);
                                setFilter('');
                            }}
                            title={
                                showPending
                                    ? 'Mostrar todos os clientes'
                                    : `${pendingCount} compromisso${pendingCount > 1 ? 's' : ''} n\u00e3o finalizado${pendingCount > 1 ? 's' : ''}`
                            }
                        >
                            {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                        </button>
                    )}
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
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('loggedProfessional');
                        window.dispatchEvent(new Event('clearClients'));
                        window.location.reload();
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
            <div className={styles.cardsGrid}>
                {displayedClients.map(client => (
                    <div
                        key={client.id}
                        ref={el => {
                            cardRefs.current[client.id] = el;
                        }}
                    >
                        <ClientCard
                            client={client}
                            selected={selectedClientId === client.id}
                            onSelect={() => {
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
            <AppModal
                open={modalOpen}
                onClose={handleCloseModal}
                showCloseButton
                fullScreen
            >
                {selectedClient && <ClientView client={selectedClient} />}
            </AppModal>

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
