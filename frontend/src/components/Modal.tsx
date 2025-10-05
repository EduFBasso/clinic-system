// frontend\src\components\Modal.tsx
import React from 'react';

// Augmenta Window global (deve estar em nível de módulo)
declare global {
    interface Window {
        __ensureScrollUnlockInstalled?: boolean;
    }
}
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
    } = props;

    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const prevScrollRef = React.useRef<number>(0);
    const prevWindowScrollRef = React.useRef<number>(0);
    const prevScrollElRef = React.useRef<HTMLElement | null>(null);
    const prevActiveElRef = React.useRef<HTMLElement | null>(null);
    // Track last touch Y to detect overscroll direction (iOS rubber-band guard)
    const lastTouchYRef = React.useRef<number | null>(null);

    const isIOS = React.useMemo(() => {
        if (typeof navigator === 'undefined') return false;
        const ua = navigator.userAgent || '';
        const platform = navigator.platform || '';
        return (
            /iP(ad|hone|od)/.test(ua) ||
            (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        );
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
        document.addEventListener(
            'touchmove',
            preventOutsideScroll,
            passiveFalse,
        );
        document.addEventListener('wheel', preventOutsideScroll, passiveFalse);

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
                document.removeEventListener(
                    'touchmove',
                    preventOutsideScroll as EventListener,
                );
                document.removeEventListener(
                    'wheel',
                    preventOutsideScroll as EventListener,
                );
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
                // Se a página marcou que o scroll deve permanecer como está, não tentar restaurar
                if (body.dataset.keepScroll === '1') {
                    if (source) {
                        console.debug('[AppModal] keepScroll=1, skip restore', {
                            source,
                        });
                    }
                    // Ainda assim, remova locks do modal
                    body.style.overflow = '';
                    html.style.overflow = '';
                    html.style.removeProperty('overscroll-behavior-y');
                    body.classList.remove('MuiModal-open');
                    html.classList.remove('MuiModal-open');
                    if (body.dataset.appliedIosLock)
                        delete body.dataset.appliedIosLock;
                    return;
                }
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
                    if (anyVisible) return; // existe de fato outro modal
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

                // Restaura foco ao elemento anterior, evitando scroll
                try {
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
                        try {
                            (
                                document.body as unknown as {
                                    focus?: () => void;
                                }
                            ).focus?.();
                        } catch {
                            /* noop */
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

        // Registrar fallback listeners uma única vez (singleton)
        if (!window.__ensureScrollUnlockInstalled) {
            window.__ensureScrollUnlockInstalled = true;
            const handler = (ev?: Event) => {
                const body = document.body as HTMLBodyElement;
                if (
                    body.classList.contains('MuiModal-open') ||
                    body.style.position === 'fixed' ||
                    body.style.overflow === 'hidden'
                ) {
                    // Tentativa adicional (não depende do estado local de 'open').
                    restore(ev?.type ? 'global-' + ev.type : 'global-manual');
                }
            };
            [
                'click',
                'focus',
                'scroll',
                'touchstart',
                'ensureScrollUnlocked',
            ].forEach(evt =>
                window.addEventListener(evt, handler, {
                    passive: true,
                }),
            );
        }
        return () => timeouts.forEach(t => clearTimeout(t));
    }, [open]);

    // MutationObserver: remove aria-hidden reintroduzido no dialog durante estado aberto
    React.useEffect(() => {
        if (!open) return;
        const dialog = contentRef.current;
        if (!dialog) return;
        const observer = new MutationObserver(muts => {
            muts.forEach(m => {
                if (
                    m.type === 'attributes' &&
                    m.attributeName === 'aria-hidden'
                ) {
                    if (dialog.getAttribute('aria-hidden') === 'true') {
                        dialog.removeAttribute('aria-hidden');
                        dialog.style.pointerEvents = 'auto';
                        window.dispatchEvent(
                            new CustomEvent('debug:log', {
                                detail: {
                                    label: 'Modal: dialog aria-hidden auto-removed',
                                    data: { classes: dialog.className },
                                    ts: Date.now(),
                                },
                            }),
                        );
                    }
                }
            });
        });
        observer.observe(dialog, {
            attributes: true,
            attributeFilter: ['aria-hidden'],
        });
        return () => observer.disconnect();
    }, [open]);

    // Interaction watchdog: garante remoção de travas residuais (pointer-events / backdrops órfãos)
    React.useEffect(() => {
        function inspect(reason: string) {
            try {
                const body = document.body;
                const html = document.documentElement;
                const orphanBackdrops = Array.from(
                    document.querySelectorAll('.MuiBackdrop-root'),
                ).filter(b => !b.closest('[role="dialog"]'));
                // Detect stale modal root containers (MuiModal-root) that remain in DOM after close but keep high z-index
                const staleModalRoots = Array.from(
                    document.querySelectorAll('.MuiModal-root'),
                ) as HTMLElement[];
                const filteredStaleModalRoots: HTMLElement[] =
                    staleModalRoots.filter(root => {
                        const hasDialog =
                            !!root.querySelector('[role="dialog"]');
                        const style = window.getComputedStyle(root);
                        const z = parseInt(style.zIndex || '0', 10);
                        // Consider stale if no dialog inside OR pointer-events none mismatch and high z-index
                        return !hasDialog && z >= 1200;
                    });
                // Captura elemento sob o centro da viewport (se nada recebe click, elementFromPoint ajuda)
                const cx = window.innerWidth / 2;
                const cy = window.innerHeight / 2;
                const elCenter = document.elementFromPoint(
                    cx,
                    cy,
                ) as HTMLElement | null;
                // Caminha ancestrais para detectar travas
                const lockedAncestors: string[] = [];
                let walker: HTMLElement | null = elCenter;
                type InertEl = HTMLElement & { inert?: boolean };
                while (walker) {
                    const style = window.getComputedStyle(walker);
                    const inertWalker = walker as InertEl;
                    const inertAttr = inertWalker.inert ? 'inert' : '';
                    if (
                        style.pointerEvents === 'none' ||
                        inertAttr ||
                        walker.classList.contains('MuiModal-open')
                    ) {
                        lockedAncestors.push(
                            `${walker.tagName.toLowerCase()}#${
                                walker.id || ''
                            }.$${walker.className}|pe:${
                                style.pointerEvents
                            }|inert:${inertAttr}`,
                        );
                        // Tentativa de limpeza
                        if (style.pointerEvents === 'none') {
                            (walker as HTMLElement).style.pointerEvents = '';
                        }
                        try {
                            inertWalker.inert = false;
                        } catch {
                            /* noop */
                        }
                        walker.classList.remove('MuiModal-open');
                    }
                    walker = walker.parentElement;
                }
                const snapshot = {
                    reason,
                    bodyOverflow: body.style.overflow,
                    bodyPosition: body.style.position,
                    bodyPE: (body as HTMLElement).style.pointerEvents,
                    htmlOverflow: html.style.overflow,
                    htmlPE: (html as HTMLElement).style.pointerEvents,
                    hasMuiModalOpenClass:
                        body.classList.contains('MuiModal-open'),
                    orphanBackdrops: orphanBackdrops.length,
                    centerEl: elCenter?.tagName.toLowerCase(),
                    centerElClasses: elCenter?.className || '',
                    lockedAncestors,
                };
                // Correções forçadas globais
                body.style.pointerEvents = '';
                html.style.pointerEvents = '';
                body.classList.remove('MuiModal-open');
                html.classList.remove('MuiModal-open');
                orphanBackdrops.forEach(b => b.parentElement?.removeChild(b));
                filteredStaleModalRoots.forEach(r => {
                    // Remove or neutralize overlays that might intercept clicks
                    try {
                        r.style.pointerEvents = 'none';
                        r.style.zIndex = '0';
                        // If empty, remove to keep DOM clean
                        if (!r.firstElementChild)
                            r.parentElement?.removeChild(r);
                    } catch {
                        /* noop */
                    }
                });
                // Remove qualquer backdrop com pointer-events ainda ativo
                const strayPeNone = document.querySelectorAll(
                    '[style*="pointer-events: none"]',
                );
                strayPeNone.forEach(el => {
                    if (el === body || el === html) return;
                    (el as HTMLElement).style.pointerEvents = '';
                });
                window.dispatchEvent(
                    new CustomEvent('debug:log', {
                        detail: {
                            label: 'Modal: interaction watchdog',
                            data: snapshot,
                            ts: Date.now(),
                        },
                    }),
                );
            } catch {
                /* noop */
            }
        }
        const multipointScan = (tag: string) => {
            try {
                const points: Array<[number, number]> = [
                    [window.innerWidth * 0.25, window.innerHeight * 0.5],
                    [window.innerWidth * 0.5, window.innerHeight * 0.5],
                    [window.innerWidth * 0.75, window.innerHeight * 0.5],
                    [window.innerWidth * 0.5, window.innerHeight * 0.25],
                    [window.innerWidth * 0.5, window.innerHeight * 0.75],
                ];
                const overlays: string[] = [];
                points.forEach(([x, y]) => {
                    const el = document.elementFromPoint(
                        x,
                        y,
                    ) as HTMLElement | null;
                    if (!el) return;
                    const z = window.getComputedStyle(el).zIndex;
                    const pe = window.getComputedStyle(el).pointerEvents;
                    if (pe === 'none') return; // não bloqueia interação
                    if (z && Number(z) >= 1000) {
                        overlays.push(
                            `${tag}:${el.tagName.toLowerCase()}#${el.id}.${
                                el.className
                            }.z${z}`,
                        );
                    }
                });
                if (overlays.length) {
                    window.dispatchEvent(
                        new CustomEvent('debug:log', {
                            detail: {
                                label: 'Modal: multipoint overlay scan',
                                data: { overlays },
                                ts: Date.now(),
                            },
                        }),
                    );
                }
            } catch {
                /* noop */
            }
        };
        const onClosed = (e: Event) => {
            const ce = e as CustomEvent;
            inspect('modal:closed:' + (ce?.detail?.type || 'unknown'));
            setTimeout(() => inspect('post-closed-120ms'), 120);
            setTimeout(() => {
                inspect('post-closed-400ms');
                multipointScan('scan-400ms');
            }, 400);
        };
        window.addEventListener('modal:closed', onClosed);
        // Atalho emergencial: Ctrl+Shift+U para liberar travas manualmente
        const onKey = (ev: KeyboardEvent) => {
            if (ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === 'u') {
                inspect('manual-unlock-hotkey');
                multipointScan('manual-unlock-hotkey');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('modal:closed', onClosed);
            window.removeEventListener('keydown', onKey);
        };
    }, []);

    // Restauração imediata também no ciclo de desmontagem (caso o componente seja removido rapidamente)
    React.useEffect(() => {
        return () => {
            try {
                if (!open) {
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
                }
            } catch {
                /* noop */
            }
        };
    }, [open]);

    // (Removed inert toggling) — inert causava estados 'aria-hidden' residuais combinados com pointer-events inconsistentes.
    // Mantemos o conteúdo montado mas confiamos em aria-hidden/open e watchdog para desbloqueio.

    // Extra stale-root watchdog (rápido): se existir .MuiModal-root[aria-hidden="true"] contendo role=dialog visível, corrigir atributos.
    React.useEffect(() => {
        if (!open) return;
        const fix = () => {
            try {
                const roots = Array.from(
                    document.querySelectorAll('.MuiModal-root'),
                ) as HTMLElement[];
                roots.forEach(r => {
                    const dialog = r.querySelector('[role="dialog"]') as
                        | (HTMLElement & { inert?: boolean })
                        | null;
                    if (!dialog) return;
                    const hidden = r.getAttribute('aria-hidden') === 'true';
                    const inertAttr = dialog.inert === true;
                    if (hidden || inertAttr) {
                        r.removeAttribute('aria-hidden');
                        try {
                            dialog.inert = false;
                        } catch {
                            /* noop */
                        }
                        r.style.pointerEvents = 'auto';
                        dialog.style.pointerEvents = 'auto';
                        window.dispatchEvent(
                            new CustomEvent('debug:log', {
                                detail: {
                                    label: 'Modal: stale root fixed',
                                    data: {
                                        hidden,
                                        inert: inertAttr,
                                        classes: r.className,
                                    },
                                    ts: Date.now(),
                                },
                            }),
                        );
                    }
                });
            } catch {
                /* noop */
            }
        };
        // Tentativas rápidas para capturar transição
        const timeouts = [0, 30, 90, 180, 360].map(ms => setTimeout(fix, ms));
        return () => timeouts.forEach(t => clearTimeout(t));
    }, [open]);

    return (
        <Modal
            open={open}
            onClose={handleMuiClose}
            disableEscapeKeyDown={disableEscapeKeyDown || !closeOnEscape}
            keepMounted
            disableScrollLock
        >
            <Box
                ref={contentRef}
                role='dialog'
                aria-modal={open ? true : undefined}
                // Removido aria-hidden dinâmico: causava conflito com foco e gerava estado read-only.
                onTouchStart={e => {
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
                    // Se o conteúdo não consegue rolar ou está numa borda e o gesto tenta exceder, previne a propagação (impede scroll da página)
                    const el = e.currentTarget as HTMLElement;
                    try {
                        const t = (e.touches && e.touches[0]) || null;
                        const currentY = t ? t.clientY : null;
                        const lastY = lastTouchYRef.current;
                        if (currentY != null && lastY != null) {
                            const dy = currentY - lastY; // positivo: arrastando para baixo
                            const canScroll =
                                el.scrollHeight > el.clientHeight + 1;
                            const atTop = el.scrollTop <= 0;
                            const atBottom =
                                el.scrollTop + el.clientHeight >=
                                el.scrollHeight - 1;
                            const tryingPastTop = dy > 0 && atTop;
                            const tryingPastBottom = dy < 0 && atBottom;
                            if (
                                !canScroll ||
                                tryingPastTop ||
                                tryingPastBottom
                            ) {
                                // Previne o rubber-band atingir o body/viewport
                                e.preventDefault();
                                return;
                            }
                        }
                        // Atualiza última posição
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
                              minHeight: 'calc(var(--appmodal-vh, 1vh) * 100)',
                              overflowY: 'auto',
                              overflowX: 'hidden',
                              WebkitOverflowScrolling: 'touch',
                              // Impede scroll chaining/scroll da página abaixo
                              overscrollBehaviorY: 'contain',
                              overscrollBehaviorX: 'none',
                              pointerEvents: 'auto',
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
                                            background: 'var(--color-primary)',
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
                              WebkitOverflowScrolling: 'touch',
                          }
                }
                tabIndex={-1}
            >
                {showCloseButton && (
                    <ModalActionsBar
                        onClose={onClose}
                        showCloseButton={showCloseButton}
                        style={actionsBarStyle}
                    />
                )}
                {/* Reserve a right-side safe area so content never goes under the sticky close (X) */}
                <div
                    style={{
                        // Reserve space for larger touch target (44px) + small gutter
                        paddingRight: showCloseButton ? 48 : 0,
                        pointerEvents: 'auto',
                    }}
                >
                    {children}
                </div>
            </Box>
        </Modal>
    );
}
