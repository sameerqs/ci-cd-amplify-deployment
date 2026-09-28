import { z } from 'zod';

import {
    optionalTrimmedString,
    requiredTrimmedString,
} from '@/lib/utils/zod-schema';

export const roadmapItemSchema = z.object({
    title: requiredTrimmedString(100, 'Title'),
    description: optionalTrimmedString(500, 'Description'),
    commentPrompt: optionalTrimmedString(200, 'Comment prompt'),
    isActive: z.boolean().default(true),
    /** UI-only — set by Save & Close. Stripped before the API call. */
    isSaveAndClose: z.preprocess(
        (v) => (v === undefined || v === null ? false : v),
        z.boolean(),
    ),
});

export type RoadmapItemFormInput = z.input<typeof roadmapItemSchema>;
export type RoadmapItemFormData = z.output<typeof roadmapItemSchema>;
