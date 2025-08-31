// frontend\src\components\Modal.tsx
import React from 'react';
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
}: AppModalProps) {
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

    return (
        <Modal
            open={open}
            onClose={handleMuiClose}
            disableEscapeKeyDown={disableEscapeKeyDown || !closeOnEscape}
        >
            <Box sx={{ ...style, position: 'absolute' }}>
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
