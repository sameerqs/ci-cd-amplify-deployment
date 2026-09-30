import { appSettings } from '../app-settings';

export interface VersionInfo {
    apiVersion: string;
    apiMajor: string;
    environment: string;
    timestamp: string;
}

/**
 * The API's version banner. Non-critical: every failure returns null.
 *
 * why SERVER_URL and not DOMAIN_URL: DOMAIN_URL is this client's own address.
 * Using it made the root layout fetch the Next server from inside its own
 * render, which deadlocked every page until the request timed out.
 *
 * why a timeout: this is awaited in the root layout, so it is on the critical
 * path of every single render. An API that is down or slow must degrade to "no
 * version banner", never to a hung page.
 */
const TIMEOUT_MS = 2000;

export async function fetchApiVersion(): Promise<VersionInfo | null> {
    if (!appSettings.SERVER_URL) return null;

    try {
        const response = await fetch(`${appSettings.SERVER_URL}/api/version`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!response.ok) return null;
        return (await response.json()) as VersionInfo;
    } catch {
        return null;
    }
}
