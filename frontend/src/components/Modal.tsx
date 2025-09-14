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

interface AppModalProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    closeOnEnter?: boolean; // padrão: true – fecha ao pressionar Enter
    closeOnEscape?: boolean; // padrão: true – fecha ao pressionar Escape
    showCloseButton?: boolean; // padrão: true – mostra botão X
    disableBackdropClose?: boolean; // se true, clicar fora não fecha
    disableEscapeKeyDown?: boolean; // se true, ESC do MUI não fecha
    fullScreen?: boolean; // se true, ocupa a tela inteira
}

const style = {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    bgcolor: 'background.paper',
    borderRadius: 2,
    boxShadow: 24,
    p: 4,
    pb: 6, // padding-bottom extra
    minWidth: 340,
    width: '100%',
    maxWidth: { xs: '98vw', sm: '700px', md: '900px', lg: '1100px' },
    maxHeight: '90vh',
    overflowY: 'auto',
};

export default function AppModal({
    open,
    onClose,
    children,
    closeOnEnter = true,
    closeOnEscape = true,
    showCloseButton = true,
    disableBackdropClose = false,
    disableEscapeKeyDown = false,
    fullScreen = false,
}: AppModalProps) {
    // Detecta iOS (Safari principalmente). Heurística simples suficiente para fallback de scroll.
    const isIOS = React.useMemo(() => {
        if (typeof navigator === 'undefined') return false;
        const ua = navigator.userAgent;
        const platform = navigator.platform;
        // Alguns navegadores expõem maxTouchPoints (Safari iPad em modo desktop) sem definir tipo em TS lib alvo
        const maxTouchPoints =
            (navigator as unknown as { maxTouchPoints?: number })
                .maxTouchPoints || 0;
        return (
            /iP(ad|hone|od)/.test(ua) ||
            (platform === 'MacIntel' && maxTouchPoints > 1)
        );
    }, []);

    // Armazena scroll anterior para restauração após fechar modal (iOS lock fix)
    const prevScrollRef = React.useRef<number | null>(null);

    // Ao abrir: capturamos posição de scroll e (em iOS) aplicamos um lock leve baseado em position:fixed.
    React.useEffect(() => {
        if (!open) return;
        // Captura scroll atual
        prevScrollRef.current =
            window.scrollY ||
            document.documentElement.scrollTop ||
            document.body.scrollTop ||
            0;
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
    }, [open, isIOS]);
    // Fecha modal ao pressionar Enter (padronização para modais de mensagem)
    React.useEffect(() => {
        if (!open || !closeOnEnter) return;
        function onKeyDown(e: KeyboardEvent) {
            // Ignora se o usuário estiver com Shift/Ctrl/Alt para evitar conflitos
            if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.ctrlKey &&
                !e.altKey &&
                !e.metaKey
            ) {
                // Evita submits acidentais ao pressionar Enter em formulários dentro do modal de mensagem
                e.preventDefault();
                onClose();
            }
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, closeOnEnter, onClose]);

    // Fecha modal ao pressionar Escape (fallback explícito; MUI já tenta fechar por ESC)
    React.useEffect(() => {
        if (!open || !closeOnEscape) return;
        function onKeyDown(e: KeyboardEvent) {
            if (
                e.key === 'Escape' &&
                !e.shiftKey &&
                !e.ctrlKey &&
                !e.altKey &&
                !e.metaKey
            ) {
                e.preventDefault();
                onClose();
            }
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, closeOnEscape, onClose]);

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
                sx={
                    fullScreen
                        ? {
                              position: 'fixed',
                              top: 0,
                              left: 0,
                              transform: 'none',
                              bgcolor: 'background.paper',
                              borderRadius: 0,
                              boxShadow: 24,
                              p: 2,
                              pb: 2,
                              width: '100vw',
                              maxWidth: '100vw',
                              height: '100vh',
                              maxHeight: '100vh',
                              overflowY: 'auto',
                          }
                        : { ...style, position: 'absolute' as const }
                }
            >
                {showCloseButton && (
                    <button
                        aria-label='Fechar'
                        onClick={onClose}
                        style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            background: 'transparent',
                            border: 'none',
                            fontSize: 18,
                            cursor: 'pointer',
                            color: 'rgba(0,0,0,0.56)',
                        }}
                    >
                        ×
                    </button>
                )}
                {children}
            </Box>
        </Modal>
    );
}
