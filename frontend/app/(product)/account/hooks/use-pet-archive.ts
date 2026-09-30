'use client';

import { useCallback, useState, useTransition } from 'react';

import { toast } from '@/lib/toast';

import { usePets } from '../../context/pets-context';
import { setPetArchivedAction } from '../../_lib/pets-actions';
import type { Pet } from '../../_lib/types';

interface UsePetArchiveResult {
    pets: Pet[];
    busyId: string | null;
    toggleArchive: (pet: Pet) => void;
    /** The pet a confirmation is open for, or null. */
    pendingArchive: Pet | null;
    requestArchive: (pet: Pet) => void;
    cancelArchive: () => void;
    confirmArchive: () => void;
}

/**
 * Archive/restore for the account screen (design 2i). Archiving hides a pet and
 * their whole chat, so it asks first; restoring is additive and does not.
 *
 * `initialPets` includes archived rows (the account screen's own `listPets(true)`
 * fetch, separate from the nav rail's active-only list) — kept locally here and
 * patched in place after a mutation, while `usePets().refetch()` separately
 * keeps the rail's active-pet list in sync.
 */
export function usePetArchive(initialPets: Pet[]): UsePetArchiveResult {
    const { refetch: refetchRail } = usePets();
    const [pets, setPets] = useState<Pet[]>(initialPets);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [pendingArchive, setPendingArchive] = useState<Pet | null>(null);
    const [, startTransition] = useTransition();

    const toggleArchive = useCallback(
        (pet: Pet) => {
            const next = !pet.isArchived;
            setBusyId(pet.id);
            startTransition(async () => {
                const result = await setPetArchivedAction(pet.id, next);
                setBusyId(null);
                if (!result.ok) {
                    toast.error(result.message);
                    return;
                }
                setPets((current) =>
                    current.map((row) => (row.id === pet.id ? result.data : row)),
                );
                toast.success(
                    next
                        ? `${pet.name} has been archived.`
                        : `${pet.name} is back in your pets.`,
                );
                refetchRail();
            });
        },
        [refetchRail],
    );

    const requestArchive = useCallback(
        (pet: Pet) => {
            if (pet.isArchived) {
                toggleArchive(pet);
                return;
            }
            setPendingArchive(pet);
        },
        [toggleArchive],
    );

    return {
        pets,
        busyId,
        toggleArchive,
        pendingArchive,
        requestArchive,
        cancelArchive: () => setPendingArchive(null),
        confirmArchive: () => {
            if (!pendingArchive) return;
            toggleArchive(pendingArchive);
            setPendingArchive(null);
        },
    };
}
