import type { ActionResult } from '@/lib/action-result';
import { ApiCallError } from '@/lib/utils/api-utils';

import {
    approveUser,
    deleteUser,
    inviteUser,
    rejectUser,
    updateUser,
    type InviteUserPayload,
    type UpdateUserPayload,
    type User,
} from './api';
import {
    inviteUserSchema,
    updateUserSchema,
    type InviteUserFormData,
    type InviteUserFormInput,
    type UpdateUserFormData,
    type UpdateUserFormInput,
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

export async function inviteUserAction(
    raw: InviteUserFormInput | InviteUserFormData,
): Promise<ActionResult<User>> {
    const parsed = inviteUserSchema.safeParse(raw);
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        return { ok: false, message: first?.message ?? 'Invalid input.' };
    }
    const { isSaveAndClose: _drop, ...payload } = parsed.data;
    try {
        const envelope = await inviteUser(payload as InviteUserPayload);
        const warning = envelope.warningMessage
            ? {
                  heading: envelope.warningHeading,
                  message: envelope.warningMessage,
              }
            : undefined;
        return { ok: true, data: envelope.data, warning };
    } catch (e) {
        return fail(e, 'Failed to invite user.');
    }
}

export async function updateUserAction(
    id: string,
    raw: UpdateUserFormInput | UpdateUserFormData,
): Promise<ActionResult<User>> {
    const parsed = updateUserSchema.safeParse(raw);
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        return { ok: false, message: first?.message ?? 'Invalid input.' };
    }
    const { isSaveAndClose: _drop, ...payload } = parsed.data;
    try {
        const user = await updateUser(id, payload as UpdateUserPayload);
        return { ok: true, data: user };
    } catch (e) {
        return fail(e, 'Failed to update user.');
    }
}

export async function approveUserAction(id: string): Promise<ActionResult<User>> {
    try {
        const envelope = await approveUser(id);
        const warning = envelope.warningMessage
            ? {
                  heading: envelope.warningHeading,
                  message: envelope.warningMessage,
              }
            : undefined;
        return { ok: true, data: envelope.data, warning };
    } catch (e) {
        return fail(e, 'Failed to approve this user.');
    }
}

export async function rejectUserAction(id: string): Promise<ActionResult<User>> {
    try {
        const user = await rejectUser(id);
        return { ok: true, data: user };
    } catch (e) {
        return fail(e, 'Failed to decline this user.');
    }
}

export async function deleteUserAction(id: string): Promise<ActionResult<void>> {
    try {
        await deleteUser(id);
        return { ok: true, data: undefined };
    } catch (e) {
        return fail(e, 'Failed to delete user.');
    }
}
