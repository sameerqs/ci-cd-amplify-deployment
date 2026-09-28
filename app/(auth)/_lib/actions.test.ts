import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequestMagicLink = vi.fn();
const mockCallSession = vi.fn();
const mockSetAccessToken = vi.fn();

vi.mock('@/app/(auth)/auth-api', () => ({
    requestMagicLinkApi: (...args: unknown[]) => mockRequestMagicLink(...args),
}));

vi.mock('@/lib/auth/session-api', () => ({
    callSessionEndpoint: (...args: unknown[]) => mockCallSession(...args),
}));

vi.mock('@/lib/auth/auth-client', () => ({
    setAccessToken: (...args: unknown[]) => mockSetAccessToken(...args),
}));

import { ApiCallError } from '@/lib/utils/api-utils';

import { requestMagicLinkAction, verifyMagicLinkAction } from './actions';

const SESSION = {
    accessToken: 'at',
    expiresIn: 900,
    onboardingCompletedAt: null,
};

describe('requestMagicLinkAction', () => {
    beforeEach(() => mockRequestMagicLink.mockReset());

    it('returns ok on the neutral empty payload', async () => {
        mockRequestMagicLink.mockResolvedValueOnce({ session: null });

        const result = await requestMagicLinkAction({ email: 'a@example.com' });

        expect(result).toEqual({ ok: true, data: { session: null } });
    });

    it('trims and lowercases nothing client-side but passes the trimmed email', async () => {
        mockRequestMagicLink.mockResolvedValueOnce({ session: null });

        await requestMagicLinkAction({ email: '  a@example.com  ' });

        expect(mockRequestMagicLink).toHaveBeenCalledWith({
            email: 'a@example.com',
        });
    });

    it('rejects a malformed email without calling the API', async () => {
        const result = await requestMagicLinkAction({ email: 'nope' });

        expect(result.ok).toBe(false);
        expect(mockRequestMagicLink).not.toHaveBeenCalled();
    });

    it('rejects an empty email without calling the API', async () => {
        const result = await requestMagicLinkAction({ email: '' });

        expect(result).toEqual({ ok: false, message: 'Email is required.' });
        expect(mockRequestMagicLink).not.toHaveBeenCalled();
    });

    it('returns the neutral payload whatever the address is', async () => {
        // why: the reply must not reveal whether an account exists, so there is
        // nothing here for the caller to branch on.
        mockRequestMagicLink.mockResolvedValueOnce({});

        const result = await requestMagicLinkAction({ email: 'demo@example.com' });

        expect(result).toEqual({ ok: true, data: {} });
    });

    it('surfaces a rate-limit message from the envelope', async () => {
        mockRequestMagicLink.mockRejectedValueOnce(
            new ApiCallError('Too many requests', null, 429),
        );

        const result = await requestMagicLinkAction({ email: 'a@example.com' });

        expect(result).toEqual({ ok: false, message: 'Too many requests' });
    });
});

describe('verifyMagicLinkAction', () => {
    beforeEach(() => {
        mockCallSession.mockReset();
        mockSetAccessToken.mockReset();
    });

    it('stores the access token in memory and returns the session', async () => {
        mockCallSession.mockResolvedValueOnce({ ok: true, data: SESSION });

        const result = await verifyMagicLinkAction('raw-token');

        expect(result).toEqual({ ok: true, data: SESSION });
        expect(mockCallSession).toHaveBeenCalledWith('auth/magic-link/verify', {
            token: 'raw-token',
        });
        // The refresh-handle cookie is the browser's own — only the access
        // token needs to be adopted client-side.
        expect(mockSetAccessToken).toHaveBeenCalledWith('at');
    });

    it('carries onboardingCompletedAt through so the caller can route', async () => {
        mockCallSession.mockResolvedValueOnce({
            ok: true,
            data: { ...SESSION, onboardingCompletedAt: '2026-09-17T00:00:00Z' },
        });

        const result = await verifyMagicLinkAction('raw-token');

        expect(result.ok && result.data.onboardingCompletedAt).toBe(
            '2026-09-17T00:00:00Z',
        );
    });

    it('refuses an empty token without calling the API', async () => {
        const result = await verifyMagicLinkAction('   ');

        expect(result).toEqual({
            ok: false,
            message: 'This sign-in link is missing its token.',
        });
        expect(mockCallSession).not.toHaveBeenCalled();
    });

    it('surfaces the rejection message and stores nothing', async () => {
        mockCallSession.mockResolvedValueOnce({
            ok: false,
            reason: 'rejected',
            message: 'Link expired.',
        });

        const result = await verifyMagicLinkAction('raw-token');

        expect(result).toEqual({ ok: false, message: 'Link expired.' });
        expect(mockSetAccessToken).not.toHaveBeenCalled();
    });
});
