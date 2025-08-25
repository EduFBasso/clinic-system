// frontend\src\components\Modal.tsx
import React from 'react';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';

interface AppModalProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    closeOnEnter?: boolean; // padrão: true – fecha ao pressionar Enter
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

    return (
        <Modal open={open} onClose={onClose}>
            <Box sx={style}>{children}</Box>
        </Modal>
    );
}
