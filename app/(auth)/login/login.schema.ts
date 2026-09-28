import { z } from 'zod';

import { emailRegex } from '@/app/(auth)/regex-utils';

export const magicLinkSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, 'Email is required.')
        .regex(emailRegex, 'Enter a valid email address.'),
});

export type MagicLinkFormInput = z.input<typeof magicLinkSchema>;
export type MagicLinkFormData = z.output<typeof magicLinkSchema>;
