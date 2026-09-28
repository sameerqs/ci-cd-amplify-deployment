'use client';

import { useEffect, useState } from 'react';

import { call } from '@/lib/utils/api-utils';

/**
 * Auth-gated file access, without the `/download/[...key]` proxy route that
 * used to inject the bearer token server-side.
 *
 * Goes through `call()` so an expired access token is renewed and retried
 * like every other request, rather than failing a download outright. The
 * file is then handed to the browser as a same-origin blob URL.
 */

function fileEndpoint(storageKey: string, inline: boolean): string {
    const path = storageKey.split('/').map(encodeURIComponent).join('/');
    return `files/${path}${inline ? '?inline=true' : ''}`;
}

/** Download a file. Failures are already toasted by `call()`; never throws. */
export async function downloadFile(storageKey: string, filename: string): Promise<void> {
    let blob: Blob;
    try {
        blob = await call<Blob>({
            endpoint: fileEndpoint(storageKey, false),
            method: 'GET',
            responseType: 'blob',
        });
    } catch {
        return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // A tick later is plenty and still frees the memory promptly — revoking
    // synchronously can race the browser's own read of the blob on some engines.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * A blob URL for inline rendering — an `<Image>` src, or a "view full size"
 * link. `enabled: false` fetches nothing: only previewable files should pay
 * for a download just by being rendered. Revokes its own URL on unmount or
 * when `storageKey` changes.
 */
export function useFilePreviewUrl(storageKey: string, enabled: boolean): string | null {
    const [preview, setPreview] = useState<{ key: string; url: string } | null>(null);

    useEffect(() => {
        if (!enabled) return;
        let objectUrl: string | null = null;
        let cancelled = false;
        call<Blob>({
            endpoint: fileEndpoint(storageKey, true),
            method: 'GET',
            responseType: 'blob',
            silent: true,
        }).then(
            (blob) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setPreview({ key: storageKey, url: objectUrl });
            },
            () => {
                // A preview that fails to load just stays empty — the filename
                // and size still render, and a thumbnail is not worth a toast.
            },
        );
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [storageKey, enabled]);

    return enabled && preview?.key === storageKey ? preview.url : null;
}
