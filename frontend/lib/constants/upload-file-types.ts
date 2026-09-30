// Single source of truth for which files the app accepts for upload and the
// size ceilings. Every upload surface (query source documents, translated/
// target documents, the generic FileDropZone) reads from here so the lists
// can't drift apart. Mirrors the server allow-list in
// server/src/common/utils/uploaded-file.util.ts — keep the two in sync.

export const UPLOAD_ACCEPT_EXTENSIONS: readonly string[] = [
    '.pdf',
    '.doc',
    '.docx',
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    // Audio / video for A/V transcription source files.
    '.mp3',
    '.wav',
    '.m4a',
    '.aac',
    '.ogg',
    '.mp4',
    '.mov',
    '.webm',
    '.avi',
];

export const UPLOAD_ACCEPT_ATTR = UPLOAD_ACCEPT_EXTENSIONS.join(',');

export const UPLOAD_MAX_SIZE_BYTES = 30 * 1024 * 1024;
export const UPLOAD_MAX_TOTAL_SIZE_BYTES = 1024 * 1024 * 1024;

// Bare extensions (no leading dot) grouped for file-type icon selection.
export const IMAGE_EXTENSIONS: readonly string[] = [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
];
export const AUDIO_EXTENSIONS: readonly string[] = [
    'mp3',
    'wav',
    'm4a',
    'aac',
    'ogg',
];
export const VIDEO_EXTENSIONS: readonly string[] = [
    'mp4',
    'mov',
    'webm',
    'avi',
];
export const SPREADSHEET_EXTENSIONS: readonly string[] = ['xls', 'xlsx', 'csv'];
export const PRESENTATION_EXTENSIONS: readonly string[] = ['ppt', 'pptx'];
export const ARCHIVE_EXTENSIONS: readonly string[] = ['zip', 'rar', '7z'];

/** Leading-dot, lowercase extension of a filename (".pdf"), or "" if none. */
export function extensionOf(name: string): string {
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

export function formatUploadSize(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${bytes}B`;
}
