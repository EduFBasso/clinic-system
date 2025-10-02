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

    it('clicking a done card calls onDetails (details icon removed)', () => {
        const appt = makeAppt({ status: 'done' });
        const onDetails = vi.fn();
        render(<AppointmentCard appt={appt} onDetails={onDetails} />);
        // Clicking on the client name (card area)
        fireEvent.click(screen.getByText('Fulano'));
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

    it('shows edit/cancel for future; removed or disabled when past', () => {
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

        // Rerender as past. Two acceptable behaviors depending on deployed version:
        // 1. Legacy: buttons still render but with disabled attribute
        // 2. New (cleanup): buttons are not rendered at all
        rerender(
            <AppointmentCard appt={past} onEdit={onEdit} onCancel={onCancel} />,
        );
        const pastEdit = screen.queryByTitle(/Edit appointment/i);
        const pastCancel = screen.queryByTitle(/Cancel appointment/i);
        if (pastEdit) {
            expect(pastEdit).toHaveAttribute('disabled');
        } else {
            expect(pastEdit).not.toBeInTheDocument();
        }
        if (pastCancel) {
            expect(pastCancel).toHaveAttribute('disabled');
        } else {
            expect(pastCancel).not.toBeInTheDocument();
        }
    });

    it('pending (past scheduled) prioritizes onResolvePending over other handlers', () => {
        const past = makeAppt({
            start_at: new Date(Date.now() - 20 * 60_000).toISOString(),
            end_at: new Date(Date.now() - 10 * 60_000).toISOString(),
        });
        const onResolvePending = vi.fn();
        const onEdit = vi.fn();
        const onUseTime = vi.fn();
        const onClick = vi.fn();
        render(
            <AppointmentCard
                appt={past}
                onResolvePending={onResolvePending}
                onEdit={onEdit}
                onUseTime={onUseTime}
                onClick={onClick}
                now={new Date()}
            />,
        );
        fireEvent.click(screen.getByText('Fulano'));
        expect(onResolvePending).toHaveBeenCalledTimes(1);
        expect(onEdit).not.toHaveBeenCalled();
        expect(onUseTime).not.toHaveBeenCalled();
        expect(onClick).not.toHaveBeenCalled();
    });

    it('pending without onResolvePending falls back to onEdit if provided', () => {
        const past = makeAppt({
            start_at: new Date(Date.now() - 20 * 60_000).toISOString(),
            end_at: new Date(Date.now() - 10 * 60_000).toISOString(),
        });
        const onEdit = vi.fn();
        render(
            <AppointmentCard appt={past} onEdit={onEdit} now={new Date()} />,
        );
        fireEvent.click(screen.getByText('Fulano'));
        expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('ongoing blocks all interactions (no handlers called)', () => {
        const s = new Date(Date.now() - 60_000).toISOString();
        const e = new Date(Date.now() + 60_000).toISOString();
        const appt = makeAppt({ start_at: s, end_at: e });
        const onResolvePending = vi.fn();
        const onEdit = vi.fn();
        const onUseTime = vi.fn();
        const onClick = vi.fn();
        render(
            <AppointmentCard
                appt={appt}
                onResolvePending={onResolvePending}
                onEdit={onEdit}
                onUseTime={onUseTime}
                onClick={onClick}
                now={new Date()}
            />,
        );
        fireEvent.click(screen.getByText('Fulano'));
        expect(onResolvePending).not.toHaveBeenCalled();
        expect(onEdit).not.toHaveBeenCalled();
        expect(onUseTime).not.toHaveBeenCalled();
        expect(onClick).not.toHaveBeenCalled();
    });

    it('scheduled: prioritizes onEdit over onUseTime and onClick', () => {
        const appt = makeAppt({
            start_at: new Date(Date.now() + 10 * 60_000).toISOString(),
            end_at: new Date(Date.now() + 20 * 60_000).toISOString(),
        });
        const onEdit = vi.fn();
        const onUseTime = vi.fn();
        const onClick = vi.fn();
        render(
            <AppointmentCard
                appt={appt}
                onEdit={onEdit}
                onUseTime={onUseTime}
                onClick={onClick}
                now={new Date()}
            />,
        );
        fireEvent.click(screen.getByText('Fulano'));
        expect(onEdit).toHaveBeenCalledTimes(1);
        expect(onUseTime).not.toHaveBeenCalled();
        expect(onClick).not.toHaveBeenCalled();
    });

    it('scheduled: prioritizes onUseTime over onClick when onEdit is absent', () => {
        const appt = makeAppt({
            start_at: new Date(Date.now() + 10 * 60_000).toISOString(),
            end_at: new Date(Date.now() + 20 * 60_000).toISOString(),
        });
        const onUseTime = vi.fn();
        const onClick = vi.fn();
        render(
            <AppointmentCard
                appt={appt}
                onUseTime={onUseTime}
                onClick={onClick}
                now={new Date()}
            />,
        );
        fireEvent.click(screen.getByText('Fulano'));
        expect(onUseTime).toHaveBeenCalledTimes(1);
        expect(onClick).not.toHaveBeenCalled();
    });

    it('done: prioritizes onDetails over onEdit and others', () => {
        const appt = makeAppt({ status: 'done' });
        const onDetails = vi.fn();
        const onEdit = vi.fn();
        const onUseTime = vi.fn();
        const onClick = vi.fn();
        render(
            <AppointmentCard
                appt={appt}
                onDetails={onDetails}
                onEdit={onEdit}
                onUseTime={onUseTime}
                onClick={onClick}
            />,
        );
        fireEvent.click(screen.getByText('Fulano'));
        expect(onDetails).toHaveBeenCalledTimes(1);
        expect(onEdit).not.toHaveBeenCalled();
        expect(onUseTime).not.toHaveBeenCalled();
        expect(onClick).not.toHaveBeenCalled();
    });
});
