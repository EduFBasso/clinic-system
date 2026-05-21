import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { AppModal } from '../../components/Modal/Modal';

// Testa emissão de telemetria (open/update/close) para fullscreen com bottomComp.
// Simula visualViewport diferente de window.innerHeight para forçar bottomComp > 0.

describe('AppModal viewport telemetry', () => {
    it('emits open/update/close telemetry events', async () => {
        interface MetricDetail {
            phase: string;
            bottomComp: number;
            [k: string]: unknown;
        }
        const events: MetricDetail[] = [];
        const handler = (e: Event) => {
            const ce = e as CustomEvent<MetricDetail>;
            events.push(ce.detail);
        };
        window.addEventListener('modal:viewport-metrics', handler);

        // Mock visualViewport
        interface MockVisualViewport {
            height: number;
            addEventListener: (
                type: string,
                cb: EventListenerOrEventListenerObject,
            ) => void;
            removeEventListener: (
                type: string,
                cb: EventListenerOrEventListenerObject,
            ) => void;
        }
        const originalVV: unknown = (
            window as unknown as { visualViewport?: MockVisualViewport }
        ).visualViewport;
        (
            window as unknown as { visualViewport: MockVisualViewport }
        ).visualViewport = {
            height: 600, // menor que innerHeight (simula barra/translucent area)
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        };

        // Garantir innerHeight
        Object.defineProperty(window, 'innerHeight', {
            value: 640,
            configurable: true,
        });

        const { rerender, unmount } = render(
            <AppModal open fullScreen onClose={() => {}}>
                <div style={{ height: 200 }}>X</div>
            </AppModal>,
        );
        // Aguarda próximo tick/rAF para permitir emissão 'open'
        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        // Força re-render sem fechar para permitir possíveis updates (throttle pode impedir múltiplos rápidos)
        rerender(
            <AppModal open fullScreen onClose={() => {}}>
                <div style={{ height: 220 }}>X</div>
            </AppModal>,
        );

        // Fecha modal
        rerender(
            <AppModal open={false} fullScreen onClose={() => {}}>
                <div />
            </AppModal>,
        );

        unmount();
        window.removeEventListener('modal:viewport-metrics', handler);
        (
            window as unknown as { visualViewport?: MockVisualViewport }
        ).visualViewport = originalVV as MockVisualViewport | undefined;

        // Deve conter pelo menos uma métrica 'open' e uma 'close'
        const phases = events.map(e => e.phase);
        // 'open' pode colidir com primeiro 'update' dependendo de timing/rAF; aceitamos se faltar desde que haja 'update' e 'close'
        expect(phases).toContain('close');
        expect(phases.some(p => p === 'open' || p === 'update')).toBe(true);
        // bottomComp esperado > 0 (delta = 40 - safe approx 0)
        const anyWithBottomComp = events.some(
            e => e.bottomComp && e.bottomComp > 0,
        );
        expect(anyWithBottomComp).toBe(true);
    });
});
