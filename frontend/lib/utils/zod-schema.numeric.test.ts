import { describe, expect, it } from 'vitest';

import {
    MAX_LINE_TOTAL,
    MAX_MONEY_VALUE,
    optionalLineTotalNumber,
    optionalNonNegativeNumber,
} from './zod-schema';

describe('optionalLineTotalNumber', () => {
    it('accepts the max line total', () => {
        expect(
            optionalLineTotalNumber.safeParse(MAX_LINE_TOTAL).success,
        ).toBe(true);
    });

    it('rejects values above the max line total', () => {
        const result = optionalLineTotalNumber.safeParse(MAX_LINE_TOTAL + 1);
        expect(result.success).toBe(false);
    });
});

describe('optionalNonNegativeNumber', () => {
    it('accepts catalog unit rates up to MAX_MONEY_VALUE', () => {
        expect(optionalNonNegativeNumber.safeParse(MAX_MONEY_VALUE).success).toBe(
            true,
        );
    });

    it('rejects values above MAX_MONEY_VALUE', () => {
        const result = optionalNonNegativeNumber.safeParse(MAX_MONEY_VALUE + 0.01);
        expect(result.success).toBe(false);
    });
});
