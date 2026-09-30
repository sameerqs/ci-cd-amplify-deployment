'use client';

import { useEffect, useRef } from 'react';

import { useAuth } from '@/app/context/auth-context';

/**
 * Ends the session behind an expired sign-in screen, exactly once.
 *
 * Reaching /login with `?expired=true` is `call()` saying the API rejected the
 * session after a renewal had already been tried, so the cookies left in the
 * browser are worth nothing and the row behind them should be revoked. Every
 * other way onto this screen leaves the session alone — the middleware renews a
 * merely-expired access token, and signing someone out for that would undo the
 * whole point of it.
 */
export function useAuthGuard(expired: boolean): void {
    const { logout } = useAuth();
    const endedSession = useRef(false);

    useEffect(() => {
        if (!expired || endedSession.current) return;
        endedSession.current = true;
        void logout();
    }, [expired, logout]);
}
