import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreatePet = vi.fn();
const mockUpdatePet = vi.fn();
const mockDeletePet = vi.fn();

vi.mock('./pets-api', () => ({
    createPet: (...args: unknown[]) => mockCreatePet(...args),
    updatePet: (...args: unknown[]) => mockUpdatePet(...args),
    deletePet: (...args: unknown[]) => mockDeletePet(...args),
}));

import { ApiCallError } from '@/lib/utils/api-utils';

import {
    createPetAction,
    deletePetAction,
    setPetArchivedAction,
} from './pets-actions';
import { Species } from './types';

const MILO = {
    id: 'pet-1',
    name: 'Milo',
    species: Species.Dog,
    age: '7 yrs',
    weight: null,
    breed: 'Beagle mix',
    isArchived: false,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: null,
};

describe('createPetAction', () => {
    beforeEach(() => {
        mockCreatePet.mockReset();
    });

    it('returns the created pet', async () => {
        mockCreatePet.mockResolvedValueOnce(MILO);

        const result = await createPetAction({
            name: 'Milo',
            species: Species.Dog,
        });

        expect(result).toEqual({ ok: true, data: MILO });
    });

    it('surfaces the duplicate-name conflict', async () => {
        mockCreatePet.mockRejectedValueOnce(
            new ApiCallError('You already have a pet with this name.', null, 409),
        );

        const result = await createPetAction({
            name: 'Milo',
            species: Species.Dog,
        });

        expect(result).toEqual({
            ok: false,
            message: 'You already have a pet with this name.',
        });
    });
});

describe('setPetArchivedAction', () => {
    beforeEach(() => {
        mockUpdatePet.mockReset();
    });

    it('archives by patching isArchived true', async () => {
        mockUpdatePet.mockResolvedValueOnce({ ...MILO, isArchived: true });

        const result = await setPetArchivedAction('pet-1', true);

        expect(mockUpdatePet).toHaveBeenCalledWith('pet-1', { isArchived: true });
        expect(result.ok && result.data.isArchived).toBe(true);
    });

    it('restores by patching isArchived false', async () => {
        mockUpdatePet.mockResolvedValueOnce(MILO);

        await setPetArchivedAction('pet-1', false);

        expect(mockUpdatePet).toHaveBeenCalledWith('pet-1', {
            isArchived: false,
        });
    });

    it('reports a failure', async () => {
        mockUpdatePet.mockRejectedValueOnce(
            new ApiCallError('Pet not found', null, 404),
        );

        const result = await setPetArchivedAction('pet-1', true);

        expect(result).toEqual({ ok: false, message: 'Pet not found' });
    });
});

describe('deletePetAction', () => {
    beforeEach(() => {
        mockDeletePet.mockReset();
    });

    it('deletes and returns ok', async () => {
        mockDeletePet.mockResolvedValueOnce(MILO);

        const result = await deletePetAction('pet-1');

        expect(result).toEqual({ ok: true, data: undefined });
    });
});
