import { call } from '@/lib/utils/api-utils';

export interface CompleteOnboardingPayload {
    ageConfirmed: boolean;
    betaDisclaimerAccepted: boolean;
}

export interface OnboardingState {
    onboardingCompletedAt: string | null;
    ageConfirmed: boolean;
    betaDisclaimerAccepted: boolean;
}

const ENDPOINT = 'users/onboarding';
const REQUEST_TIMEOUT_MS = 10_000;

export const completeOnboarding = (payload: CompleteOnboardingPayload) =>
    call<OnboardingState>({
        endpoint: ENDPOINT,
        method: 'POST',
        payload,
        silent: true,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
