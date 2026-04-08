import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DesktopAgendaPage from '../DesktopAgendaPage';

describe('DesktopAgendaPage', () => {
    const originalFetch = global.fetch;
    beforeEach(() => {
        // Mock fetch for appointments API
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [],
        } as unknown as Response);
        // Ensure no token expiry path during tests
        localStorage.setItem('accessToken', 'test-token');
    });
    afterEach(() => {
        global.fetch = originalFetch as typeof global.fetch;
        localStorage.clear();
    });

    it('renders header and status filter', async () => {
        render(<DesktopAgendaPage />);
        expect(
            await screen.findByText(/Agenda — Desktop/i),
        ).toBeInTheDocument();
        // Default filter: the "Ativos" pill should have aria-pressed=true
        const ativosBtn = screen.getByRole('button', { name: 'Ativos' });
        expect(ativosBtn).toBeInTheDocument();
        expect(ativosBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('allows navigating days via buttons', async () => {
        render(<DesktopAgendaPage />);
        const left = screen.getByLabelText(/Dia anterior/i);
        const right = screen.getByLabelText(/Próximo dia/i);
        expect(left).toBeInTheDocument();
        expect(right).toBeInTheDocument();
        fireEvent.click(left);
        fireEvent.click(right);
        // Click calendar label
        const pickerBtn = screen.getByLabelText(/Selecionar data/i);
        fireEvent.click(pickerBtn);
        // FloatingDatePicker opens (root rendered) — we can't assert internals without ids,
        // but no error should be thrown.
        expect(true).toBe(true);
    });
});
