import {
    requestMagicLinkApi,
    type MagicLinkResponse,
    type MagicLinkSession,
} from '@/app/(auth)/auth-api';
import { AUTH_ENDPOINTS } from '@/app/(auth)/auth-endpoints';
import { setAccessToken } from '@/lib/auth/auth-client';
import { callSessionEndpoint } from '@/lib/auth/session-api';
import {
    magicLinkSchema,
    type MagicLinkFormData,
} from '@/app/(auth)/login/login.schema';
import type { ActionResult } from '@/lib/action-result';
import { ApiCallError } from '@/lib/utils/api-utils';

export async function requestMagicLinkAction(
    raw: MagicLinkFormData,
): Promise<ActionResult<MagicLinkResponse>> {
    const parsed = magicLinkSchema.safeParse(raw);
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        return { ok: false, message: first?.message ?? 'Invalid input.' };
    }

    try {
        const data = await requestMagicLinkApi(parsed.data);
        return { ok: true, data };
    } catch (e) {
        if (e instanceof ApiCallError) {
            return { ok: false, message: e.message };
        }
        return {
            ok: false,
            message: e instanceof Error ? e.message : 'Unable to send the link.',
        };
    }
}

export async function verifyMagicLinkAction(
    token: string,
): Promise<ActionResult<MagicLinkSession>> {
    const trimmed = token.trim();
    if (!trimmed) {
        return { ok: false, message: 'This sign-in link is missing its token.' };
    }

    // why: this goes through the session endpoint helper rather than `call()`,
    // because the API's Set-Cookie must land in the browser's own jar
    // (credentials: 'include') rather than be attached as a bearer token.
    const outcome = await callSessionEndpoint(AUTH_ENDPOINTS.MAGIC_LINK_VERIFY, {
        token: trimmed,
    });
    if (!outcome.ok) {
        return { ok: false, message: outcome.message };
    }
    setAccessToken(outcome.data.accessToken);
    return { ok: true, data: outcome.data as MagicLinkSession };
}
