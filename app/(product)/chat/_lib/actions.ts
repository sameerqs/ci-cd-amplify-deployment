import type { ActionResult } from '@/lib/action-result';
import { ApiCallError } from '@/lib/utils/api-utils';

import type { Conversation } from '../../_lib/types';
import { confirmCaptureCard, sendChatMessage, trackClientEvent, undoCaptureCard } from './api';

function fail(error: unknown, fallback: string): ActionResult<never> {
    if (error instanceof ApiCallError) return { ok: false, message: error.message };
    if (error instanceof Error) return { ok: false, message: error.message };
    return { ok: false, message: fallback };
}

export async function sendMessageAction(
    petId: string,
    form: FormData,
): Promise<ActionResult<Conversation>> {
    const body = String(form.get('body') ?? '').trim();
    const files = form.getAll('files').filter((f) => f instanceof File && f.size > 0);
    // why: a turn has to carry something, and catching it here saves a round
    // trip. The server enforces the same rule for anything that bypasses this.
    if (!body && files.length === 0) {
        return { ok: false, message: 'Type something or attach a file.' };
    }
    try {
        return { ok: true, data: await sendChatMessage(petId, form) };
    } catch (e) {
        return fail(e, 'Failed to send the message.');
    }
}

export async function confirmCardAction(
    petId: string,
): Promise<ActionResult<Conversation>> {
    try {
        return { ok: true, data: await confirmCaptureCard(petId) };
    } catch (e) {
        return fail(e, 'Failed to confirm.');
    }
}

export async function undoCardAction(
    petId: string,
): Promise<ActionResult<Conversation>> {
    try {
        return { ok: true, data: await undoCaptureCard(petId) };
    } catch (e) {
        return fail(e, 'Failed to undo.');
    }
}

// why: telemetry must never be able to break or interrupt the flow it is
// measuring — a dropped event is a gap in a dashboard, not something a user
// should see a toast about. The caller fires this without awaiting it.
export async function trackEventAction(
    event: 'chip_tapped' | 'capture_sheet_opened',
    properties?: Record<string, string | number | boolean>,
): Promise<void> {
    try {
        await trackClientEvent(event, properties);
    } catch {
        // swallowed on purpose - see above.
    }
}
