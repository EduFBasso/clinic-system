/// <reference types="vitest" />
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AgendaSettingsModal from '../AgendaSettingsModal';

vi.mock('../Modal', () => ({
    default: ({
        open,
        children,
    }: {
        open: boolean;
        children: React.ReactNode;
    }) => (open ? <div data-testid='modal-root'>{children}</div> : null),
}));

describe('AgendaSettingsModal', () => {
    const LS_KEYS = {
        workStart: 'agenda.workStart',
        workEnd: 'agenda.workEnd',
        slotInterval: 'agenda.slotInterval',
        defaultDuration: 'agenda.defaultDuration',
        defaultVisitType: 'defaultVisitType',
    };

    function clearLS() {
        Object.values(LS_KEYS).forEach(k => localStorage.removeItem(k));
    }

    beforeEach(() => {
        clearLS();
    });

    it('renders fields with defaults when no localStorage', () => {
        render(<AgendaSettingsModal open={true} onClose={() => {}} />);
        expect(screen.getByLabelText(/Início expediente/i)).toHaveValue(
            '06:00',
        );
        expect(screen.getByLabelText(/Fim expediente/i)).toHaveValue('21:00');
        expect(screen.getByLabelText(/Intervalo/)).toHaveValue('10');
        expect(screen.getByLabelText(/Duração padrão/)).toHaveValue('60');
        expect(screen.getByLabelText(/Tipo padrão/)).toHaveValue('consulta');
    });

    it('saves updated values to localStorage', () => {
        render(<AgendaSettingsModal open={true} onClose={() => {}} />);
        fireEvent.change(screen.getByLabelText(/Início expediente/i), {
            target: { value: '07:30' },
        });
        fireEvent.change(screen.getByLabelText(/Intervalo/), {
            target: { value: '15' },
        });
        fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
        expect(localStorage.getItem(LS_KEYS.workStart)).toBe('07:30');
        expect(localStorage.getItem(LS_KEYS.slotInterval)).toBe('15');
        expect(screen.getByRole('status')).toHaveTextContent(
            /Configurações salvas/i,
        );
    });

    it('shows error when end <= start and does not persist', () => {
        render(<AgendaSettingsModal open={true} onClose={() => {}} />);
        fireEvent.change(screen.getByLabelText(/Fim expediente/i), {
            target: { value: '05:59' },
        });
        fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
        expect(screen.getByRole('status')).toHaveTextContent(
            /Fim deve ser maior/i,
        );
        expect(localStorage.getItem(LS_KEYS.workEnd)).toBeNull();
    });

    it('reset restores defaults and disables when already defaults', () => {
        render(<AgendaSettingsModal open={true} onClose={() => {}} />);
        const resetBtn = screen.getByRole('button', {
            name: /restaurar padrões/i,
        });
        expect(resetBtn).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/Início expediente/i), {
            target: { value: '07:00' },
        });
        expect(resetBtn).not.toBeDisabled();
        fireEvent.click(resetBtn);
        expect(screen.getByLabelText(/Início expediente/i)).toHaveValue(
            '06:00',
        );
        expect(screen.getByRole('status')).toHaveTextContent(
            /Padrões restaurados/i,
        );
    });

    it('enter key triggers save', () => {
        render(<AgendaSettingsModal open={true} onClose={() => {}} />);
        const start = screen.getByLabelText(/Início expediente/i);
        fireEvent.change(start, { target: { value: '08:00' } });
        fireEvent.keyDown(start, { key: 'Enter', code: 'Enter' });
        expect(localStorage.getItem(LS_KEYS.workStart)).toBe('08:00');
    });
});
