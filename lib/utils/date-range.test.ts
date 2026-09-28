import { describe, expect, it } from 'vitest';

import {
    dateRangeForPreset,
    detectPreset,
    presetSelectionState,
    resolveActivePreset,
} from './date-range';

describe('presetSelectionState', () => {
    it('seeds custom from the current this-month range when no dates are set', () => {
        const result = presetSelectionState('custom', {});
        const fallback = dateRangeForPreset('this_month');

        expect(result.preset).toBe('custom');
        expect(result.from).toBe(fallback.from ?? null);
        expect(result.to).toBe(fallback.to ?? null);
    });

    it('preserves the existing dates when entering custom mode', () => {
        const lastQuarter = dateRangeForPreset('last_quarter');
        const result = presetSelectionState('custom', {
            from: lastQuarter.from,
            to: lastQuarter.to,
        });

        expect(result.preset).toBe('custom');
        expect(result.from).toBe(lastQuarter.from);
        expect(result.to).toBe(lastQuarter.to);
    });

    it('keeps custom mode when only one bound is set', () => {
        const result = presetSelectionState('custom', {
            from: '2026-01-01T00:00:00.000Z',
            to: null,
        });

        expect(result.preset).toBe('custom');
        expect(result.from).toBe('2026-01-01T00:00:00.000Z');
        expect(result.to).toBeNull();
    });

    it('clears the preset param and writes the range for a named preset', () => {
        const result = presetSelectionState('last_quarter', {
            from: '2020-01-01T00:00:00.000Z',
            to: '2020-12-31T23:59:59.999Z',
        });
        const expected = dateRangeForPreset('last_quarter');

        expect(result.preset).toBeNull();
        expect(result.from).toBe(expected.from ?? null);
        expect(result.to).toBe(expected.to ?? null);
    });
});

describe('resolveActivePreset', () => {
    it('honours an explicit custom choice regardless of the dates', () => {
        const lastQuarter = dateRangeForPreset('last_quarter');
        expect(
            resolveActivePreset('custom', lastQuarter.from, lastQuarter.to),
        ).toBe('custom');
    });

    it('falls back to detection for legacy URLs without a preset param', () => {
        const lastQuarter = dateRangeForPreset('last_quarter');
        expect(
            resolveActivePreset(null, lastQuarter.from, lastQuarter.to),
        ).toBe('last_quarter');
    });

    it('defaults to this_month when nothing is selected', () => {
        expect(resolveActivePreset(null, undefined, undefined)).toBe(
            'this_month',
        );
    });
});

describe('detectPreset round-trips', () => {
    // Some presets are genuinely ambiguous on certain days (e.g. in the first
    // month of a quarter, this_month ≡ this_quarter; in January, ytd too), so
    // the round-trip contract is on the RANGE, not the key: whatever preset is
    // detected must reproduce the same instants.
    it.each([
        'this_week',
        'last_week',
        'this_month',
        'last_month',
        'this_quarter',
        'last_quarter',
        'ytd',
    ] as const)('detects %s from its own range', (key) => {
        const range = dateRangeForPreset(key);
        const detected = detectPreset(range.from, range.to);
        expect(detected).not.toBe('custom');
        expect(dateRangeForPreset(detected)).toEqual(range);
    });

    it('returns custom for a range that matches no preset', () => {
        expect(
            detectPreset(
                '2021-03-14T00:00:00.000Z',
                '2021-07-22T23:59:59.999Z',
            ),
        ).toBe('custom');
    });
});
