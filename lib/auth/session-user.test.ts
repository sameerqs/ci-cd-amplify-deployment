import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockToken: string | undefined;

vi.mock('@/lib/auth/auth-client', () => ({
    getAccessToken: () => mockToken ?? null,
}));

vi.mock('@/lib/app-settings', () => ({
    appSettings: { SERVER_URL: 'http://api.test', API_BASE: 'http://api.test/api/v1' },
}));

import { getSessionUser } from './session-user';

const FAR_FUTURE = Math.floor(Date.now() / 1000) + 3600;

beforeEach(() => {
    mockToken = undefined;
    vi.unstubAllGlobals();
});

describe('getSessionUser', () => {
    it('reads the super-admin flag from the API profile', async () => {
        mockToken = `header.${btoa(JSON.stringify({ exp: FAR_FUTURE }))}.signature`;
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: true,
                json: async () => ({
                    data: {
                        id: 'user-1',
                        email: 'admin@example.com',
                        isSuperAdmin: true,
                    },
                }),
            })),
        );

        await expect(getSessionUser()).resolves.toMatchObject({
            email: 'admin@example.com',
            isSuperAdmin: true,
        });
    });

    it('reads as signed out when the API rejects the token', async () => {
        mockToken = `header.${btoa(JSON.stringify({ exp: FAR_FUTURE }))}.signature`;
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })));
        await expect(getSessionUser()).resolves.toBeNull();
    });

    it('retries once when the API is momentarily unreachable', async () => {
        mockToken = `header.${btoa(JSON.stringify({ exp: FAR_FUTURE }))}.signature`;
        const fetchMock = vi
            .fn()
            .mockRejectedValueOnce(new Error('socket hang up'))
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    data: { id: 'user-1', email: 'owner@example.com', isSuperAdmin: false },
                }),
            });
        vi.stubGlobal('fetch', fetchMock);

        await expect(getSessionUser()).resolves.toMatchObject({
            email: 'owner@example.com',
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries a 5xx rather than reading it as signed out', async () => {
        mockToken = `header.${btoa(JSON.stringify({ exp: FAR_FUTURE }))}.signature`;
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 503 })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    data: { id: 'user-1', email: 'owner@example.com', isSuperAdmin: false },
                }),
            });
        vi.stubGlobal('fetch', fetchMock);

        await expect(getSessionUser()).resolves.toMatchObject({
            email: 'owner@example.com',
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry a rejected token — that answer is final', async () => {
        mockToken = `header.${btoa(JSON.stringify({ exp: FAR_FUTURE }))}.signature`;
        const fetchMock = vi.fn(async () => ({ ok: false, status: 401 }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(getSessionUser()).resolves.toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('reads as signed out only after the retry also fails', async () => {
        mockToken = `header.${btoa(JSON.stringify({ exp: FAR_FUTURE }))}.signature`;
        const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
        vi.stubGlobal('fetch', fetchMock);

        await expect(getSessionUser()).resolves.toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
