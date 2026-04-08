import '@testing-library/jest-dom/vitest';
// Polyfills for jsdom environment used by components
// scrollTo is not implemented in jsdom, provide a no-op
Object.defineProperty(window, 'scrollTo', {
    value: () => {},
    writable: true,
});

// scrollIntoView no-op to avoid errors when components call it
if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView(): void {
        // no-op in tests
    } as unknown as typeof Element.prototype.scrollIntoView;
}

// IntersectionObserver basic mock for components relying on it
if (
    typeof (globalThis as unknown as { IntersectionObserver?: unknown })
        .IntersectionObserver === 'undefined'
) {
    class MockIntersectionObserver {
        constructor() {
            // swallow
        }
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
        takeRecords(): unknown[] {
            return [];
        }
    }
    (
        globalThis as unknown as { IntersectionObserver: unknown }
    ).IntersectionObserver = MockIntersectionObserver as unknown;
}

// Minimal ResizeObserver stub for jsdom
if (
    typeof (globalThis as unknown as { ResizeObserver?: unknown })
        .ResizeObserver === 'undefined'
) {
    class MockResizeObserver {
        constructor() {}
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
        MockResizeObserver as unknown;
}

// window.matchMedia stub for jsdom (used by WeeklyAgendaModal and others)
if (typeof window !== 'undefined' && !window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }),
    });
}
