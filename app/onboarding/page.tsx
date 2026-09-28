'use client';

import { useRequireOnboardingPending } from '@/lib/auth/use-auth-guard';

import { OnboardingForm } from './_components/onboarding-form';

/**
 * The consent gate (design 2b). Sits outside the product shell on purpose — no
 * tab bar, nowhere to navigate until both boxes are ticked.
 */
export default function OnboardingPage() {
    const { loading } = useRequireOnboardingPending();
    if (loading) return null;

    return <OnboardingForm />;
}
