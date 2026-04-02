import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import StickyModalHeader from '../shared/StickyModalHeader';

// We simulate a ResizeObserver by mutating offsetHeight and dispatching a resize.
// Because JSDOM lacks real ResizeObserver, our hook falls back to window resize event.

describe('StickyModalHeader layout-change emission', () => {
    it('dispatches modal:layout-changed after height change (fallback path)', () => {
        // Ensure absence of native ResizeObserver triggers fallback; if present, stub minimal impl
        const g = globalThis as unknown as {
            ResizeObserver?: typeof ResizeObserver;
        };
        if (!g.ResizeObserver) {
            g.ResizeObserver = class {
                observe() {}
                disconnect() {}
            } as unknown as typeof ResizeObserver;
        }
        const spy = vi.fn();
        window.addEventListener('modal:layout-changed', spy as EventListener);
        const { container } = render(
            <StickyModalHeader title='Teste'>
                <div style={{ height: 20 }}>A</div>
            </StickyModalHeader>,
        );
        const root = container.firstElementChild as HTMLElement;
        // Simulate height change
        Object.defineProperty(root, 'offsetHeight', {
            value: 120,
            configurable: true,
        });
        // Trigger fallback listener path (window resize)
        window.dispatchEvent(new Event('resize'));
        // Allow microtasks
        expect(spy).toHaveBeenCalled();
    });
});
