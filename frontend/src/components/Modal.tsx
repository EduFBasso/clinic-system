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
            prevScrollRef.current =
                window.scrollY || document.documentElement.scrollTop || 0;
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
                body.style.top = `-${prevScrollRef.current}px`;
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
                const body = document.body as HTMLBodyElement;
                const html = document.documentElement as HTMLElement;
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
                html.style.overflow = '';
                html.style.removeProperty('overscroll-behavior-y');
                body.classList.remove('MuiModal-open');
                html.classList.remove('MuiModal-open');
                if (body.dataset.appliedIosLock)
                    delete body.dataset.appliedIosLock;

                // Reflow para garantir aplicação das mudanças de estilo
                void body.offsetHeight;

                // Restaura posição de scroll (iOS precisa várias tentativas às vezes)
                if (prevScrollRef.current != null) {
                    try {
                        window.scrollTo({
                            top: prevScrollRef.current,
                            behavior: 'instant' as ScrollBehavior,
                        });
                    } catch {
                        /* noop */
                    }
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
                    html.style.overflow = '';
                    html.style.removeProperty('overscroll-behavior-y');
                    body.classList.remove('MuiModal-open');
                    html.classList.remove('MuiModal-open');
                }
            } catch {
                /* noop */
            }
        };
    }, [open]);

    return (
        <Modal
            open={open}
            onClose={handleMuiClose}
            disableEscapeKeyDown={disableEscapeKeyDown || !closeOnEscape}
        >
            <Box
                ref={contentRef}
                sx={
                    fullScreen
                        ? {
                              position: 'fixed',
                              top: 0,
                              left: 0,
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
                              // usar viewport dinâmico para contornar toolbars do Safari
                              height: 'calc(var(--appmodal-vh, 1vh) * 100)',
                              maxHeight: 'calc(var(--appmodal-vh, 1vh) * 100)',
                              overflowY: 'auto',
                              overflowX: 'hidden',
                              WebkitOverflowScrolling: 'touch',
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
                    }}
                >
                    {children}
                </div>
            </Box>
        </Modal>
    );
}
