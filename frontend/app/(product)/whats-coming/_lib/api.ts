import { call } from '@/lib/utils/api-utils';

import type { RoadmapEntry, VoteChoice } from '../../_lib/types';

export interface CastVotePayload {
    choice: VoteChoice;
    note?: string;
}

const BASE = 'whats-coming';

export const listWhatsComing = async (): Promise<RoadmapEntry[]> => {
    const res = await call<{ items: RoadmapEntry[] }>({
        endpoint: BASE,
        method: 'GET',
        silent: true,
    });
    return res?.items ?? [];
};

export const castVote = (itemId: string, payload: CastVotePayload) =>
    call<RoadmapEntry>({
        endpoint: `${BASE}/${itemId}/vote`,
        method: 'PUT',
        payload,
        silent: true,
    });

export const clearVote = (itemId: string) =>
    call<RoadmapEntry>({
        endpoint: `${BASE}/${itemId}/vote`,
        method: 'DELETE',
        silent: true,
    });
