'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { verifyMagicLinkAction } from '@/app/(auth)/_lib/actions';
import { useAuth } from '@/app/context/auth-context';
import { postAuthRedirect } from '@/lib/auth-redirect';
import { PRODUCT_ROUTES } from '@/lib/routes';

type VerifyState = 'verifying' | 'failed';

interface UseVerifyMagicLinkResult {
    state: VerifyState;
    message: string;
}

/**
 * Exchanges the ?token= in a sign-in link for a session, then lands the
 * signer-in on their home screen: customers go to the consent gate or chat,
 * while the single Super Admin goes straight to the dashboard.
 */
export function useVerifyMagicLink(): UseVerifyMagicLinkResult {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { adoptSession } = useAuth();
    const [state, setState] = useState<VerifyState>('verifying');
    const [message, setMessage] = useState('');
    // why: a link is single-use, so React's double-invoked effect in dev would
    // burn the token on the first call and fail on the second.
    const started = useRef(false);

    const token = searchParams.get('token') ?? '';

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        void (async () => {
            const result = await verifyMagicLinkAction(token);
            if (!result.ok) {
                setMessage(result.message);
                setState('failed');
                return;
            }
            const user = await adoptSession();
            const destination =
                !user?.isSuperAdmin && !result.data.onboardingCompletedAt
                    ? PRODUCT_ROUTES.ONBOARDING
                    : postAuthRedirect(user ?? {});
            router.replace(destination);
        })();
    }, [adoptSession, router, token]);

    return { state, message };
}
