import { z } from 'zod';

import { zodEmailSchema } from '@/lib/utils/zod-schema';

export const inviteUserSchema = z.object({
    email: zodEmailSchema,
    /** UI-only — set by Save & Close. Stripped before the API call. */
    isSaveAndClose: z.boolean().default(false),
});

export const updateUserSchema = z.object({
    isActive: z.boolean().default(true),
    isSaveAndClose: z.preprocess(
        (v) => (v === undefined || v === null ? false : v),
        z.boolean(),
    ),
});

export type InviteUserFormInput = z.input<typeof inviteUserSchema>;
export type InviteUserFormData = z.output<typeof inviteUserSchema>;
export type UpdateUserFormInput = z.input<typeof updateUserSchema>;
export type UpdateUserFormData = z.output<typeof updateUserSchema>;
