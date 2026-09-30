import { AUTH_ENDPOINTS } from '@/app/(auth)/auth-endpoints';
import { appSettings } from '@/lib/app-settings';

/**
 * The API's session endpoints, called directly from the browser.
 *
 * `credentials: 'include'` is what carries the HttpOnly `sessionId` cookie to
 * the API's origin and lets the API's own Set-Cookie land back in the
 * browser's own jar — there is no cookie to relay by hand the way the old
 * server-to-server version of this module had to.
 */

const TIMEOUT_MS = 5000;

export interface SessionPayload {
    accessToken: string;
    expiresIn: number;
    onboardingCompletedAt?: string | null;
}

/** `rejected` means the session is genuinely over; `unavailable` means try later. */
export type SessionFailure = 'rejected' | 'unavailable';

export type SessionOutcome =
    | { ok: true; data: SessionPayload }
    | { ok: false; reason: SessionFailure; message: string };

interface Envelope {
    message?: string;
    data?: SessionPayload;
    errors?: { message?: string }[];
}

export async function callSessionEndpoint(
    endpoint: string,
    body?: unknown,
): Promise<SessionOutcome> {
    if (!appSettings.SERVER_URL) {
        return {
            ok: false,
            reason: 'unavailable',
            message: 'NEXT_PUBLIC_SERVER_URL is not set.',
        };
    }

    try {
        const res = await fetch(`${appSettings.API_BASE}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: body === undefined ? undefined : JSON.stringify(body),
            cache: 'no-store',
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.status === 401 || res.status === 403) {
            return { ok: false, reason: 'rejected', message: await errorOf(res) };
        }
        if (!res.ok) {
            return { ok: false, reason: 'unavailable', message: await errorOf(res) };
        }
        const envelope = (await res.json()) as Envelope;
        const data = envelope?.data;
        if (!data?.accessToken) {
            return {
                ok: false,
                reason: 'unavailable',
                message: envelope?.message ?? 'Malformed response from server.',
            };
        }
        return { ok: true, data };
    } catch {
        return {
            ok: false,
            reason: 'unavailable',
            message: 'Could not reach the server — please try again.',
        };
    }
}

/**
 * Revoke the session behind the `sessionId` cookie and have the API clear it.
 *
 * Best effort and never throws: an unreachable API must not keep the browser
 * signed in, so callers clear their own state regardless. `keepalive` lets the
 * request finish even if the caller navigates away the moment this resolves.
 */
export async function revokeSession(): Promise<void> {
    if (!appSettings.SERVER_URL) return;
    try {
        await fetch(`${appSettings.API_BASE}/${AUTH_ENDPOINTS.LOGOUT}`, {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
            keepalive: true,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch {
        // swallowed on purpose — see above.
    }
}

async function errorOf(res: Response): Promise<string> {
    try {
        const envelope = (await res.json()) as Envelope;
        return envelope?.errors?.[0]?.message ?? envelope?.message ?? 'Request failed.';
    } catch {
        return 'Request failed.';
    }
}
