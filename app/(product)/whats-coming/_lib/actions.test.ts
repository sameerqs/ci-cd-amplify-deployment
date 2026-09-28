import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCastVote = vi.fn();
const mockClearVote = vi.fn();

vi.mock('./api', () => ({
    castVote: (...args: unknown[]) => mockCastVote(...args),
    clearVote: (...args: unknown[]) => mockClearVote(...args),
}));

import { ApiCallError } from '@/lib/utils/api-utils';

import { VoteChoice } from '../../_lib/types';
import { castVoteAction, clearVoteAction } from './actions';

const ENTRY = {
    id: 'r1',
    title: 'Pet Circle',
    description: 'Share a record',
    commentPrompt: 'Who would you invite?',
    myVote: VoteChoice.Yes,
    note: '',
};

describe('castVoteAction', () => {
    beforeEach(() => {
        mockCastVote.mockReset();
    });

    it('sends the numeric choice', async () => {
        mockCastVote.mockResolvedValueOnce(ENTRY);

        const result = await castVoteAction('r1', VoteChoice.Yes, 'weekly');

        expect(mockCastVote).toHaveBeenCalledWith('r1', {
            choice: VoteChoice.Yes,
            note: 'weekly',
        });
        expect(result).toEqual({ ok: true, data: ENTRY });
    });

    it('surfaces a 404 for an item that is no longer votable', async () => {
        mockCastVote.mockRejectedValueOnce(
            new ApiCallError('Roadmap item not found', null, 404),
        );

        const result = await castVoteAction('r1', VoteChoice.No, '');

        expect(result).toEqual({ ok: false, message: 'Roadmap item not found' });
    });
});

describe('clearVoteAction', () => {
    beforeEach(() => {
        mockClearVote.mockReset();
    });

    it('withdraws the vote', async () => {
        mockClearVote.mockResolvedValueOnce({ ...ENTRY, myVote: null, note: null });

        const result = await clearVoteAction('r1');

        expect(result.ok && result.data.myVote).toBeNull();
    });
});
