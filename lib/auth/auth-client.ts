'use client';

/**
 * The access token, held in memory only.
 *
 * A static export has no server left to hold an HttpOnly access-token cookie
 * for the browser, so the token lives here instead — never in localStorage or
 * sessionStorage, where it would outlive the tab and be readable by any script
 * on the origin long after the session that minted it. The `sessionId`
 * refresh handle stays HttpOnly and is set directly by the API (see
 * fastapi/app/core/cookies.py) — this module never sees it, and a hard
 * refresh always re-derives the access token from it via `renewSession()`.
 */

let accessToken: string | null = null;
// why: bumped on every set/clear so an async caller can tell whether the
// session changed underneath it. A renewal that started before a sign-in must
// not overwrite (or clear) the token that sign-in just stored.
let generation = 0;

export function getAccessToken(): string | null {
    return accessToken;
}

export function getTokenGeneration(): number {
    return generation;
}

export function setAccessToken(token: string): void {
    accessToken = token;
    generation += 1;
}

export function clearAccessToken(): void {
    accessToken = null;
    generation += 1;
}
