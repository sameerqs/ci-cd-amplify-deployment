import type { ActionResult } from '@/lib/action-result';
import { ApiCallError } from '@/lib/utils/api-utils';

import {
    createPet,
    deletePet,
    updatePet,
    type CreatePetPayload,
    type UpdatePetPayload,
} from './pets-api';
import type { Pet } from './types';

function fail(error: unknown, fallback: string): ActionResult<never> {
    if (error instanceof ApiCallError) return { ok: false, message: error.message };
    if (error instanceof Error) return { ok: false, message: error.message };
    return { ok: false, message: fallback };
}

// Callers refetch the surfaces that need fresh data themselves after a
// successful mutation (e.g. via `usePets().refetch()` for the nav rail) —
// there is no server left here to revalidate a route on their behalf.

export async function createPetAction(
    payload: CreatePetPayload,
): Promise<ActionResult<Pet>> {
    try {
        const pet = await createPet(payload);
        return { ok: true, data: pet };
    } catch (e) {
        return fail(e, 'Failed to add the pet.');
    }
}

export async function updatePetAction(
    id: string,
    payload: UpdatePetPayload,
): Promise<ActionResult<Pet>> {
    try {
        const pet = await updatePet(id, payload);
        return { ok: true, data: pet };
    } catch (e) {
        return fail(e, 'Failed to update the pet.');
    }
}

export async function setPetArchivedAction(
    id: string,
    isArchived: boolean,
): Promise<ActionResult<Pet>> {
    return updatePetAction(id, { isArchived });
}

export async function deletePetAction(id: string): Promise<ActionResult<void>> {
    try {
        await deletePet(id);
        return { ok: true, data: undefined };
    } catch (e) {
        return fail(e, 'Failed to remove the pet.');
    }
}
