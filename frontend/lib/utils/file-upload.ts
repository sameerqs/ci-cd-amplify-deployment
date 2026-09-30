import { toast } from "@/lib/toast";

import {
    ATTACHMENT_ACCEPT_EXTENSIONS,
    ATTACHMENT_MAX_BYTES,
    IMAGE_ATTACHMENT_EXTENSIONS,
    PDF_ATTACHMENT_EXTENSIONS,
} from '@/lib/constants/attachment-types';
import {
    UPLOAD_ACCEPT_ATTR,
    UPLOAD_ACCEPT_EXTENSIONS,
    UPLOAD_MAX_SIZE_BYTES,
    extensionOf,
    formatUploadSize,
} from '@/lib/constants/upload-file-types';

export const UPLOAD_ACCEPT_LIST = UPLOAD_ACCEPT_EXTENSIONS;
export { UPLOAD_ACCEPT_ATTR, UPLOAD_MAX_SIZE_BYTES };

const ACCEPT_SET = new Set(UPLOAD_ACCEPT_EXTENSIONS);

export const uploadExtensionOf = extensionOf;

export function formatMaxUploadSize(
    bytes: number = UPLOAD_MAX_SIZE_BYTES,
): string {
    return formatUploadSize(bytes);
}

export function isValidUploadFile(file: File): boolean {
    if (!ACCEPT_SET.has(uploadExtensionOf(file.name))) {
        toast.error(`"${file.name}" — unsupported file type.`);
        return false;
    }
    if (file.size > UPLOAD_MAX_SIZE_BYTES) {
        toast.error(
            `"${file.name}" exceeds the ${formatMaxUploadSize()} limit.`,
        );
        return false;
    }
    return true;
}

const ATTACHMENT_SET = new Set(ATTACHMENT_ACCEPT_EXTENSIONS);
const IMAGE_ATTACHMENT_SET = new Set(IMAGE_ATTACHMENT_EXTENSIONS);
const PDF_ATTACHMENT_SET = new Set(PDF_ATTACHMENT_EXTENSIONS);

type AttachmentKind = 'image' | 'pdf' | 'camera';

/** The pet2text capture sheet's own check — narrower than the starter list. */
export function isValidAttachment(file: File): boolean {
    if (!ATTACHMENT_SET.has(uploadExtensionOf(file.name))) {
        toast.error(`"${file.name}" — we take photos and clinic documents.`);
        return false;
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
        toast.error(
            `"${file.name}" exceeds the ${formatUploadSize(ATTACHMENT_MAX_BYTES)} limit.`,
        );
        return false;
    }
    return true;
}

export function isValidAttachmentForKind(
    file: File,
    kind: AttachmentKind,
): boolean {
    const extension = uploadExtensionOf(file.name);
    const allowed = kind === 'pdf' ? PDF_ATTACHMENT_SET : IMAGE_ATTACHMENT_SET;
    if (!allowed.has(extension)) {
        toast.error(
            kind === 'pdf'
                ? 'Please choose a PDF file.'
                : 'Please choose a JPG, PNG, or HEIC photo.',
        );
        return false;
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
        toast.error(
            `"${file.name}" exceeds the ${formatUploadSize(ATTACHMENT_MAX_BYTES)} limit.`,
        );
        return false;
    }
    return true;
}
