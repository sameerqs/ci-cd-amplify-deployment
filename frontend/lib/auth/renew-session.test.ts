import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/app-settings', () => ({
    appSettings: {
        SERVER_URL: 'http://api.test',
        API_BASE: 'http://api.test/api/v1',
    },
}));

const mockAuthClient = vi.hoisted(() => {
    const store = { token: null as string | null, generation: 0 };
    return {
        store,
        getAccessToken: () => store.token,
        getTokenGeneration: () => store.generation,
        setAccessToken: vi.fn((token: string) => {
            store.token = token;
            store.generation += 1;
        }),
        clearAccessToken: vi.fn(() => {
            store.token = null;
            store.generation += 1;
        }),
    };
});
vi.mock('@/lib/auth/auth-client', () => mockAuthClient);

import { resetRefreshCoordinator } from './refresh-coordinator';
import { needsRenewal, renewSession } from './renew-session';

/** A token whose `exp` is `secondsFromNow` away, signature irrelevant here. */
function token(secondsFromNow: number): string {
    const payload = { exp: Math.floor(Date.now() / 1000) + secondsFromNow };
    const encode = (value: object) =>
        Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'none' })}.${encode(payload)}.sig`;
}

function reply(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

beforeEach(() => {
    resetRefreshCoordinator();
    mockAuthClient.store.token = null;
    mockAuthClient.store.generation = 0;
    mockAuthClient.setAccessToken.mockClear();
    mockAuthClient.clearAccessToken.mockClear();
});

describe('needsRenewal', () => {
    it('leaves a token with life left in it alone', () => {
        expect(needsRenewal(token(600))).toBe(false);
    });

    it('renews before expiry rather than racing it', () => {
        expect(needsRenewal(token(30))).toBe(true);
    });

    it('treats an expired or unreadable token as needing renewal', () => {
        expect(needsRenewal(token(-1))).toBe(true);
        expect(needsRenewal('not-a-jwt')).toBe(true);
        expect(needsRenewal(undefined)).toBe(true);
    });
});

describe('renewSession', () => {
    it('returns the new token and adopts it in memory', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                reply(200, { data: { accessToken: 'fresh', expiresIn: 900 } }),
            ),
        );

        expect(await renewSession()).toEqual({
            action: 'renewed',
            accessToken: 'fresh',
        });
        expect(mockAuthClient.setAccessToken).toHaveBeenCalledWith('fresh');
    });

    it('ends the session and clears the token only when the API rejects it', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(401, {})));

        expect(await renewSession()).toEqual({ action: 'ended' });
        expect(mockAuthClient.clearAccessToken).toHaveBeenCalledOnce();
    });

    it('does not end a session because the API was unreachable', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

        expect(await renewSession()).toEqual({ action: 'unavailable' });
        expect(mockAuthClient.clearAccessToken).not.toHaveBeenCalled();
    });

    it('does not end a session because the API returned a 500', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(500, {})));

        expect(await renewSession()).toEqual({ action: 'unavailable' });
    });

    it('spends the refresh token once however many requests ask at once', async () => {
        // why: with rotation on, a second renewal retires the token the first
        // one just handed out. The concurrent callers must share one request.
        const fetchMock = vi.fn().mockImplementation(
            () =>
                new Promise<Response>((resolve) =>
                    setTimeout(
                        () => resolve(reply(200, { data: { accessToken: 'fresh', expiresIn: 900 } })),
                        5,
                    ),
                ),
        );
        vi.stubGlobal('fetch', fetchMock);

        const results = await Promise.all([renewSession(), renewSession(), renewSession()]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(results.every((r) => r.action === 'renewed')).toBe(true);
    });

    it('does not wipe a session that was opened while the renewal was in flight', async () => {
        // why: the magic-link screen bootstraps a (cookie-less, so rejected)
        // renewal in parallel with verifying the link. The verify can win.
        let answer: (value: Response) => void = () => {};
        vi.stubGlobal(
            'fetch',
            vi.fn(() => new Promise<Response>((resolve) => { answer = resolve; })),
        );

        const pending = renewSession();
        mockAuthClient.setAccessToken('signed-in-token');
        answer(reply(401, {}));

        expect(await pending).toEqual({ action: 'renewed', accessToken: 'signed-in-token' });
        expect(mockAuthClient.clearAccessToken).not.toHaveBeenCalled();
        expect(mockAuthClient.store.token).toBe('signed-in-token');
    });
});
