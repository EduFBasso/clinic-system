// frontend\src\components\Modal.tsx
import React from 'react';
import { emitModalViewportMetric } from '../utils/telemetry/modalViewport';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import ModalActionsBar from './ModalActionsBar';
import { useModalCloseHotkeys } from '../hooks/useModalCloseHotkeys';

interface AppModalProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    closeOnEnter?: boolean; // padrão: true – fecha ao pressionar Enter
    closeOnEscape?: boolean; // padrão: true – fecha ao pressionar Escape
    showCloseButton?: boolean; // padrão: true – mostra botão X
    // Permite customizar estilo da barra de ações (X) por modal
    actionsBarStyle?: React.CSSProperties;
    disableBackdropClose?: boolean; // se true, clicar fora não fecha
    disableEscapeKeyDown?: boolean; // se true, ESC do MUI não fecha
    fullScreen?: boolean; // se true, ocupa a tela inteira
    // Controla a altura máxima em modo não-fullscreen (em unidades de vh dinâmico). Padrão: 90.
    maxHeightVh?: number;
    // Se true, não aplica o padding-top de safe-area no container fullScreen (útil quando o conteúdo já possui header com safe-area)
    disableTopSafePadding?: boolean;
    // Quando true, desmonta completamente o conteúdo ao fechar (evita manter root oculto no DOM; útil para modais flash como mensagens).
    unmountOnClose?: boolean;
    // Quando true em fullScreen, o container principal não terá overflowY:auto;
    // cabe ao conteúdo interno definir uma região rolável. Útil para cenários onde queremos
    // que um inner wrapper (que inclui o header sticky) seja o único scroll ancestor.
    disableOuterScroll?: boolean;
}

const style = {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    bgcolor: 'var(--color-bg)',
    borderRadius: 2,
    boxShadow: 24,
    // Padding menor em telas pequenas para maximizar área útil (iPhone)
    p: { xs: 2, sm: 4 },
    // padding-bottom considera a safe-area inferior para evitar choque com a barra do Safari
    pb: {
        xs: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        sm: 6,
    },
    minWidth: 340,
    width: '100%',
    maxWidth: { xs: '98vw', sm: '700px', md: '900px', lg: '1100px' },
    // Evitar 90vh devido à toolbar dinâmica do Safari; usar unidade dinâmica baseada em JS
    maxHeight: 'calc(var(--appmodal-vh, 1vh) * 90)',
    overflowY: 'auto',
};

