// frontend\src\components\Modal.tsx
import React from 'react';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';

interface AppModalProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
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

export default function AppModal({ open, onClose, children }: AppModalProps) {
    return (
        <Modal open={open} onClose={onClose}>
            <Box sx={style}>{children}</Box>
        </Modal>
    );
}
