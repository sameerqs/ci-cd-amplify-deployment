import type { ActionResult } from '@/lib/action-result';
import { ApiCallError } from '@/lib/utils/api-utils';

import {
    createCategory,
    deleteCategory,
    updateCategory,
    type Category,
    type CreateCategoryPayload,
    type UpdateCategoryPayload,
} from './api';
import {
    categorySchema,
    type CategoryFormData,
    type CategoryFormInput,
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
    raw: CategoryFormInput | CategoryFormData,
):
    | { ok: true; payload: CreateCategoryPayload }
    | { ok: false; message: string } {
    const parsed = categorySchema.safeParse(raw);
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        return { ok: false, message: first?.message ?? 'Invalid input.' };
    }
    const { isSaveAndClose: _drop, ...payload } = parsed.data;
    return { ok: true, payload: payload as CreateCategoryPayload };
}

export async function createCategoryAction(
    raw: CategoryFormInput | CategoryFormData,
): Promise<ActionResult<Category>> {
    const parsed = parse(raw);
    if (!parsed.ok) return { ok: false, message: parsed.message };
    try {
        const category = await createCategory(parsed.payload);
        return { ok: true, data: category };
    } catch (e) {
        return fail(e, 'Failed to create category.');
    }
}

export async function updateCategoryAction(
    id: string,
    raw: CategoryFormInput | CategoryFormData,
): Promise<ActionResult<Category>> {
    const parsed = parse(raw);
    if (!parsed.ok) return { ok: false, message: parsed.message };
    try {
        const category = await updateCategory(
            id,
            parsed.payload as UpdateCategoryPayload,
        );
        return { ok: true, data: category };
    } catch (e) {
        return fail(e, 'Failed to update category.');
    }
}

export async function deleteCategoryAction(
    id: string,
): Promise<ActionResult<void>> {
    try {
        await deleteCategory(id);
        return { ok: true, data: undefined };
    } catch (e) {
        return fail(e, 'Failed to delete category.');
    }
}
