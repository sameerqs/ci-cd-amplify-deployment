import type { ActionResult } from '@/lib/action-result';
import type { FeedbackStatus } from '@/lib/enum';
import { ApiCallError } from '@/lib/utils/api-utils';

import {
    createRoadmapItem,
    deleteRoadmapItem,
    updateFeedbackStatus,
    updateRoadmapItem,
    type CreateRoadmapItemPayload,
    type RoadmapFeedback,
    type RoadmapItem,
    type UpdateRoadmapItemPayload,
} from './api';
import {
    roadmapItemSchema,
    type RoadmapItemFormData,
    type RoadmapItemFormInput,
} from './schema';

function fail(error: unknown, fallback: string): ActionResult<never> {
    if (error instanceof ApiCallError) {
        return { ok: false, message: error.message };
    }
    if (error instanceof Error) {
        return { ok: false, message: error.message };
    }
    return { ok: false, message: fallback };
}

function parse(
    raw: RoadmapItemFormInput | RoadmapItemFormData,
):
    | { ok: true; payload: CreateRoadmapItemPayload }
    | { ok: false; message: string } {
    const parsed = roadmapItemSchema.safeParse(raw);
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        return { ok: false, message: first?.message ?? 'Invalid input.' };
    }
    const { isSaveAndClose: _drop, ...payload } = parsed.data;
    return { ok: true, payload: payload as CreateRoadmapItemPayload };
}

export async function createRoadmapItemAction(
    raw: RoadmapItemFormInput | RoadmapItemFormData,
): Promise<ActionResult<RoadmapItem>> {
    const parsed = parse(raw);
    if (!parsed.ok) return { ok: false, message: parsed.message };
    try {
        const item = await createRoadmapItem(parsed.payload);
        return { ok: true, data: item };
    } catch (e) {
        return fail(e, 'Failed to create roadmap item.');
    }
}

export async function updateRoadmapItemAction(
    id: string,
    raw: RoadmapItemFormInput | RoadmapItemFormData,
): Promise<ActionResult<RoadmapItem>> {
    const parsed = parse(raw);
    if (!parsed.ok) return { ok: false, message: parsed.message };
    try {
        const item = await updateRoadmapItem(
            id,
            parsed.payload as UpdateRoadmapItemPayload,
        );
        return { ok: true, data: item };
    } catch (e) {
        return fail(e, 'Failed to update roadmap item.');
    }
}

export async function deleteRoadmapItemAction(
    id: string,
): Promise<ActionResult<void>> {
    try {
        await deleteRoadmapItem(id);
        return { ok: true, data: undefined };
    } catch (e) {
        return fail(e, 'Failed to delete roadmap item.');
    }
}

export async function updateFeedbackStatusAction(
    itemId: string,
    voteId: string,
    status: FeedbackStatus,
): Promise<ActionResult<RoadmapFeedback>> {
    try {
        const feedback = await updateFeedbackStatus(itemId, voteId, status);
        return { ok: true, data: feedback };
    } catch (e) {
        return fail(e, 'Failed to update the feedback status.');
    }
}
