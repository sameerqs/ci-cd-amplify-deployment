import { AUTH_ENDPOINTS } from '@/app/(auth)/auth-endpoints';
import {
    clearAccessToken,
    getAccessToken,
    getTokenGeneration,
    setAccessToken,
} from '@/lib/auth/auth-client';
import { coalesceRefresh } from '@/lib/auth/refresh-coordinator';
import { callSessionEndpoint } from '@/lib/auth/session-api';
import { isExpiredOrNearExpiry } from '@/lib/auth/token-expiry';

// Renew slightly early rather than let a request race its own token's expiry.
const REFRESH_SKEW_SECONDS = 60;

// One browser tab, one session — no need to key coalesceRefresh per-handle.
const REFRESH_KEY = 'session';

export type Renewal =
    | { action: 'renewed'; accessToken: string }
    /** The API rejected the handle: this session is over. */
    | { action: 'ended' }
    /** The API could not be reached or erred. Explicitly not a sign-out. */
    | { action: 'unavailable' };

export function needsRenewal(token: string | undefined | null): boolean {
    return !token || isExpiredOrNearExpiry(token, REFRESH_SKEW_SECONDS);
}

/**
 * Spend the httpOnly `sessionId` cookie for a fresh access token.
 *
 * Coalesced: a single page load fans out several fetches at once, each
 * noticing the token expired, and with rotation on each spare renewal retires
 * the token the others are still holding.
 */
export function renewSession(): Promise<Renewal> {
    return coalesceRefresh<Renewal>(REFRESH_KEY, async () => {
        const startedAt = getTokenGeneration();
        const result = await callSessionEndpoint(AUTH_ENDPOINTS.REFRESH);

        // why: the magic-link screen bootstraps a renewal (no cookie yet, so it
        // will be rejected) in parallel with verifying the link. If the verify
        // lands first, applying this stale outcome would wipe the session it
        // just opened. Whatever happened meanwhile wins.
        if (getTokenGeneration() !== startedAt) {
            const current = getAccessToken();
            return current ? { action: 'renewed', accessToken: current } : { action: 'ended' };
        }

        if (result.ok) {
            setAccessToken(result.data.accessToken);
            return { action: 'renewed', accessToken: result.data.accessToken };
        }
        if (result.reason === 'rejected') {
            clearAccessToken();
            return { action: 'ended' };
        }
        return { action: 'unavailable' };
    });
}
