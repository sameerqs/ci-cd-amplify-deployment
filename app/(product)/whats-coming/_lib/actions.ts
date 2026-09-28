import type { ActionResult } from '@/lib/action-result';
import { ApiCallError } from '@/lib/utils/api-utils';

import type { RoadmapEntry, VoteChoice } from '../../_lib/types';
import { castVote, clearVote } from './api';

function fail(error: unknown, fallback: string): ActionResult<never> {
    if (error instanceof ApiCallError) return { ok: false, message: error.message };
    if (error instanceof Error) return { ok: false, message: error.message };
    return { ok: false, message: fallback };
}

export async function castVoteAction(
    itemId: string,
    choice: VoteChoice,
    note: string,
): Promise<ActionResult<RoadmapEntry>> {
    try {
        const entry = await castVote(itemId, { choice, note });
        return { ok: true, data: entry };
    } catch (e) {
        return fail(e, 'Failed to record your vote.');
    }
}

export async function clearVoteAction(
    itemId: string,
): Promise<ActionResult<RoadmapEntry>> {
    try {
        const entry = await clearVote(itemId);
        return { ok: true, data: entry };
    } catch (e) {
        return fail(e, 'Failed to clear your vote.');
    }
}