export default function AppModal(props: AppModalProps) {
    const {
        open,
        onClose,
        children,
        closeOnEnter = true,
        closeOnEscape = true,
        showCloseButton = true,
        actionsBarStyle,
        disableBackdropClose = false,
        disableEscapeKeyDown = false,
        fullScreen = false,
        maxHeightVh = 90,
        disableTopSafePadding = false,
        unmountOnClose = false,
        disableOuterScroll = false,
    } = props;

    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const prevScrollRef = React.useRef<number>(0);
    const prevWindowScrollRef = React.useRef<number>(0);
    const prevScrollElRef = React.useRef<HTMLElement | null>(null);
    const prevActiveElRef = React.useRef<HTMLElement | null>(null);
    // Track last touch Y to detect overscroll direction (iOS rubber-band guard)
    const lastTouchYRef = React.useRef<number | null>(null);
    // Delta adicional para cobrir barra inferior translucida (iOS / PWA) quando 100dvh não pinta totalmente.
    const [bottomComp, setBottomComp] = React.useState(0);
    // Identificador estável por instância para correlação de métricas
    const modalIdRef = React.useRef<string>('');
    if (!modalIdRef.current) {
        modalIdRef.current = `m-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;
    }

    // Função extraída para (re)calcular compensação inferior e emitir métrica.
    const recomputeBottomCompRef = React.useRef<() => void>(() => {});
    const computeBottomComp = React.useCallback(() => {
        try {
            const vv = window.visualViewport;
            if (!vv) {
                setBottomComp(0);
                emitModalViewportMetric({
                    modalId: modalIdRef.current,
                    bottomComp: 0,
                    vhUnit:
                        (window.visualViewport?.height || window.innerHeight) /
                            100 || 0,
                    innerHeight: window.innerHeight,
                    visualViewportHeight: window.visualViewport?.height,
                    timestamp: Date.now(),
                    phase: 'update',
                    userAgent:
                        typeof navigator !== 'undefined'
                            ? navigator.userAgent
                            : undefined,
                });
                return;
            }
            const delta = window.innerHeight - vv.height;
            const safe = Number(
                getComputedStyle(document.documentElement)
                    .getPropertyValue('--_fake_safe_area_bottom')
                    .replace(/px/, '') || 0,
            );
            const adj = delta > 8 ? Math.max(0, delta - safe) : 0;
            setBottomComp(prev => (prev !== adj ? adj : prev));
            emitModalViewportMetric({
                modalId: modalIdRef.current,
                bottomComp: adj,
                vhUnit:
                    (window.visualViewport?.height || window.innerHeight) /
                        100 || 0,
                innerHeight: window.innerHeight,
                visualViewportHeight: window.visualViewport?.height,
                timestamp: Date.now(),
                phase: 'update',
                userAgent:
                    typeof navigator !== 'undefined'
                        ? navigator.userAgent
                        : undefined,
            });
        } catch {
            setBottomComp(0);
            emitModalViewportMetric({
                modalId: modalIdRef.current,
                bottomComp: 0,
                vhUnit:
                    (window.visualViewport?.height || window.innerHeight) /
                        100 || 0,
                innerHeight: window.innerHeight,
                visualViewportHeight: window.visualViewport?.height,
                timestamp: Date.now(),
                phase: 'update',
                userAgent:
                    typeof navigator !== 'undefined'
                        ? navigator.userAgent
                        : undefined,
            });
        }
    }, []);
    recomputeBottomCompRef.current = computeBottomComp;

    // Observa mudanças de visualViewport e eventos customizados para recalcular compensação.
    React.useEffect(() => {
        if (!open || !props.fullScreen) return;
        computeBottomComp();
        const vv = window.visualViewport;
        const onVV = () => computeBottomComp();
        vv?.addEventListener('resize', onVV);
        vv?.addEventListener('scroll', onVV); // iOS toolbar show/hide
        window.addEventListener('orientationchange', onVV);
        // Eventos customizados disparados por outros componentes quando layout interno muda.
        const onRecompute = () => computeBottomComp();
        window.addEventListener('modal:recompute-bottom-comp', onRecompute);
        window.addEventListener('modal:layout-changed', onRecompute);
        // Recalcular sob primeiro scroll (throttled) para capturar possíveis diffs após imagens/fontes.
        let scheduled = false;
        const onScroll = () => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                computeBottomComp();
            });
        };
        const contentEl = contentRef.current;
        if (contentEl && props.fullScreen) {
            contentEl.addEventListener('scroll', onScroll, { passive: true });
        }
        return () => {
            vv?.removeEventListener('resize', onVV);
            vv?.removeEventListener('scroll', onVV);
            window.removeEventListener('orientationchange', onVV);
            window.removeEventListener(
                'modal:recompute-bottom-comp',
                onRecompute,
            );
            window.removeEventListener('modal:layout-changed', onRecompute);
            if (contentEl && props.fullScreen) {
                contentEl.removeEventListener('scroll', onScroll);
            }
        };
    }, [open, props.fullScreen, computeBottomComp]);

    const isIOS = React.useMemo(() => {
        if (typeof navigator === 'undefined') return false;
        const ua = navigator.userAgent || '';
        const platform = navigator.platform || '';
        return (
            /iP(ad|hone|od)/.test(ua) ||
            (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        );
    }, []);

    const isCoarsePointerDevice = React.useMemo(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }
        return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    }, []);

    const updateVhVar = React.useCallback(() => {
        try {
            const vhPx =
                (window.visualViewport?.height ?? window.innerHeight) * 0.01;
            document.documentElement.style.setProperty(
                '--appmodal-vh',
                `${vhPx}px`,
            );
        } catch {
            /* noop */
        }
    }, []);
    React.useEffect(() => {
        if (!open) return;
        try {
            // Memoriza elemento ativo para restaurar foco sem deslocar a página
            prevActiveElRef.current =
                (document.activeElement as HTMLElement | null) || null;
            // Detecta posição atual de scroll da janela
            const winY = (() => {
                try {
                    return (
                        window.scrollY ||
                        window.pageYOffset ||
                        document.documentElement.scrollTop ||
                        document.body.scrollTop ||
                        0
                    );
                } catch {
                    return 0;
                }
            })();
            prevWindowScrollRef.current = winY;

            // Detecta container principal de scroll (ex.: <main> / custom)
            let scrollEl: HTMLElement | null = null;
            try {
                const isScrollable = (el: HTMLElement | null) => {
                    if (!el) return false;
                    const cs = getComputedStyle(el);
                    const overflowY = cs.overflowY;
                    return (
                        overflowY === 'auto' ||
                        overflowY === 'scroll' ||
                        el.scrollHeight > el.clientHeight + 1
                    );
                };
                const candidates = Array.from(
                    document.querySelectorAll<HTMLElement>(
                        'main, [data-scroll-root], #content, .content, .page, [role="main"], .scroll, .scrollable',
                    ),
                );
                const se =
                    (document.scrollingElement as HTMLElement | null) || null;
                if (se && !candidates.includes(se)) candidates.push(se);
                const de = document.documentElement as HTMLElement;
                if (!candidates.includes(de)) candidates.push(de);

                // Escolhe o elemento com maior área rolável
                let best: HTMLElement | null = null;
                let bestDelta = -1;
                for (const el of candidates) {
                    if (!isScrollable(el)) continue;
                    const delta = el.scrollHeight - el.clientHeight;
                    if (delta > bestDelta) {
                        bestDelta = delta;
                        best = el;
                    }
                }
                scrollEl = best;
            } catch {
                /* noop */
            }
            if (!scrollEl) {
                scrollEl =
                    (document.scrollingElement as HTMLElement | null) ||
                    (document.documentElement as HTMLElement);
            }
            prevScrollElRef.current = scrollEl;
            const elY = scrollEl?.scrollTop ?? 0;
            // Use a maior entre janela e elemento — cobre ambos cenários
            prevScrollRef.current = Math.max(elY, winY);
        } catch {
            /* noop */
        }

        // Remover possíveis estados de teclado aberto que criam painel rolável alternativo
        try {
            document.body.classList.remove('keyboardOpen');
        } catch {
            /* noop */
        }
        // Define var de viewport dinâmica e listeners enquanto o modal está aberto
        updateVhVar();
        const onResize = () => updateVhVar();
        window.addEventListener('resize', onResize);
        (window.visualViewport || null)?.addEventListener?.(
            'resize',
            onResize as EventListener,
        );

        // Lock padrão: impedir rolagem do documento em todos os ambientes
        try {
            const body = document.body as HTMLBodyElement;
            const html = document.documentElement as HTMLElement;
            html.style.overflow = 'hidden';
            body.style.overflow = 'hidden';
            // Evita bloquear todos os gestos de toque globalmente; iOS pode ficar sem responder.
            // Em vez disso, usamos preventDefault em listeners fora do conteúdo do modal (ver abaixo)
            // html.style.touchAction = 'none';
            // body.style.touchAction = 'none';
            // Reduz efeitos de overscroll (Android/Chrome)
            html.style.setProperty('overscroll-behavior-y', 'contain');
        } catch {
            /* noop */
        }
        if (isIOS) {
            // Aplica lock manual para evitar "rubber band" mantendo o conteúdo congelado.
            const body = document.body as HTMLBodyElement;
            // Evita reaplicar se já travado manualmente.
            if (!body.dataset.appliedIosLock) {
                body.dataset.appliedIosLock = '1';
                body.style.position = 'fixed';
                // Para iOS, top deve ser baseado no scroll da janela
                body.style.top = `-${prevWindowScrollRef.current}px`;
                body.style.left = '0';
                body.style.right = '0';
                body.style.width = '100%';
                // overflow hidden ajuda, mas Safari às vezes ignora; mantemos mesmo assim.
                body.style.overflow = 'hidden';
            }
        }
        // Bloqueia gestos de rolagem fora do conteúdo do modal (Android/iOS)
        const preventOutsideScroll = (e: Event) => {
            const target = e.target as Node | null;
            const content = contentRef.current;
            if (!content) {
                // Sem referência confiável, evita scroll global
                e.preventDefault();
                return;
            }
            if (target && content.contains(target)) {
                // Dentro do conteúdo: permitir rolagem interna
                return;
            }
            e.preventDefault();
        };
        const passiveFalse: AddEventListenerOptions = { passive: false };
        const shouldBlockDocumentScroll = !fullScreen;
        if (shouldBlockDocumentScroll) {
            document.addEventListener(
                'touchmove',
                preventOutsideScroll,
                passiveFalse,
            );
            document.addEventListener(
                'wheel',
                preventOutsideScroll,
                passiveFalse,
            );
        }

        // Dar foco ao conteúdo do modal para capturar imediatamente a interação
        try {
            contentRef.current?.setAttribute('tabindex', '-1');
            contentRef.current?.focus();
            // Garante scroll interno no topo ao abrir
            if (contentRef.current) contentRef.current.scrollTop = 0;
        } catch {
            /* noop */
        }

        return () => {
            try {
                if (shouldBlockDocumentScroll) {
                    document.removeEventListener(
                        'touchmove',
                        preventOutsideScroll as EventListener,
                    );
                    document.removeEventListener(
                        'wheel',
                        preventOutsideScroll as EventListener,
                    );
                }
            } catch {
                /* noop */
            }
            try {
                window.removeEventListener('resize', onResize);
                (window.visualViewport || null)?.removeEventListener?.(
                    'resize',
                    onResize as EventListener,
                );
            } catch {
                /* noop */
            }
        };
    }, [open, isIOS, updateVhVar]);

    // Telemetria de fase 'open' (executa após montagem / abertura)
    React.useEffect(() => {
        if (!open) return;
        // rAF garante que efeitos de layout (vh var / compute inicial) já ocorreram
        const id = modalIdRef.current;
        const currentBottomComp = bottomComp; // captura valor estável
        const raf = requestAnimationFrame(() => {
            emitModalViewportMetric({
                modalId: id,
                bottomComp: currentBottomComp,
                vhUnit:
                    (window.visualViewport?.height || window.innerHeight) /
                        100 || 0,
                innerHeight: window.innerHeight,
                visualViewportHeight: window.visualViewport?.height,
                timestamp: Date.now(),
                phase: 'open',
                userAgent:
                    typeof navigator !== 'undefined'
                        ? navigator.userAgent
                        : undefined,
            });
        });
        return () => cancelAnimationFrame(raf);
    }, [open, bottomComp]);

    // Telemetria de fase 'close'
    React.useEffect(() => {
        if (open) return; // dispara somente na transição para fechado
        if (!modalIdRef.current) return;
        emitModalViewportMetric({
            modalId: modalIdRef.current,
            bottomComp,
            vhUnit:
                (window.visualViewport?.height || window.innerHeight) / 100 ||
                0,
            innerHeight: window.innerHeight,
            visualViewportHeight: window.visualViewport?.height,
            timestamp: Date.now(),
            phase: 'close',
            userAgent:
                typeof navigator !== 'undefined'
                    ? navigator.userAgent
                    : undefined,
        });
    }, [open, bottomComp]);
    // Hotkeys reutilizáveis para fechar modal
    useModalCloseHotkeys({
        open,
        onClose,
        closeOnEnter,
        closeOnEscape,
    });

    // Handler que respeita as flags de bloqueio do MUI (backdrop/escape)
    const handleMuiClose = (
        _event: unknown,
        reason: 'backdropClick' | 'escapeKeyDown',
    ) => {
        if (reason === 'backdropClick' && disableBackdropClose) return;
        if (
            reason === 'escapeKeyDown' &&
            (disableEscapeKeyDown || !closeOnEscape)
        )
            return;
        onClose();
    };

    // Task #35 + Task #52: Defensive restoration de scroll + instrumentação.
    // Observado: em alguns fluxos (cancelar edição via mini-card) a página fica "travada".
    // Hipótese: corrida onde MUI remove classes após nosso efeito checar, ou restore abortado
    // porque detectou (falsamente) outro modal. Adicionamos:
    // 1. restore() mais resiliente (não aborta se só sobrou body.class 'MuiModal-open').
    // 2. Fallback global (window.ensureScrollUnlocked) disparado em vários eventos.
    // 3. Export implícita via evento custom 'ensureScrollUnlocked'.
    React.useEffect(() => {
        if (open) return; // Só atua no fechamento

        // Função de restauração idempotente (múltiplas tentativas em timers diferentes)
        const restore = (source?: string) => {
            try {
                // Remover foco de dentro do conteúdo do modal imediatamente
                try {
                    contentRef.current?.blur?.();
                } catch {
                    /* noop */
                }
                const body = document.body as HTMLBodyElement;
                const html = document.documentElement as HTMLElement;
                
                // Verifica se ainda há outro modal aberto ANTES de decidir sobre keepScroll
                const activeModals = Array.from(
                    document.querySelectorAll(
                        '[role="presentation"][aria-hidden="false"]',
                    ),
                ).filter(el => el instanceof HTMLElement);
                
                // Se ainda há um modal aberto, não restaurar (a menos que pareça um falso positivo)
                if (activeModals.length > 0) {
                    // Falso positivo heurístico: elementos sem filhos visíveis (width/height 0) – possivelmente já desmontados.
                    const anyVisible = activeModals.some(el => {
                        const r = el.getBoundingClientRect();
                        return r.width > 2 && r.height > 2;
                    });
                    if (anyVisible) return; // existe de fato outro modal, não restaurar
                }
                
                // Se a página marcou que o scroll deve permanecer como está, não tentar restaurar
                // MAS: só pula se não há outro modal aberto (checagem acima confirmou)
                if (body.dataset.keepScroll === '1') {
                    if (source) {
                        console.debug('[AppModal] keepScroll=1, skip restore', {
                            source,
                        });
                    }
                    // Ainda assim, remova locks do modal para evitar scroll travado
                    body.style.overflow = '';
                    html.style.overflow = '';
                    html.style.removeProperty('overscroll-behavior-y');
                    body.classList.remove('MuiModal-open');
                    html.classList.remove('MuiModal-open');
                    if (body.dataset.appliedIosLock)
                        delete body.dataset.appliedIosLock;
                    return;
                }

                // Limpa estilos de lock (seja do MUI ou do nosso)
                body.style.overflow = '';
                body.style.position = '';
                body.style.top = '';
                body.style.left = '';
                body.style.right = '';
                body.style.width = '';
                body.style.touchAction = '';
                html.style.overflow = '';
                html.style.touchAction = '';
                html.style.removeProperty('overscroll-behavior-y');
                body.classList.remove('MuiModal-open');
                html.classList.remove('MuiModal-open');
                if (body.dataset.appliedIosLock)
                    delete body.dataset.appliedIosLock;

                // Neutraliza qualquer root escondido que tenha sobrado com z-index/pointer-events ativos.
                try {
                    const hiddenRoots = Array.from(
                        document.querySelectorAll(
                            '.MuiModal-root[aria-hidden="true"]',
                        ),
                    ) as HTMLElement[];
                    hiddenRoots.forEach(root => {
                        root.style.pointerEvents = 'none';
                        root.style.zIndex = '0';
                        const dialog = root.querySelector('[role="dialog"]') as
                            | HTMLElement
                            | null;
                        if (dialog) {
                            dialog.style.pointerEvents = 'none';
                            try {
                                dialog.blur();
                            } catch {
                                /* noop */
                            }
                        }
                    });
                } catch {
                    /* noop */
                }

                // Reflow para garantir aplicação das mudanças de estilo
                void body.offsetHeight;

                // Restaura posição de scroll (faz algumas tentativas com rAF e setTimeout)
                const targetY = prevScrollRef.current ?? 0;
                const scrollingEl =
                    prevScrollElRef.current ||
                    (document.scrollingElement as HTMLElement | null) ||
                    (document.documentElement as HTMLElement);
                const applyScroll = () => {
                    try {
                        if (scrollingEl) scrollingEl.scrollTop = targetY;
                        // Fallback adicional
                        window.scrollTo(0, targetY);
                    } catch {
                        /* noop */
                    }
                };
                applyScroll();
                requestAnimationFrame(() => applyScroll());
                setTimeout(() => applyScroll(), 50);
                setTimeout(() => applyScroll(), 100);

                // Restaura foco ao elemento anterior em desktop.
                // Em touch devices, evitar restauração de foco previne estado visual "preso"
                // (ex.: botão Sair destacado após fechar modal pelo X no iPhone/PWA).
                try {
                    const active =
                        (document.activeElement as HTMLElement | null) || null;
                    if (isCoarsePointerDevice) {
                        active?.blur?.();
                    } else {
                        const prev = prevActiveElRef.current;
                        if (prev && typeof prev.focus === 'function') {
                            // Some browsers support options for focus; pass preventScroll when available
                            (
                                prev.focus as unknown as (opts?: {
                                    preventScroll?: boolean;
                                }) => void
                            )({
                                preventScroll: true,
                            });
                        } else {
                            // Garanta foco fora do modal para evitar foco retido em container aria-hidden
                            (
                                document.body as unknown as {
                                    focus?: () => void;
                                }
                            ).focus?.();
                        }
                    }
                } catch {
                    /* noop */
                }
                if (source) {
                    // Instrumentação leve (não spam)
                    console.debug('[AppModal] restore scroll', { source });
                }
            } catch {
                /* noop */
            }
        };

        // Dispara diversas tentativas para contornar race conditions (Safari/iOS e possíveis delays do MUI)
        const timeouts = [0, 30, 60, 120, 250, 400].map(ms =>
            setTimeout(() => restore('close-timeout-' + ms), ms),
        );
        return () => {
            timeouts.forEach(t => clearTimeout(t));
        };
    }, [open, isCoarsePointerDevice]);

    // Restauração imediata no ciclo de desmontagem.
    // IMPORTANTE: não condicionar ao valor de 'open' — componentes pai podem
    // retornar null com open=true ainda no closure (ex.: BudgetModal), fazendo
    // com que o AppModal seja desmontado SEM ter passado por open=false.
    // O efeito com [] garante que o cleanup roda em todo unmount.
    React.useEffect(() => {
        return () => {
            try {
                const body = document.body as HTMLBodyElement;
                const html = document.documentElement as HTMLElement;
                body.style.overflow = '';
                body.style.position = '';
                body.style.top = '';
                body.style.left = '';
                body.style.right = '';
                body.style.width = '';
                body.style.touchAction = '';
                html.style.overflow = '';
                html.style.touchAction = '';
                html.style.removeProperty('overscroll-behavior-y');
                body.classList.remove('MuiModal-open');
                html.classList.remove('MuiModal-open');
                if (body.dataset.appliedIosLock)
                    delete body.dataset.appliedIosLock;
            } catch {
                /* noop */
            }
        };
    }, []); // [] = somente no unmount, independente de open

    return (
        <Modal
            open={open}
            onClose={handleMuiClose}
            sx={{ zIndex: 3000 }}
            slotProps={{
                root: {
                    style: {
                        zIndex: open ? 3000 : 0,
                        pointerEvents: open ? 'auto' : 'none',
                    },
                },
                backdrop: {
                    style: {
                        zIndex: open ? 2999 : 0,
                        pointerEvents: open ? 'auto' : 'none',
                    },
                },
            }}
            // Em fullScreen o próprio conteúdo já cobre toda a viewport,
            // então evitamos backdrop do MUI para não criar camada extra de clique.
            hideBackdrop={fullScreen}
            disableEscapeKeyDown={disableEscapeKeyDown || !closeOnEscape}
            // Apenas mantém montado quando não pedimos unmount explícito
            keepMounted={!unmountOnClose}
            disableScrollLock
        >
            <div
                style={{
                    position: fullScreen ? 'fixed' : undefined,
                    inset: fullScreen ? 0 : undefined,
                }}
            >
                {fullScreen && open && (
                    <div
                        data-appmodal-page-overlay='1'
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'var(--color-bg)',
                            // Overlay fica atrás do conteúdo principal
                            zIndex: 1300,
                            pointerEvents: 'none',
                        }}
                    />
                )}
                <Box
                    ref={contentRef}
                    role='dialog'
                    aria-modal={open ? true : undefined}
                    // Removido aria-hidden dinâmico: causava conflito com foco e gerava estado read-only.
                    onTouchStart={e => {
                        if (disableOuterScroll) return;
                        // Guard contra scroll elástico propagando para o body no iOS
                        const el = e.currentTarget as HTMLElement;
                        try {
                            // Memoriza posição Y do toque para detectar direção no touchmove
                            const t = (e.touches && e.touches[0]) || null;
                            lastTouchYRef.current = t ? t.clientY : null;
                            if (el.scrollHeight <= el.clientHeight + 1) return;
                            const atTop = el.scrollTop <= 0;
                            const atBottom =
                                el.scrollTop + el.clientHeight >=
                                el.scrollHeight - 1;
                            if (atTop) {
                                // Nudge para fora do topo para habilitar scroll interno
                                el.scrollTop = 1;
                            } else if (atBottom) {
                                // Nudge para dentro do final
                                el.scrollTop =
                                    el.scrollHeight - el.clientHeight - 1;
                            }
                        } catch {
                            /* noop */
                        }
                    }}
                    onTouchMove={e => {
                        if (disableOuterScroll) return;
                        // Em handlers React de touchmove o preventDefault pode ser tratado como passivo
                        // em alguns cenários do Safari/Chrome mobile. Mantemos apenas a telemetria
                        // da direção do gesto; o bloqueio real fica no listener nativo não passivo
                        // registrado no efeito de scroll lock do modal.
                        try {
                            const t = (e.touches && e.touches[0]) || null;
                            const currentY = t ? t.clientY : null;
                            lastTouchYRef.current = currentY;
                        } catch {
                            /* noop */
                        }
                    }}
                    sx={
                        fullScreen
                            ? {
                                  position: 'fixed',
                                  // Cobertura total da viewport (inclusive iOS com toolbars dinâmicas)
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  transform: 'none',
                                  bgcolor: 'var(--color-bg)',
                                  borderRadius: 0,
                                  boxShadow: 24,
                                  // Safe-area superior: pode ser desativado quando o conteúdo já trata disso
                                  pt: disableTopSafePadding
                                      ? 0
                                      : 'env(safe-area-inset-top, 0px)',
                                  pr: 2,
                                  pl: 2,
                                  // padding-bottom com safe-area inferior
                                  pb: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
                                  boxSizing: 'border-box',
                                  width: '100%',
                                  maxWidth: '100%',
                                  // Garante altura mínima para preencher a viewport dinâmica
                                  // Combina unidade JS custom (para iOS antigo) com 100dvh (Safari moderno) para evitar "vazamento" de fundo na barra inferior.
                                  minHeight:
                                      'calc(var(--appmodal-vh, 1vh) * 100)',
                                  height: '100dvh',
                                  overflowY: 'auto',
                                  overflowX: 'hidden',
                                  WebkitOverflowScrolling: 'touch',
                                  ...(disableOuterScroll
                                      ? {
                                            overflowY: 'visible',
                                            // Para permitir que um filho flex ocupe todo espaço e seja scrollable
                                            display: 'flex',
                                            flexDirection: 'column',
                                        }
                                      : {}),
                                  // Impede scroll chaining/scroll da página abaixo
                                  overscrollBehaviorY: 'contain',
                                  overscrollBehaviorX: 'none',
                                  pointerEvents: 'auto',
                                  // Garante que o conteúdo esteja acima do overlay e de backdrops residuais
                                  zIndex: 3001,
                                  // Overlays fixos para pintar áreas seguras (top já existe via ::before condicional; adicionamos ::after sempre para o bottom)
                                  '&::after': {
                                      content: '""',
                                      position: 'fixed',
                                      left: 0,
                                      right: 0,
                                      bottom: 0,
                                      // Soma safe-area e compensação dinâmica (se existente)
                                      height: 'calc(env(safe-area-inset-bottom, 0px) + var(--appmodal-bottom-comp, 0px))',
                                      background: 'var(--color-bg)',
                                      zIndex: 1,
                                      pointerEvents: 'none',
                                  },
                                  // A small fixed bar to paint the OS safe-area with the app's header blue
                                  ...(showCloseButton
                                      ? {
                                            '&::before': {
                                                content: '""',
                                                position: 'fixed',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                height: 'env(safe-area-inset-top, 0px)',
                                                background:
                                                    'var(--color-primary)',
                                                zIndex: 1,
                                                pointerEvents: 'none',
                                            },
                                        }
                                      : {}),
                              }
                            : {
                                  ...style,
                                  // Permite ajustar a altura máxima por modal
                                  maxHeight: `calc(var(--appmodal-vh, 1vh) * ${maxHeightVh})`,
                                  position: 'absolute' as const,
                                    // Conteúdo deve ficar acima do backdrop global do MUI.
                                    zIndex: 3001,
                                  WebkitOverflowScrolling: 'touch',
                              }
                    }
                    tabIndex={-1}
                    data-appmodal-fullscreen={fullScreen ? '1' : undefined}
                    data-bottom-comp={bottomComp || undefined}
                    style={
                        fullScreen && bottomComp
                            ? {
                                  // Expor CSS var para pseudo-element
                                  ['--appmodal-bottom-comp' as string]: `${bottomComp}px`,
                              }
                            : undefined
                    }
                >
                    {showCloseButton && (
                        <ModalActionsBar
                            onClose={onClose}
                            showCloseButton={showCloseButton}
                            style={actionsBarStyle}
                        />
                    )}
                    {/* Content fills full width — no right padding needed since the close bar sits above */}
                    <div
                        style={{
                            pointerEvents: 'auto',
                            ...(disableOuterScroll
                                ? {
                                      display: 'flex',
                                      flexDirection: 'column',
                                      flex: 1,
                                      minHeight: 0,
                                      width: '100%',
                                  }
                                : {}),
                        }}
                    >
                        {children}
                        {/* Internal bottom scroll buffer to prevent revealing underlying page on iOS rubber-band */}
                        <div
                            data-testid='appmodal-bottom-buffer'
                            style={{
                                height: 'calc(env(safe-area-inset-bottom, 0px) + var(--appmodal-bottom-comp, 0px) + 32px)',
                                width: '100%',
                                pointerEvents: 'none',
                            }}
                        />
                    </div>
                </Box>
            </div>
        </Modal>
    );
}
