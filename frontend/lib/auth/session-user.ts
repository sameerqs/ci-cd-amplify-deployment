import { getAccessToken } from '@/lib/auth/auth-client';
import { appSettings } from '@/lib/app-settings';
import { formatPersonName } from '@/lib/utils/format-person-name';
import { isExpiredOrNearExpiry } from '@/lib/auth/token-expiry';

export interface SessionUser {
    id: string;
    email: string;
    isSuperAdmin: boolean;
    displayName: string;
    firstName?: string;
    lastName?: string;
    mustChangePassword?: boolean;
    /** Null until the consent gate is cleared; the stamp never moves after. */
    onboardingCompletedAt: string | null;
    hasCompletedOnboarding: boolean;
}

interface ProfilePayload {
    id?: string;
    email?: string;
    isSuperAdmin?: boolean;
    displayName?: string;
    firstName?: string | null;
    lastName?: string | null;
    mustChangePassword?: boolean;
    onboardingCompletedAt?: string | null;
}

const PROFILE_TIMEOUT_MS = 5000;

/**
 * Who the current in-memory access token belongs to.
 *
 * A Cognito access token carries only `sub` — no email, no name, no role —
 * so the identity always comes from the API, which is the authoritative
 * source anyway. This decides which screen to render, never whether a
 * request is authorised; the API checks that on every call.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
    const token = getAccessToken();
    if (!token || isExpiredOrNearExpiry(token, 0)) return null;

    return fetchProfile(token);
}

async function fetchProfile(token: string): Promise<SessionUser | null> {
    if (!appSettings.SERVER_URL) return null;

    // why: a timeout or a 502 used to read exactly like "signed out", and the
    // client guards act on that by sending the visitor to /login?expired=true,
    // where the sign-in screen revokes the refresh token behind the session.
    // One blip therefore ended a session that was never actually over. Only the
    // API's own 401/403 is allowed to mean that; anything else gets one retry.
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const outcome = await requestProfile(token);
        if (outcome.status === 'ok') return outcome.user;
        if (outcome.status === 'rejected') return null;
    }
    return null;
}

type ProfileOutcome =
    | { status: 'ok'; user: SessionUser | null }
    | { status: 'rejected' }
    | { status: 'unavailable' };

async function requestProfile(token: string): Promise<ProfileOutcome> {
    try {
        const res = await fetch(`${appSettings.API_BASE}/users/profile`, {
            headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
            credentials: 'include',
            cache: 'no-store',
            signal: AbortSignal.timeout(PROFILE_TIMEOUT_MS),
        });
        if (res.status === 401 || res.status === 403) return { status: 'rejected' };
        if (!res.ok) return { status: 'unavailable' };
        const body = (await res.json()) as { data?: ProfilePayload };
        return {
            status: 'ok',
            user: body?.data?.email ? toSessionUser(body.data) : null,
        };
    } catch {
        return { status: 'unavailable' };
    }
}

function toSessionUser(raw: ProfilePayload): SessionUser {
    const firstName = raw.firstName ?? undefined;
    const lastName = raw.lastName ?? undefined;
    const onboardingCompletedAt = raw.onboardingCompletedAt ?? null;
    return {
        id: raw.id ?? '',
        email: raw.email ?? '',
        isSuperAdmin: raw.isSuperAdmin === true,
        displayName: formatPersonName(
            firstName,
            lastName,
            raw.displayName ?? raw.email ?? '',
        ),
        firstName,
        lastName,
        mustChangePassword: raw.mustChangePassword,
        onboardingCompletedAt,
        hasCompletedOnboarding: onboardingCompletedAt !== null,
    };
}
