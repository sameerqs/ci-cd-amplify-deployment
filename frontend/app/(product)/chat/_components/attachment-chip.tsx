import type { Attachment } from '../../_lib/types';
import { AttachmentPreview } from './attachment-preview';

export function humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * An attached file in the transcript (design 2k). Downloads go through the
 * same-origin proxy, which injects the session token the httpOnly cookie holds.
 */
export function AttachmentChip({ attachment }: { attachment: Attachment }) {
    return (
        <div className="max-w-[86%] self-end">
            <AttachmentPreview attachment={attachment} />
        </div>
    );
}
