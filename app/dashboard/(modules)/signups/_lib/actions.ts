import type { ActionResult } from '@/lib/action-result';
import { ApiCallError } from '@/lib/utils/api-utils';

import { approveSignup, rejectSignup, type Signup } from './api';

function fail(error: unknown, fallback: string): ActionResult<never> {
    if (error instanceof ApiCallError) {
        return { ok: false, message: error.message };
    }
    if (error instanceof Error) {
        return { ok: false, message: error.message };
    }
    return { ok: false, message: fallback };
}

export async function approveSignupAction(
    id: string,
): Promise<ActionResult<Signup>> {
    try {
        const envelope = await approveSignup(id);
        const warning = envelope.warningMessage
            ? {
                  heading: envelope.warningHeading,
                  message: envelope.warningMessage,
              }
            : undefined;
        return { ok: true, data: envelope.data, warning };
    } catch (e) {
        return fail(e, 'Failed to approve this signup.');
    }
}

export async function rejectSignupAction(
    id: string,
): Promise<ActionResult<Signup>> {
    try {
        const signup = await rejectSignup(id);
        return { ok: true, data: signup };
    } catch (e) {
        return fail(e, 'Failed to reject this signup.');
    }
}
