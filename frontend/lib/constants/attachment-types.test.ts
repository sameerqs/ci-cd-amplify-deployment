import { describe, expect, it } from 'vitest';

import {
    ATTACHMENT_ACCEPT_EXTENSIONS,
    ATTACHMENT_HINT,
    ATTACHMENT_MAX_BYTES,
} from './attachment-types';

describe('attachment types', () => {
    it('accepts the formats a phone camera and a clinic actually produce', () => {
        expect(ATTACHMENT_ACCEPT_EXTENSIONS).toContain('.heic');
        expect(ATTACHMENT_ACCEPT_EXTENSIONS).toContain('.jpg');
        expect(ATTACHMENT_ACCEPT_EXTENSIONS).toContain('.pdf');
    });

    it('does not offer what the sheet never promises', () => {
        for (const ext of ['.xlsx', '.pptx', '.mp3', '.mp4', '.avi']) {
            expect(ATTACHMENT_ACCEPT_EXTENSIONS).not.toContain(ext);
        }
    });

    it('matches the server ceiling so a file is not rejected after upload', () => {
        // why: the API enforces ATTACHMENT_MAX_BYTES = 50MB. A larger client
        // limit only moves the rejection later, after the bytes are sent.
        expect(ATTACHMENT_MAX_BYTES).toBe(50 * 1024 * 1024);
    });

    it('states the limit for the sheet to show before a file is chosen', () => {
        expect(ATTACHMENT_HINT).toContain('50MB');
    });
});
