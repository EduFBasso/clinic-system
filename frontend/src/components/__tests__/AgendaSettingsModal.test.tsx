import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AgendaSettingsModal } from '../AgendaSettingsModal/AgendaSettingsModal';
import { resetAgendaSettings } from '../../utils/agendaSettings';

const emitMock = vi.hoisted(() => vi.fn());
vi.mock('../../events/bus', () => ({ emit: emitMock }));

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
        defaultDuration: 'agenda.defaultDuration',
        defaultVisitType: 'defaultVisitType',
    };

    function clearLS() {
        Object.values(LS_KEYS).forEach(k => localStorage.removeItem(k));
    }

    beforeEach(() => {
        clearLS();
        resetAgendaSettings();
        emitMock.mockClear();
        vi.restoreAllMocks();
        vi.stubGlobal('fetch', vi.fn());
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

    it('loads persisted agenda settings from backend', async () => {
        localStorage.setItem('accessToken', 'token');
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                work_start_hour: 7,
                work_start_minute: 30,
                work_end_hour: 19,
                work_end_minute: 15,
                slot_minutes: 15,
                reminder_enabled: true,
                reminder_minutes_before: 120,
            }),
        } as Response);

        render(<AgendaSettingsModal open={true} onClose={() => {}} />);

        await waitFor(() => {
            expect(screen.getByLabelText(/Início expediente/i)).toHaveValue(
                '07:30',
            );
        });
        expect(screen.getByLabelText(/Fim expediente/i)).toHaveValue('19:15');
        expect(screen.getByLabelText(/Intervalo/)).toHaveValue('15');
    });

    it('saves persisted fields to backend', async () => {
        localStorage.setItem('accessToken', 'token');
        vi.mocked(fetch)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    work_start_hour: 6,
                    work_start_minute: 0,
                    work_end_hour: 21,
                    work_end_minute: 0,
                    slot_minutes: 10,
                    reminder_enabled: false,
                    reminder_minutes_before: 90,
                }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    work_start_hour: 7,
                    work_start_minute: 30,
                    work_end_hour: 20,
                    work_end_minute: 0,
                    slot_minutes: 15,
                    reminder_enabled: false,
                    reminder_minutes_before: 90,
                }),
            } as Response);

        render(<AgendaSettingsModal open={true} onClose={() => {}} />);
        fireEvent.change(screen.getByLabelText(/Início expediente/i), {
            target: { value: '07:30' },
        });
        fireEvent.change(screen.getByLabelText(/Fim expediente/i), {
            target: { value: '20:00' },
        });
        fireEvent.change(screen.getByLabelText(/Intervalo/), {
            target: { value: '15' },
        });
        fireEvent.change(screen.getByLabelText(/Duração padrão/), {
            target: { value: '90' },
        });
        fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(2);
        });
        expect(vi.mocked(fetch).mock.calls[1]?.[1]).toMatchObject({
            method: 'PATCH',
        });
        expect(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body)).toContain(
            '"work_start_minute":30',
        );
        expect(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body)).toContain(
            '"default_duration_minutes":90',
        );
        expect(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body)).toContain(
            '"default_visit_type":"consulta"',
        );
        await waitFor(() => {
            expect(emitMock).toHaveBeenCalledWith(
                'systemMessage',
                expect.objectContaining({ text: 'Configurações salvas.' }),
            );
        });
    });

    it('shows error when end <= start and does not persist', () => {
        localStorage.setItem('accessToken', 'token');
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                work_start_hour: 6,
                work_start_minute: 0,
                work_end_hour: 21,
                work_end_minute: 0,
                slot_minutes: 10,
                reminder_enabled: false,
                reminder_minutes_before: 90,
            }),
        } as Response);
        render(<AgendaSettingsModal open={true} onClose={() => {}} />);
        fireEvent.change(screen.getByLabelText(/Fim expediente/i), {
            target: { value: '05:59' },
        });
        fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
        expect(screen.getByRole('status')).toHaveTextContent(
            /Fim deve ser maior/i,
        );
        expect(fetch).toHaveBeenCalledTimes(1);
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

    it('enter key triggers save', async () => {
        localStorage.setItem('accessToken', 'token');
        vi.mocked(fetch)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    work_start_hour: 6,
                    work_start_minute: 0,
                    work_end_hour: 21,
                    work_end_minute: 0,
                    slot_minutes: 10,
                    reminder_enabled: false,
                    reminder_minutes_before: 90,
                }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    work_start_hour: 8,
                    work_start_minute: 0,
                    work_end_hour: 21,
                    work_end_minute: 0,
                    slot_minutes: 10,
                    reminder_enabled: false,
                    reminder_minutes_before: 90,
                }),
            } as Response);

        render(<AgendaSettingsModal open={true} onClose={() => {}} />);
        const start = screen.getByLabelText(/Início expediente/i);
        fireEvent.change(start, { target: { value: '08:00' } });
        fireEvent.keyDown(start, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(2);
        });
    });
});
