import { call } from '@/lib/utils/api-utils';
import { AUTH_ENDPOINTS } from '@/app/(auth)/auth-endpoints';

/**
 * Response shapes here describe the *unwrapped* `data` payload — `call()`
 * strips the `{ isSuccess, message, data, ... }` envelope before returning.
 *
 * Only the link request lives here. Verifying a link, renewing and signing out
 * all establish or end a session, which means letting the browser hold the
 * API's session cookie directly — see `lib/auth/session-api.ts`.
 */

export interface MagicLinkRequest {
    email: string;
}

/** Deliberately empty: the reply must not reveal whether the account exists. */
export type MagicLinkResponse = Record<string, never>;

export interface MagicLinkSession {
    accessToken: string;
    expiresIn: number;
    onboardingCompletedAt: string | null;
}

export const requestMagicLinkApi = (payload: MagicLinkRequest) =>
    call<MagicLinkResponse>({
        endpoint: AUTH_ENDPOINTS.MAGIC_LINK_REQUEST,
        method: 'POST',
        payload,
        token: null,
    });
