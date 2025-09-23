import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AppointmentCard, { type SharedAppointmentLike } from './AppointmentCard';

function makeAppt(
    partial: Partial<SharedAppointmentLike>,
): SharedAppointmentLike {
    const base: SharedAppointmentLike = {
        id: 1,
        title: 'Consulta',
        start_at: new Date(Date.now() + 60_000).toISOString(),
        end_at: new Date(Date.now() + 61_000).toISOString(),
        status: 'scheduled',
        notes: undefined,
        client_name: 'Fulano',
    };
    return { ...base, ...partial } as SharedAppointmentLike;
}

describe('AppointmentCard', () => {
    it('renders status badge "Pendente" for past scheduled', () => {
        const past = makeAppt({
            start_at: new Date(Date.now() - 10 * 60_000).toISOString(),
            end_at: new Date(Date.now() - 5 * 60_000).toISOString(),
        });
        render(<AppointmentCard appt={past} now={new Date()} />);
        expect(screen.getByText('Pendente')).toBeInTheDocument();
    });

    it('renders status badge "Em andamento" for ongoing', () => {
        const s = new Date(Date.now() - 60_000).toISOString();
        const e = new Date(Date.now() + 60_000).toISOString();
        const appt = makeAppt({ start_at: s, end_at: e });
        render(<AppointmentCard appt={appt} now={new Date()} />);
        expect(screen.getByText('Em andamento')).toBeInTheDocument();
    });

    it('renders status badge "Cancelado" for canceled', () => {
        const appt = makeAppt({ status: 'canceled' });
        render(<AppointmentCard appt={appt} now={new Date()} />);
        expect(screen.getByText('Cancelado')).toBeInTheDocument();
    });

    it('calls onClick with appt when provided', () => {
        const appt = makeAppt({});
        const onClick = vi.fn();
        render(<AppointmentCard appt={appt} onClick={onClick} />);
        fireEvent.click(screen.getByText('Fulano'));
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledWith(appt);
    });

    it('shows details button for done and calls onDetails', () => {
        const appt = makeAppt({ status: 'done' });
        const onDetails = vi.fn();
        render(<AppointmentCard appt={appt} onDetails={onDetails} />);
        const btn = screen.getByRole('button', { name: /Resumo da consulta/i });
        fireEvent.click(btn);
        expect(onDetails).toHaveBeenCalledTimes(1);
        expect(onDetails).toHaveBeenCalledWith(appt);
    });

    it('calls onUseTime on primary click when provided', () => {
        const appt = makeAppt({});
        const onUseTime = vi.fn();
        render(<AppointmentCard appt={appt} onUseTime={onUseTime} />);
        fireEvent.click(screen.getByText('Fulano'));
        expect(onUseTime).toHaveBeenCalledTimes(1);
        expect(onUseTime).toHaveBeenCalledWith(appt);
    });

    it('shows edit/cancel when futuro; oculta quando passado', () => {
        const future = makeAppt({
            start_at: new Date(Date.now() + 10 * 60_000).toISOString(),
            end_at: new Date(Date.now() + 20 * 60_000).toISOString(),
        });
        const past = makeAppt({
            start_at: new Date(Date.now() - 20 * 60_000).toISOString(),
            end_at: new Date(Date.now() - 10 * 60_000).toISOString(),
        });
        const onEdit = vi.fn();
        const onCancel = vi.fn();

        const { rerender } = render(
            <AppointmentCard
                appt={future}
                onEdit={onEdit}
                onCancel={onCancel}
            />,
        );
        // Edit button enabled
        const editBtn = screen.getByTitle(/Edit appointment/i);
        expect(editBtn).not.toHaveAttribute('disabled');
        fireEvent.click(editBtn);
        expect(onEdit).toHaveBeenCalledTimes(1);
        // Cancel asks for confirm; mock confirm = true
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const cancelBtn = screen.getByTitle(/Cancel appointment/i);
        fireEvent.click(cancelBtn);
        expect(onCancel).toHaveBeenCalledTimes(1);
        confirmSpy.mockRestore();

        // Rerender como passado -> botões deixam de existir (fluxo atual remove ações em vez de deixar disabled)
        rerender(
            <AppointmentCard appt={past} onEdit={onEdit} onCancel={onCancel} />,
        );
        expect(
            screen.queryByTitle(/Edit appointment/i),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTitle(/Cancel appointment/i),
        ).not.toBeInTheDocument();
    });
});
