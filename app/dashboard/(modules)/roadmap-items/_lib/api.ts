import type { FeedbackStatus, VoteChoice } from '@/lib/enum';
import { call, type PaginatedData } from '@/lib/utils/api-utils';

export interface RoadmapItem {
    id: string;
    title: string;
    description: string | null;
    /** What opens the owner's comment box for this card specifically. */
    commentPrompt: string | null;
    isActive: boolean;
    yesCount: number;
    noCount: number;
    createdById: string | null;
    updatedById: string | null;
    createdAt: string;
    updatedAt: string | null;
}

export interface ActiveCount {
    isActive: boolean;
    count: number;
}

export type RoadmapItemsPage = PaginatedData<RoadmapItem> & {
    activeCounts: ActiveCount[];
};

export interface CreateRoadmapItemPayload {
    title: string;
    description?: string;
    commentPrompt?: string;
    isActive: boolean;
}

export type UpdateRoadmapItemPayload = Partial<CreateRoadmapItemPayload>;

export interface ListRoadmapItemsQuery {
    page?: number;
    pageSize?: number;
    search?: string;
    isActive?: boolean;
    /** Comma-separated `field:asc|desc` pairs. */
    sort?: string;
}

const BASE = 'roadmap-items';

function buildQuery(q: ListRoadmapItemsQuery | undefined): string {
    if (!q) return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(q)) {
        if (value === undefined || value === null || value === '') continue;
        params.set(key, String(value));
    }
    const s = params.toString();
    return s ? `?${s}` : '';
}

export const listRoadmapItems = (query?: ListRoadmapItemsQuery) =>
    call<RoadmapItemsPage>({
        endpoint: `${BASE}${buildQuery(query)}`,
        method: 'GET',
        silent: true,
    });

export const getRoadmapItem = (id: string) =>
    call<RoadmapItem>({
        endpoint: `${BASE}/${id}`,
        method: 'GET',
        silent: true,
    });

export const createRoadmapItem = (payload: CreateRoadmapItemPayload) =>
    call<RoadmapItem>({
        endpoint: BASE,
        method: 'POST',
        payload,
        silent: true,
    });

export const updateRoadmapItem = (
    id: string,
    payload: UpdateRoadmapItemPayload,
) =>
    call<RoadmapItem>({
        endpoint: `${BASE}/${id}`,
        method: 'PATCH',
        payload,
        silent: true,
    });

export const deleteRoadmapItem = (id: string) =>
    call<RoadmapItem>({
        endpoint: `${BASE}/${id}`,
        method: 'DELETE',
        silent: true,
    });

export interface RoadmapFeedback {
    id: string;
    userEmail: string;
    choice: VoteChoice;
    note: string | null;
    status: FeedbackStatus;
    createdAt: string;
    updatedAt: string | null;
}

export const listRoadmapItemFeedback = async (
    itemId: string,
): Promise<RoadmapFeedback[]> => {
    const res = await call<{ items: RoadmapFeedback[] }>({
        endpoint: `${BASE}/${itemId}/feedback`,
        method: 'GET',
        silent: true,
    });
    return res?.items ?? [];
};

export const updateFeedbackStatus = (
    itemId: string,
    voteId: string,
    status: FeedbackStatus,
) =>
    call<RoadmapFeedback>({
        endpoint: `${BASE}/${itemId}/feedback/${voteId}/status`,
        method: 'PATCH',
        payload: { status },
        silent: true,
    });
