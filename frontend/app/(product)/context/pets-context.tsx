'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';

import { useAuth } from '@/app/context/auth-context';

import { listPets } from '../_lib/pets-api';
import type { Pet } from '../_lib/types';

interface PetsContextType {
    /** Active pets, for the nav rail's pet switcher and the chat workspace. */
    pets: Pet[];
    /**
     * True until the first fetch resolves — consumers that pick a default pet
     * from this list (chat) wait on it before deciding there are none. A later
     * `refetch()` never flips it back, so nothing unmounts while it runs.
     */
    loading: boolean;
    /** Re-fetch after any mutation elsewhere (archive, create, delete, ...). */
    refetch: () => void;
}

const PetsContext = createContext<PetsContextType | undefined>(undefined);

/**
 * The pet-owner shell's nav rail needs the active pet list on every product
 * page, and several pages elsewhere (account, new-pet, chat) mutate or
 * select from it. Sharing one fetch here means a mutation only has to call
 * `refetch()` instead of every consumer re-deriving its own copy.
 */
export function PetsProvider({ children }: { children: ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const [pets, setPets] = useState<Pet[]>([]);
    const [loading, setLoading] = useState(true);
    const latest = useRef(0);
    const signedIn = user !== null;

    const refetch = useCallback(() => {
        latest.current += 1;
        const id = latest.current;
        if (!signedIn) {
            setPets([]);
            setLoading(false);
            return;
        }
        listPets()
            .catch((): Pet[] => [])
            .then((next) => {
                if (id !== latest.current) return;
                setPets(next);
                setLoading(false);
            });
    }, [signedIn]);

    useEffect(() => {
        if (authLoading) return;
        refetch();
        return () => {
            latest.current += 1;
        };
    }, [authLoading, refetch]);

    const value = useMemo(() => ({ pets, loading, refetch }), [pets, loading, refetch]);

    return <PetsContext.Provider value={value}>{children}</PetsContext.Provider>;
}

export function usePets(): PetsContextType {
    const ctx = useContext(PetsContext);
    if (!ctx) throw new Error('usePets must be used within PetsProvider');
    return ctx;
}
