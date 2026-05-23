import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AppModal } from '../../components/Modal/Modal';

// Smoke test: ensures fullscreen modal sets body overflow hidden and data attribute present

describe('AppModal fullscreen lock + bottom overlay', () => {
    it('applies scroll lock and fullscreen data attribute', () => {
        // Pre-state: clear styles
        document.body.style.overflow = '';
        const { unmount } = render(
            <AppModal open fullScreen onClose={() => {}}>
                <div style={{ height: 200 }}>Content</div>
            </AppModal>,
        );
        const dialog = document.querySelector('[data-appmodal-fullscreen="1"]');
        expect(dialog).toBeTruthy();
        // Body overflow should be hidden (lock applied)
        expect(document.documentElement.style.overflow).toBe('hidden');
        expect(document.body.style.overflow).toBe('hidden');
        unmount();
    });
});
