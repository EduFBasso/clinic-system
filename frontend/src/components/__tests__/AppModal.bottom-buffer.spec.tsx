import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AppModal from '../Modal';

// Simple test to ensure fullscreen AppModal renders bottom buffer with expected style referencing env safe-area + var compensation.

describe('AppModal fullscreen bottom buffer', () => {
    it('renders bottom buffer element with height including safe-area + comp', () => {
        const { getByTestId } = render(
            <AppModal open fullScreen onClose={() => {}}>
                <div style={{ height: 200 }}>Conteúdo</div>
            </AppModal>,
        );
        const buffer = getByTestId('appmodal-bottom-buffer');
        expect(buffer).toBeTruthy();
        const style = (buffer as HTMLElement).style.height;
        // Height should include env(safe-area-inset-bottom) token
        expect(style).toMatch(/env\(safe-area-inset-bottom/);
        // And include dynamic compensation variable name
        expect(style).toMatch(/--appmodal-bottom-comp/);
    });
});
