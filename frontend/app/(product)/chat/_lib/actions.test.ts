import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSend = vi.fn();
const mockConfirm = vi.fn();
const mockUndo = vi.fn();
const mockTrack = vi.fn();

vi.mock('./api', () => ({
    sendChatMessage: (...args: unknown[]) => mockSend(...args),
    confirmCaptureCard: (...args: unknown[]) => mockConfirm(...args),
    undoCaptureCard: (...args: unknown[]) => mockUndo(...args),
    trackClientEvent: (...args: unknown[]) => mockTrack(...args),
}));

import { ApiCallError } from '@/lib/utils/api-utils';

import { MessageAuthor } from '../../_lib/types';
import {
    confirmCardAction,
    sendMessageAction,
    trackEventAction,
    undoCardAction,
} from './actions';

const CONVERSATION = {
    id: 'c1',
    petId: 'pet-1',
    messages: [
        {
            id: 'm1',
            author: MessageAuthor.Assistant,
            body: 'Hi',
            isEmergencyNotice: false,
            createdAt: '2026-09-17T00:00:00Z',
            attachments: [],
        },
    ],
    card: null,
    attachments: [],
    suggestedQuestion: null,
};

function formWith(body: string, files: File[] = []): FormData {
    const form = new FormData();
    form.append('body', body);
    for (const file of files) form.append('files', file);
    return form;
}

describe('sendMessageAction', () => {
    beforeEach(() => mockSend.mockReset());

    it('sends the form as-is', async () => {
        mockSend.mockResolvedValueOnce(CONVERSATION);
        const form = formWith('hello');

        await sendMessageAction('pet-1', form);

        expect(mockSend).toHaveBeenCalledWith('pet-1', form);
    });

    it('refuses a turn with no text and no file, without calling the API', async () => {
        const result = await sendMessageAction('pet-1', formWith('   '));

        expect(result).toEqual({
            ok: false,
            message: 'Type something or attach a file.',
        });
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('allows a file with no text', async () => {
        mockSend.mockResolvedValueOnce(CONVERSATION);
        const file = new File(['x'], 'paw.jpg', { type: 'image/jpeg' });

        const result = await sendMessageAction('pet-1', formWith('', [file]));

        expect(result.ok).toBe(true);
        expect(mockSend).toHaveBeenCalledOnce();
    });

    it('ignores a zero-byte file when deciding whether the turn is empty', async () => {
        const empty = new File([], 'empty.pdf');

        const result = await sendMessageAction('pet-1', formWith('  ', [empty]));

        expect(result).toEqual({
            ok: false,
            message: 'Type something or attach a file.',
        });
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('surfaces a 503 when the language model is not configured', async () => {
        mockSend.mockRejectedValueOnce(
            new ApiCallError('Language model is not configured', null, 503),
        );

        const result = await sendMessageAction('pet-1', formWith('hello'));

        expect(result).toEqual({
            ok: false,
            message: 'Language model is not configured',
        });
    });

    it('returns the whole conversation so the view replaces its state', async () => {
        mockSend.mockResolvedValueOnce(CONVERSATION);

        const result = await sendMessageAction('pet-1', formWith('hello'));

        expect(result.ok && result.data.messages).toHaveLength(1);
    });
});

describe('confirmCardAction / undoCardAction', () => {
    beforeEach(() => {
        mockConfirm.mockReset();
        mockUndo.mockReset();
    });

    it('confirms the card', async () => {
        mockConfirm.mockResolvedValueOnce({
            ...CONVERSATION,
            card: { groups: [], isConfirmed: true },
        });

        const result = await confirmCardAction('pet-1');

        expect(result.ok && result.data.card?.isConfirmed).toBe(true);
    });

    it('undoes the confirmation', async () => {
        mockUndo.mockResolvedValueOnce({
            ...CONVERSATION,
            card: { groups: [], isConfirmed: false },
        });

        const result = await undoCardAction('pet-1');

        expect(result.ok && result.data.card?.isConfirmed).toBe(false);
    });

    it('reports a failure to confirm', async () => {
        mockConfirm.mockRejectedValueOnce(
            new ApiCallError('Conversation not found', null, 404),
        );

        const result = await confirmCardAction('pet-1');

        expect(result).toEqual({ ok: false, message: 'Conversation not found' });
    });
});

describe('trackEventAction', () => {
    beforeEach(() => mockTrack.mockReset());

    it('forwards the event and its properties', async () => {
        mockTrack.mockResolvedValueOnce(null);

        await trackEventAction('chip_tapped', { label: 'Start with the bill' });

        expect(mockTrack).toHaveBeenCalledWith('chip_tapped', {
            label: 'Start with the bill',
        });
    });

    it('never throws — a dropped event must not break the flow it measures', async () => {
        mockTrack.mockRejectedValueOnce(new Error('network down'));

        await expect(trackEventAction('capture_sheet_opened')).resolves.toBeUndefined();
    });
});
