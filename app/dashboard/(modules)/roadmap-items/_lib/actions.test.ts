import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateItem = vi.fn();
const mockUpdateItem = vi.fn();
const mockDeleteItem = vi.fn();
const mockUpdateFeedbackStatus = vi.fn();

vi.mock('./api', () => ({
    createRoadmapItem: (...args: unknown[]) => mockCreateItem(...args),
    updateRoadmapItem: (...args: unknown[]) => mockUpdateItem(...args),
    deleteRoadmapItem: (...args: unknown[]) => mockDeleteItem(...args),
    updateFeedbackStatus: (...args: unknown[]) => mockUpdateFeedbackStatus(...args),
}));

import { FeedbackStatus } from '@/lib/enum';
import { ApiCallError } from '@/lib/utils/api-utils';

import {
    createRoadmapItemAction,
    deleteRoadmapItemAction,
    updateFeedbackStatusAction,
    updateRoadmapItemAction,
} from './actions';

const ITEM = {
    id: 'item-1',
    title: 'Pet Circle',
    description: null,
    isActive: true,
    yesCount: 0,
    noCount: 0,
    createdById: null,
    updatedById: null,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: null,
};

describe('createRoadmapItemAction', () => {
    beforeEach(() => {
        mockCreateItem.mockReset();
    });

    it('strips the UI-only isSaveAndClose flag before calling the API', async () => {
        mockCreateItem.mockResolvedValueOnce(ITEM);

        const result = await createRoadmapItemAction({
            title: 'Pet Circle',
            description: '',
            isActive: true,
            isSaveAndClose: true,
        });

        expect(result).toEqual({ ok: true, data: ITEM });
        expect(mockCreateItem).toHaveBeenCalledWith({
            title: 'Pet Circle',
            isActive: true,
        });
    });

    it('rejects an empty title without calling the API', async () => {
        const result = await createRoadmapItemAction({
            title: '',
            isActive: true,
            isSaveAndClose: false,
        });

        expect(result.ok).toBe(false);
        expect(mockCreateItem).not.toHaveBeenCalled();
    });

    it('surfaces the envelope message on a duplicate title', async () => {
        mockCreateItem.mockRejectedValueOnce(
            new ApiCallError(
                'A roadmap item with this title already exists.',
                null,
                409,
            ),
        );

        const result = await createRoadmapItemAction({
            title: 'Pet Circle',
            isActive: true,
            isSaveAndClose: false,
        });

        expect(result).toEqual({
            ok: false,
            message: 'A roadmap item with this title already exists.',
        });
    });
});

describe('updateRoadmapItemAction', () => {
    beforeEach(() => {
        mockUpdateItem.mockReset();
    });

    it('returns the updated item', async () => {
        mockUpdateItem.mockResolvedValueOnce(ITEM);

        const result = await updateRoadmapItemAction('item-1', {
            title: 'Pet Circle',
            isActive: false,
            isSaveAndClose: false,
        });

        expect(result).toEqual({ ok: true, data: ITEM });
    });
});

describe('deleteRoadmapItemAction', () => {
    beforeEach(() => {
        mockDeleteItem.mockReset();
    });

    it('returns success', async () => {
        mockDeleteItem.mockResolvedValueOnce(ITEM);

        const result = await deleteRoadmapItemAction('item-1');

        expect(result).toEqual({ ok: true, data: undefined });
    });

    it('reports a failure', async () => {
        mockDeleteItem.mockRejectedValueOnce(
            new ApiCallError('Roadmap item not found', null, 404),
        );

        const result = await deleteRoadmapItemAction('item-1');

        expect(result).toEqual({ ok: false, message: 'Roadmap item not found' });
    });
});

describe('updateFeedbackStatusAction', () => {
    beforeEach(() => {
        mockUpdateFeedbackStatus.mockReset();
    });

    it('returns the updated feedback', async () => {
        const feedback = {
            id: 'vote-1',
            userEmail: 'owner@example.com',
            choice: 0,
            note: 'Would use this daily',
            status: FeedbackStatus.Planned,
            createdAt: '2026-09-01T00:00:00Z',
            updatedAt: null,
        };
        mockUpdateFeedbackStatus.mockResolvedValueOnce(feedback);

        const result = await updateFeedbackStatusAction(
            'item-1',
            'vote-1',
            FeedbackStatus.Planned,
        );

        expect(result).toEqual({ ok: true, data: feedback });
        expect(mockUpdateFeedbackStatus).toHaveBeenCalledWith(
            'item-1',
            'vote-1',
            FeedbackStatus.Planned,
        );
    });

    it('reports a failure', async () => {
        mockUpdateFeedbackStatus.mockRejectedValueOnce(
            new ApiCallError('Feedback not found', null, 404),
        );

        const result = await updateFeedbackStatusAction(
            'item-1',
            'vote-1',
            FeedbackStatus.Rejected,
        );

        expect(result).toEqual({ ok: false, message: 'Feedback not found' });
    });
});
