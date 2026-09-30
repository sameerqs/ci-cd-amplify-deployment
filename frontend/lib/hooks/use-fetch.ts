'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiCallError } from '@/lib/utils/api-utils';

export type FetchState<T> =
    | { status: 'loading' }
    | { status: 'not-found' }
    | { status: 'error'; message: string }
    | { status: 'ready'; data: T };

interface Settled<T> {
    source: () => Promise<T>;
    result: FetchState<T>;
}

interface UseFetchOptions {
    /**
     * Keep showing the last result while a new `fetcher` (e.g. the next page
     * of a list) loads, instead of dropping back to `loading`. What an RSC
     * navigation used to give a list for free: the table stays mounted, with
     * its open dialogs and scroll position, until the new rows arrive.
     */
    keepPreviousData?: boolean;
}

interface UseFetchResult<T> {
    state: FetchState<T>;
    /** Re-run the current fetcher, keeping the data on screen until it lands. */
    refetch: () => void;
}

const LOADING = { status: 'loading' } as const;

/**
 * Client-side data fetching for a static export, where pages can no longer
 * `await` on the server. `fetcher` must be memoised (useCallback) — a new
 * identity means "fetch something else". Pass `null` to hold off, e.g. until
 * an auth guard has resolved, so no request goes out without a token.
 *
 * Only the latest request may settle: a slow response for an old filter or a
 * previous id never overwrites a newer one, and nothing is set after unmount.
 */
export function useFetch<T>(
    fetcher: (() => Promise<T>) | null,
    { keepPreviousData = false }: UseFetchOptions = {},
): UseFetchResult<T> {
    const [settled, setSettled] = useState<Settled<T> | null>(null);
    const latest = useRef(0);

    const run = useCallback(
        (isRefetch: boolean) => {
            if (!fetcher) return;
            latest.current += 1;
            const id = latest.current;
            fetcher().then(
                (data) => {
                    if (id === latest.current) {
                        setSettled({ source: fetcher, result: { status: 'ready', data } });
                    }
                },
                (error: unknown) => {
                    if (id !== latest.current) return;
                    if (error instanceof Error && error.name === 'AbortError') return;
                    // why: call() has already toasted the failure. A background
                    // refresh that fails should not tear down data that is still
                    // perfectly good to look at.
                    if (isRefetch) return;
                    setSettled({ source: fetcher, result: toFailure(error) });
                },
            );
        },
        [fetcher],
    );

    useEffect(() => {
        run(false);
        return () => {
            // Invalidate anything still in flight for the previous fetcher.
            latest.current += 1;
        };
    }, [run]);

    const refetch = useCallback(() => run(true), [run]);

    let state: FetchState<T> = LOADING;
    if (settled && (settled.source === fetcher || keepPreviousData)) {
        state = settled.result;
    }

    return { state, refetch };
}

function toFailure<T>(error: unknown): FetchState<T> {
    if (error instanceof ApiCallError && error.status === 404) return { status: 'not-found' };
    return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load.',
    };
}
