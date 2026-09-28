'use client';

import { clearAccessToken } from '@/lib/auth/auth-client';
import { revokeSession } from '@/lib/auth/session-api';
import { AUTH_ROUTES } from '@/lib/routes';

/**
 * End the session and land on /login as a full page load.
 *
 * The revoke is awaited before navigating. Firing it and navigating at once
 * let the page unload abort the request before the API cleared the cookie —
 * /login then bootstrapped, renewed from the still-valid cookie, found a user
 * and bounced straight back into the app: sign-out that did nothing.
 *
 * A full page load, not router.push, discards every piece of in-memory client
 * state (AuthContext, PetsContext, the access token) in one guaranteed step.
 */
export async function signOut(): Promise<void> {
    await revokeSession();
    clearAccessToken();
    window.location.assign(AUTH_ROUTES.LOGIN);
}
