import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateCategory = vi.fn();
const mockUpdateCategory = vi.fn();
const mockDeleteCategory = vi.fn();

vi.mock('./api', () => ({
    createCategory: (...args: unknown[]) => mockCreateCategory(...args),
    updateCategory: (...args: unknown[]) => mockUpdateCategory(...args),
    deleteCategory: (...args: unknown[]) => mockDeleteCategory(...args),
}));

import { ApiCallError } from '@/lib/utils/api-utils';

import {
    createCategoryAction,
    deleteCategoryAction,
    updateCategoryAction,
} from './actions';

const CATEGORY = {
    id: 'cat-1',
    name: 'Vet visit',
    description: null,
    isActive: true,
    createdById: null,
    updatedById: null,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: null,
};

describe('createCategoryAction', () => {
    beforeEach(() => {
        mockCreateCategory.mockReset();
    });

    it('strips the UI-only isSaveAndClose flag before calling the API', async () => {
        mockCreateCategory.mockResolvedValueOnce(CATEGORY);

        const result = await createCategoryAction({
            name: 'Vet visit',
            description: '',
            isActive: true,
            isSaveAndClose: true,
        });

        expect(result).toEqual({ ok: true, data: CATEGORY });
        expect(mockCreateCategory).toHaveBeenCalledWith({
            name: 'Vet visit',
            isActive: true,
        });
    });

    it('trims the name before calling the API', async () => {
        mockCreateCategory.mockResolvedValueOnce(CATEGORY);

        await createCategoryAction({
            name: '  Vet visit  ',
            isActive: true,
            isSaveAndClose: false,
        });

        expect(mockCreateCategory).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Vet visit' }),
        );
    });

    it('rejects an empty name without calling the API', async () => {
        const result = await createCategoryAction({
            name: '',
            isActive: true,
            isSaveAndClose: false,
        });

        expect(result.ok).toBe(false);
        expect(mockCreateCategory).not.toHaveBeenCalled();
    });

    it('surfaces the envelope message on a duplicate name', async () => {
        mockCreateCategory.mockRejectedValueOnce(
            new ApiCallError('A category with this name already exists.', null, 409),
        );

        const result = await createCategoryAction({
            name: 'Vet visit',
            isActive: true,
            isSaveAndClose: false,
        });

        expect(result).toEqual({
            ok: false,
            message: 'A category with this name already exists.',
        });
    });
});

describe('updateCategoryAction', () => {
    beforeEach(() => {
        mockUpdateCategory.mockReset();
    });

    it('updates the category', async () => {
        mockUpdateCategory.mockResolvedValueOnce(CATEGORY);

        const result = await updateCategoryAction('cat-1', {
            name: 'Vet visit',
            isActive: false,
            isSaveAndClose: false,
        });

        expect(result).toEqual({ ok: true, data: CATEGORY });
        expect(mockUpdateCategory).toHaveBeenCalledWith('cat-1', {
            name: 'Vet visit',
            isActive: false,
        });
    });
});

describe('deleteCategoryAction', () => {
    beforeEach(() => {
        mockDeleteCategory.mockReset();
    });

    it('deletes the category', async () => {
        mockDeleteCategory.mockResolvedValueOnce(CATEGORY);

        const result = await deleteCategoryAction('cat-1');

        expect(result).toEqual({ ok: true, data: undefined });
    });

    it('reports a failure', async () => {
        mockDeleteCategory.mockRejectedValueOnce(
            new ApiCallError('Category not found', null, 404),
        );

        const result = await deleteCategoryAction('cat-1');

        expect(result).toEqual({ ok: false, message: 'Category not found' });
    });
});
