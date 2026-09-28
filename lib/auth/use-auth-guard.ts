'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/app/context/auth-context';
import { AUTH_ROUTES, DASHBOARD_ROUTES, PRODUCT_ROUTES } from '@/lib/routes';

/**
 * Client-side replacements for the old RSC `require*` guards.
 *
 * These decide which screen to render, never whether a request is authorised
 * — that is the API's job, and every data call is checked there. `loading`
 * covers both "we don't know yet" and "we know, and we're navigating away" so
 * the caller can render a skeleton instead of a flash of content the guard is
 * about to redirect off of.
 */

interface GuardResult {
    loading: boolean;
}

/** Owner-surface guard: any signed-in customer may use the product screens. */
export function useRequireSession(): GuardResult {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user === null) router.replace(AUTH_ROUTES.LOGIN);
    }, [loading, user, router]);

    return { loading: loading || user === null };
}

/** Product-screen guard: signed in AND past the consent gate. */
export function useRequireOnboarded(): GuardResult {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (user === null) {
            router.replace(AUTH_ROUTES.LOGIN);
            return;
        }
        if (!user.hasCompletedOnboarding) router.replace(PRODUCT_ROUTES.ONBOARDING);
    }, [loading, user, router]);

    return { loading: loading || user === null || !user?.hasCompletedOnboarding };
}

/** The consent gate's own guard, the mirror of useRequireOnboarded. */
export function useRequireOnboardingPending(): GuardResult {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (user === null) {
            router.replace(AUTH_ROUTES.LOGIN);
            return;
        }
        if (user.hasCompletedOnboarding) router.replace(PRODUCT_ROUTES.CHAT);
    }, [loading, user, router]);

    return { loading: loading || user === null || Boolean(user?.hasCompletedOnboarding) };
}

/**
 * Owner-surface guard, the other direction: an Admin / Super Admin has no
 * account here and is bounced to the dashboard rather than shown it. A
 * signed-out visitor is left alone once we know that's what they are — the
 * shell still renders for them so the page underneath can send them to
 * /login.
 */
export function useRequireOwnerRole(): GuardResult {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user?.isSuperAdmin) router.replace(DASHBOARD_ROUTES.HOME);
    }, [loading, user, router]);

    return { loading };
}

export function useRequireSuperAdmin(): GuardResult {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (user === null) {
            router.replace(AUTH_ROUTES.LOGIN);
            return;
        }
        if (!user.isSuperAdmin) router.replace(DASHBOARD_ROUTES.UNAUTHORIZED);
    }, [loading, user, router]);

    return { loading: loading || user === null || !user?.isSuperAdmin };
}
