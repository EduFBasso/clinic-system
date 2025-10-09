// Utilities extracted from AppModal for viewport compensation and bottom gap calculation.
// Pure functions + a small orchestrator to compute bottom compensation using visualViewport & safe-area.

export interface BottomCompMetrics {
    bottomComp: number;
    innerHeight: number;
    visualViewportHeight?: number;
    vhUnit: number; // px value of 1vh equivalent (dynamic)
}

/**
 * Reads CSS custom property --_fake_safe_area_bottom (if defined) to avoid subtracting safe area twice.
 */
export function readFakeSafeAreaBottom(): number {
    try {
        const raw = getComputedStyle(document.documentElement)
            .getPropertyValue('--_fake_safe_area_bottom')
            .replace(/px/, '')
            .trim();
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
    } catch {
        return 0;
    }
}

/**
 * Compute additional bottom compensation (space not painted by visualViewport when toolbars visible).
 * Mirrors prior logic: delta = window.innerHeight - visualViewport.height; if > 8, subtract safe area.
 */
export function computeBottomComp(): BottomCompMetrics {
    const vv = window.visualViewport;
    const innerHeight = window.innerHeight;
    const vhUnit = (vv?.height || innerHeight) / 100 || 0;
    if (!vv) {
        return {
            bottomComp: 0,
            innerHeight,
            visualViewportHeight: undefined,
            vhUnit,
        };
    }
    let delta = innerHeight - vv.height;
    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    const safe = readFakeSafeAreaBottom();
    const adj = delta > 8 ? Math.max(0, delta - safe) : 0;
    return {
        bottomComp: adj,
        innerHeight,
        visualViewportHeight: vv.height,
        vhUnit,
    };
}

/**
 * Update a CSS variable --appmodal-vh to reflect dynamic viewport height (visualViewport preferred).
 */
export function updateDynamicVhVar(
    target: HTMLElement | Document = document,
): number {
    try {
        const vhPx =
            (window.visualViewport?.height ?? window.innerHeight) * 0.01;
        (target as Document).documentElement?.style.setProperty(
            '--appmodal-vh',
            `${vhPx}px`,
        );
        return vhPx;
    } catch {
        return 0;
    }
}

/**
 * Set CSS var --appmodal-bottom-comp on a provided element (usually modal root) given metrics.
 */
export function applyBottomCompVar(el: HTMLElement, bottomComp: number) {
    try {
        if (!el) return;
        if (bottomComp) {
            el.style.setProperty('--appmodal-bottom-comp', `${bottomComp}px`);
        } else {
            el.style.removeProperty('--appmodal-bottom-comp');
        }
    } catch {
        /* noop */
    }
}
