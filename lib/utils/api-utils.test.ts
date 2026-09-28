import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockSettings } = vi.hoisted(() => ({
    mockSettings: {
        SERVER_URL: 'http://localhost:8000',
        API_BASE: 'http://localhost:8000/api/v1',
        API_VERSION: 'v1',
    },
}));

vi.mock('@/lib/app-settings', () => ({ appSettings: mockSettings }));

const { mockAuthClient } = vi.hoisted(() => ({
    mockAuthClient: {
        getAccessToken: vi.fn<() => string | null>(() => null),
        clearAccessToken: vi.fn(),
    },
}));
vi.mock('@/lib/auth/auth-client', () => mockAuthClient);

const { mockRenewSession } = vi.hoisted(() => ({
    mockRenewSession: vi.fn(),
}));
vi.mock('@/lib/auth/renew-session', () => ({ renewSession: mockRenewSession }));

import { call } from './api-utils';

describe('call()', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        mockAuthClient.getAccessToken.mockReset().mockReturnValue(null);
        mockAuthClient.clearAccessToken.mockReset();
        mockRenewSession.mockReset();
    });

    it('attaches the in-memory access token as a bearer header', async () => {
        mockAuthClient.getAccessToken.mockReturnValue('token-123');
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ isSuccess: true, message: '', data: { id: '1' } }),
        });
        vi.stubGlobal('fetch', fetchMock);

        await call({ endpoint: 'users/profile', method: 'GET' });

        expect(fetchMock).toHaveBeenCalledWith(
            'http://localhost:8000/api/v1/users/profile',
            expect.objectContaining({
                credentials: 'include',
                headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
            }),
        );
    });

    it('renews the session once on a 401 and retries with the fresh token', async () => {
        mockAuthClient.getAccessToken.mockReturnValue('stale-token');
        mockRenewSession.mockResolvedValue({ action: 'renewed', accessToken: 'fresh-token' });

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ isSuccess: true, message: '', data: { id: '1' } }),
            });
        vi.stubGlobal('fetch', fetchMock);

        const data = await call({ endpoint: 'users/profile', method: 'GET' });

        expect(mockRenewSession).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenLastCalledWith(
            'http://localhost:8000/api/v1/users/profile',
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }),
            }),
        );
        expect(data).toEqual({ id: '1' });
    });

    it('clears the token and redirects when the session cannot be renewed', async () => {
        mockAuthClient.getAccessToken.mockReturnValue('dead-token');
        mockRenewSession.mockResolvedValue({ action: 'ended' });
        const replace = vi.fn();
        vi.stubGlobal('window', { location: { replace } });

        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ isSuccess: false, message: 'Unauthorized' }),
        });
        vi.stubGlobal('fetch', fetchMock);

        // Never resolves — the redirect path returns a promise that hangs on
        // purpose (see api-utils.ts) once the browser is being navigated away.
        void call({ endpoint: 'users/profile', method: 'GET' });
        await vi.waitFor(() => expect(replace).toHaveBeenCalledOnce());

        expect(mockAuthClient.clearAccessToken).toHaveBeenCalledOnce();
    });
});
