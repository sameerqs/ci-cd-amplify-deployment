import { describe, expect, it } from 'vitest';

import { GENDER_OPTIONS, Gender, enumSelectOptions } from './enum';

describe('enum helpers', () => {
    it('builds string-valued select options from numeric enums', () => {
        expect(GENDER_OPTIONS).toContainEqual({
            value: String(Gender.Male),
            label: 'Male',
        });
        expect(enumSelectOptions([Gender.Female], { [Gender.Female]: 'Female' })).toEqual([
            { value: '1', label: 'Female' },
        ]);
    });
});
