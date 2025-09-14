import { describe, it, expect } from 'vitest';
import {
    parseDOB,
    formatDOBToBR,
    normalizeDOBForApi,
    formatDOBWithAge,
    calcAge,
} from '../dateOfBirth';

// Congela "hoje" para testes de idade determinísticos
const FIXED_TODAY = new Date('2025-09-14T12:00:00Z');

describe('dateOfBirth util', () => {
    it('parseDOB aceita ISO válido', () => {
        const p = parseDOB('1990-12-05');
        expect(p).not.toBeNull();
        expect(p!.iso).toBe('1990-12-05');
        expect(p!.day).toBe(5);
        expect(p!.month).toBe(12);
        expect(p!.year).toBe(1990);
    });

    it('parseDOB aceita formato BR válido', () => {
        const p = parseDOB('05/12/1990');
        expect(p).not.toBeNull();
        expect(p!.iso).toBe('1990-12-05');
    });

    it('parseDOB rejeita formato inválido', () => {
        expect(parseDOB('1990/12/05')).toBeNull();
        expect(parseDOB('32/01/1990')).toBeNull();
        expect(parseDOB('1990-13-10')).toBeNull();
    });

    it('formatDOBToBR converte ISO para BR', () => {
        expect(formatDOBToBR('1990-12-05')).toBe('05/12/1990');
    });

    it('normalizeDOBForApi converte BR para ISO', () => {
        expect(normalizeDOBForApi('05/12/1990')).toBe('1990-12-05');
    });

    it('formatDOBWithAge inclui idade plausível', () => {
        const result = formatDOBWithAge('2000-09-14'); // mesmo mês/dia
        // idade depende da data atual real, então apenas assert formato parcial
        expect(result).toMatch(/^14\/09\/2000 \(\d+ anos\)$/);
    });

    it('calcAge retorna null para idade fora da faixa', () => {
        // ano futuro
        expect(calcAge(2100, 1, 1, FIXED_TODAY)).toBeNull();
        // muito antigo
        expect(calcAge(1800, 1, 1, FIXED_TODAY)).toBeNull();
    });
});
