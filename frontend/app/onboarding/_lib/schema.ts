import { z } from 'zod';

/**
 * Both boxes are hard gates — the backend stamps `onboarding_completed_at` only
 * when each is true. Modelled as a refined boolean rather than z.literal(true)
 * so the form can start unticked and still type-check.
 */
export const onboardingSchema = z.object({
    ageConfirmed: z
        .boolean()
        .refine((v) => v, { message: 'Please confirm you are 18 or older.' }),
    betaDisclaimerAccepted: z.boolean().refine((v) => v, {
        message:
            'Please confirm you understand this is documentation, not care.',
    }),
});

export type OnboardingFormInput = z.input<typeof onboardingSchema>;
export type OnboardingFormData = z.output<typeof onboardingSchema>;
