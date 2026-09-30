/**
 * One renewal in flight at a time, however many callers notice the token
 * expired at once — the auth bootstrap, a background fetch's 401 retry, and a
 * download could all fire together. Each would otherwise spend the Cognito
 * refresh token again, which with rotation enabled means N-1 pointless
 * rotations and a real chance of racing the pool.
 */

const inFlight = new Map<string, Promise<unknown>>();

/** Run `attempt` under `key`, or join the attempt already running for it. */
export function coalesceRefresh<T>(key: string, attempt: () => Promise<T>): Promise<T> {
    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const run = attempt().finally(() => {
        inFlight.delete(key);
    });
    inFlight.set(key, run);
    return run;
}

/** Test seam — the map is module state and outlives a single test. */
export function resetRefreshCoordinator(): void {
    inFlight.clear();
}
