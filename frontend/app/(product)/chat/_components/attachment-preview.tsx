'use client';

import { ExternalLink, FileText } from 'lucide-react';
import Image from 'next/image';

import { downloadFile, useFilePreviewUrl } from '@/lib/download-file';

import type { Attachment } from '../../_lib/types';
import { humanSize } from './attachment-chip';

export function AttachmentPreview({ attachment }: { attachment: Attachment }) {
    const isImage = attachment.contentType.startsWith('image/');
    const isPdf = attachment.contentType === 'application/pdf';
    const previewUrl = useFilePreviewUrl(attachment.storageKey, isImage || isPdf);

    if (isImage) {
        return (
            <a
                href={previewUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-[16px] border border-black/10"
                aria-disabled={!previewUrl}
            >
                {/* why: an aspect box rather than a fixed 280px height. The
                    fixed one letterboxed every portrait photo and, on a short
                    phone in landscape, pushed the filename off the screen. */}
                <div className="relative aspect-[4/3] max-h-[min(60svh,22rem)] w-full bg-black/5">
                    {previewUrl ? (
                        <Image
                            src={previewUrl}
                            alt={attachment.filename}
                            fill
                            unoptimized
                            sizes="(max-width: 640px) 86vw, 550px"
                            className="object-contain"
                        />
                    ) : null}
                </div>
                <span className="flex items-center justify-between gap-2 bg-black/5 px-3 py-2 text-[12px]">
                    <span className="truncate font-semibold">{attachment.filename}</span>
                    <span className="shrink-0 text-[var(--neutral-600)]">
                        {humanSize(attachment.sizeBytes)}
                    </span>
                </span>
            </a>
        );
    }

    if (isPdf) {
        return (
            <a
                href={previewUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!previewUrl}
                className="flex items-center gap-2.5 rounded-[14px] border border-[var(--neutral-200)] bg-card px-3 py-2.5 text-[13px] transition-colors hover:border-ring/50"
            >
                <FileText className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-semibold">{attachment.filename}</span>
                <span className="shrink-0 text-[12px] text-[var(--neutral-600)]">
                    {humanSize(attachment.sizeBytes)}
                </span>
                <ExternalLink className="size-4 shrink-0" aria-hidden />
            </a>
        );
    }

    return (
        <button
            type="button"
            onClick={() => void downloadFile(attachment.storageKey, attachment.filename)}
            className="flex w-full items-center gap-2.5 rounded-[14px] border border-[var(--neutral-200)] bg-card px-3 py-2.5 text-left text-[13px] transition-colors hover:border-ring/50"
        >
            <FileText className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-semibold">{attachment.filename}</span>
            <span className="shrink-0 text-[12px] text-[var(--neutral-600)]">
                {humanSize(attachment.sizeBytes)}
            </span>
        </button>
    );
}
