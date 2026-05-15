import { useState } from 'react';
import { API_BASE } from '../config/api';
import { getAccessToken } from '../utils/auth/session';
import type { ClientData } from '../types/ClientData';

interface UseClientDeleteParams {
    cliente?: Partial<ClientData>;
    setFeedback: (v: { type: 'error'; message: string } | null) => void;
}

export interface ClientDeleteHook {
    deleteModalOpen: boolean;
    handleDelete: () => void;
    confirmDelete: () => void;
    cancelDelete: () => void;
}

export function useClientDelete({
    cliente,
    setFeedback,
}: UseClientDeleteParams): ClientDeleteHook {
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    function handleDelete() {
        setDeleteModalOpen(true);
    }

    function cancelDelete() {
        setDeleteModalOpen(false);
    }

    function confirmDelete() {
        setDeleteModalOpen(false);

        try {
            (document.activeElement as HTMLElement | null)?.blur?.();
            document.body.classList.remove('keyboardOpen');
        } catch { /* noop */ }

        const token = getAccessToken();
        if (!token) {
            setFeedback({ type: 'error', message: 'Usuário não autenticado.' });
            return;
        }

        fetch(`${API_BASE}/register/clients/${cliente?.id}/`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => {
                if (!res.ok) {
                    setFeedback({ type: 'error', message: 'Erro ao excluir cliente' });
                    throw new Error('Erro ao excluir cliente');
                }
                try { localStorage.setItem('postDeleteAction', 'clearFilter'); } catch { /* noop */ }

                try {
                    if (window.opener) {
                        window.opener.dispatchEvent(new Event('clearClients'));
                        window.opener.dispatchEvent(new Event('updateClients'));
                    } else {
                        window.dispatchEvent(new Event('updateClients'));
                    }
                } catch { /* noop */ }

                if (window.opener) {
                    try { window.close(); } catch { /* noop */ }
                } else {
                    try { document.body.classList.remove('keyboardOpen'); } catch { /* noop */ }
                    try { window.dispatchEvent(new Event('clearClients')); } catch { /* noop */ }
                    window.location.assign('/');
                }
            })
            .catch(err => {
                setFeedback({ type: 'error', message: 'Erro ao excluir cliente: ' + err.message });
            });
    }

    return { deleteModalOpen, handleDelete, confirmDelete, cancelDelete };
}
