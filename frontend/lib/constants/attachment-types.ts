/**
 * What the pet2text capture sheet actually promises: a photo, or paperwork
 * from the clinic. The shared starter list in `upload-file-types.ts` also
 * admits spreadsheets, decks and A/V, which the sheet's own copy never offers;
 * it stays untouched because the admin FileDropZone still reads from it.
 *
 * The ceiling mirrors the server's ATTACHMENT_MAX_BYTES (50MB) and the type
 * list mirrors its ATTACHMENT_ALLOWED_TYPES. Keep both in step — a mismatch
 * here only moves the rejection later, after the upload starts.
 */
export const IMAGE_ATTACHMENT_EXTENSIONS: readonly string[] = [
    // .heic/.heif is what an iPhone camera saves by default; leaving it out
    // meant "Take a picture" silently rejected most phone photos.
    '.jpg',
    '.jpeg',
    '.png',
    '.heic',
    '.heif',
];

export const PDF_ATTACHMENT_EXTENSIONS: readonly string[] = ['.pdf'];

export const ATTACHMENT_ACCEPT_EXTENSIONS: readonly string[] = [
    ...IMAGE_ATTACHMENT_EXTENSIONS,
    ...PDF_ATTACHMENT_EXTENSIONS,
];

export const ATTACHMENT_ACCEPT_ATTR = ATTACHMENT_ACCEPT_EXTENSIONS.join(',');
export const IMAGE_ATTACHMENT_ACCEPT_ATTR = IMAGE_ATTACHMENT_EXTENSIONS.join(',');
export const PDF_ATTACHMENT_ACCEPT_ATTR = PDF_ATTACHMENT_EXTENSIONS.join(',');

export const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;

export const ATTACHMENT_MAX_LABEL = `${ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB`;

/** "Photos, PDF or a document — up to 50MB" */
export const ATTACHMENT_HINT = `Photos, PDF or a document — up to ${ATTACHMENT_MAX_LABEL}`;
