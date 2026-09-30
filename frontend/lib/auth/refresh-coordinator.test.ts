import { beforeEach, describe, expect, it, vi } from 'vitest';

import { coalesceRefresh, resetRefreshCoordinator } from './refresh-coordinator';

type RefreshOutcome = { ok: true; session: { accessToken: string } };

const session: RefreshOutcome = {
    ok: true,
    session: { accessToken: 'new-access' },
};

describe('coalesceRefresh', () => {
    beforeEach(() => resetRefreshCoordinator());

    it('runs one renewal for concurrent callers holding the same handle', async () => {
        let release: (value: RefreshOutcome) => void = () => {};
        const pending = new Promise<RefreshOutcome>((resolve) => {
            release = resolve;
        });
        const attempt = vi.fn().mockReturnValue(pending);

        const all = Promise.all([
            coalesceRefresh('parent', attempt),
            coalesceRefresh('parent', attempt),
            coalesceRefresh('parent', attempt),
        ]);
        release(session);
        const results = await all;

        // why: three renewals would spend the Cognito refresh token three
        // times, and with rotation on that races the pool for no reason.
        expect(attempt).toHaveBeenCalledTimes(1);
        expect(results).toEqual([session, session, session]);
    });

    it('does not make separate sessions wait on each other', async () => {
        const attempt = vi.fn().mockResolvedValue(session);

        await Promise.all([
            coalesceRefresh('handle-a', attempt),
            coalesceRefresh('handle-b', attempt),
        ]);

        expect(attempt).toHaveBeenCalledTimes(2);
    });

    it('starts a fresh attempt once the previous one settles', async () => {
        const attempt = vi.fn().mockResolvedValue(session);

        await coalesceRefresh('parent', attempt);
        await coalesceRefresh('parent', attempt);

        expect(attempt).toHaveBeenCalledTimes(2);
    });

    it('clears the in-flight entry when the attempt rejects', async () => {
        const boom = vi.fn().mockRejectedValue(new Error('network'));
        await expect(coalesceRefresh('parent', boom)).rejects.toThrow('network');

        const attempt = vi.fn().mockResolvedValue(session);
        await expect(coalesceRefresh('parent', attempt)).resolves.toEqual(session);
        expect(attempt).toHaveBeenCalledTimes(1);
    });
});
