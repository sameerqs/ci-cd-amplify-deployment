import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockSettings } = vi.hoisted(() => ({
    mockSettings: { SERVER_URL: 'http://localhost:8000', DOMAIN_URL: 'http://localhost:3000' },
}));

vi.mock('@/lib/app-settings', () => ({ appSettings: mockSettings }));
vi.mock('../app-settings', () => ({ appSettings: mockSettings }));

import { fetchApiVersion } from './version-service';

const VERSION = {
    apiVersion: '1.0.0',
    apiMajor: '1',
    environment: 'development',
    timestamp: '2026-09-17T00:00:00Z',
};

describe('fetchApiVersion', () => {
    afterEach(() => {
        mockSettings.SERVER_URL = 'http://localhost:8000';
        vi.unstubAllGlobals();
    });

    it('asks the API host, never this client', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => VERSION });
        vi.stubGlobal('fetch', fetchMock);

        await fetchApiVersion();

        const [url] = fetchMock.mock.calls[0];
        // why: fetching DOMAIN_URL made the server fetch itself mid-render and
        // deadlock every page until the request timed out.
        expect(url).toBe('http://localhost:8000/api/version');
        expect(url).not.toContain('3000');
    });

    it('passes an abort signal so a slow API cannot hang the render', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => VERSION });
        vi.stubGlobal('fetch', fetchMock);

        await fetchApiVersion();

        expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
    });

    it('returns null without fetching when no API host is configured', async () => {
        mockSettings.SERVER_URL = '';
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        expect(await fetchApiVersion()).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('degrades to null when the API errors', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        expect(await fetchApiVersion()).toBeNull();
    });

    it('degrades to null when the request throws or times out', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
        expect(await fetchApiVersion()).toBeNull();
    });
});
