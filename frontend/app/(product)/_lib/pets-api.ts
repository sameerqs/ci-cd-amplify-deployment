import { call } from '@/lib/utils/api-utils';

import type { Pet, Species } from './types';

export interface CreatePetPayload {
    name: string;
    species: Species;
    age?: string;
    weight?: string;
    breed?: string;
}

export type UpdatePetPayload = Partial<CreatePetPayload> & {
    isArchived?: boolean;
};

const BASE = 'pets';

export const listPets = async (includeArchived = false): Promise<Pet[]> => {
    const res = await call<{ items: Pet[] }>({
        endpoint: `${BASE}${includeArchived ? '?includeArchived=true' : ''}`,
        method: 'GET',
        silent: true,
    });
    return res?.items ?? [];
};

export const getPet = (id: string) =>
    call<Pet>({ endpoint: `${BASE}/${id}`, method: 'GET', silent: true });

export const createPet = (payload: CreatePetPayload) =>
    call<Pet>({ endpoint: BASE, method: 'POST', payload, silent: true });

export const updatePet = (id: string, payload: UpdatePetPayload) =>
    call<Pet>({ endpoint: `${BASE}/${id}`, method: 'PATCH', payload, silent: true });

export const deletePet = (id: string) =>
    call<Pet>({ endpoint: `${BASE}/${id}`, method: 'DELETE', silent: true });
