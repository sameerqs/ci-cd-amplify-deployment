import type { ActionResult } from '@/lib/action-result';
import { ApiCallError } from '@/lib/utils/api-utils';

import { completeOnboarding, type OnboardingState } from './api';
import { onboardingSchema, type OnboardingFormData } from './schema';

export async function completeOnboardingAction(
    raw: OnboardingFormData,
): Promise<ActionResult<OnboardingState>> {
    const parsed = onboardingSchema.safeParse(raw);
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        return { ok: false, message: first?.message ?? 'Invalid input.' };
    }

    try {
        const data = await completeOnboarding(parsed.data);
        // why: the consent stamp lives on the profile every guard keys off. The
        // caller (use-onboarding-form.ts) calls adoptSession() right after this
        // resolves, which re-fetches that profile into AuthContext — without it
        // the destination's guard would still see an unonboarded user and bounce
        // straight back to /onboarding even though the API call succeeded.
        return { ok: true, data };
    } catch (e) {
        if (e instanceof ApiCallError) {
            return { ok: false, message: e.message };
        }
        return {
            ok: false,
            message: e instanceof Error ? e.message : 'Unable to save your answers.',
        };
    }
}
