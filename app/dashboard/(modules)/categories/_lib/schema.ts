import { z } from 'zod';

import {
    optionalTrimmedString,
    requiredTrimmedString,
} from '@/lib/utils/zod-schema';

export const categorySchema = z.object({
    name: requiredTrimmedString(50, 'Name'),
    description: optionalTrimmedString(255, 'Description'),
    isActive: z.boolean().default(true),
    /** UI-only — set by Save & Close. Stripped before the API call. */
    isSaveAndClose: z.preprocess(
        (v) => (v === undefined || v === null ? false : v),
        z.boolean(),
    ),
});

export type CategoryFormInput = z.input<typeof categorySchema>;
export type CategoryFormData = z.output<typeof categorySchema>;
