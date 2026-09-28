'use client';

import { useCallback } from 'react';

import { useAuth } from '@/app/context/auth-context';
import { LoadFailure } from '@/components/load-failure';
import { useRequireOnboarded } from '@/lib/auth/use-auth-guard';
import { useFetch } from '@/lib/hooks/use-fetch';
import { PRODUCT_ROUTES } from '@/lib/routes';

import { AccountView } from './_components/account-view';
import { listOwnerAttachments } from './_lib/api';
import { listPets } from '../_lib/pets-api';
import { listWhatsComing } from '../whats-coming/_lib/api';

/**
 * Account — pets, attachments and settings (design 2i mobile, 2l desktop).
 * Archived pets are included so they can be restored from here, and the
 * what's-coming panel rides alongside on desktop. The email comes from the
 * session already in AuthContext, not a second profile request.
 */
export default function AccountPage() {
    const { loading: guardLoading } = useRequireOnboarded();
    const { user } = useAuth();
    const fetchAccount = useCallback(async () => {
        const [pets, attachments, whatsComing] = await Promise.all([
            listPets(true),
            listOwnerAttachments(),
            listWhatsComing(),
        ]);
        return { pets, attachments, whatsComing };
    }, []);
    const { state } = useFetch(guardLoading ? null : fetchAccount);

    if (state.status === 'loading') return null;
    if (state.status !== 'ready') {
        return (
            <LoadFailure
                state={state}
                notFoundMessage="Your account could not be loaded."
                backHref={PRODUCT_ROUTES.CHAT}
                backLabel="Back to chat"
            />
        );
    }

    return (
        <AccountView
            email={user?.email ?? ''}
            initialPets={state.data.pets}
            attachments={state.data.attachments}
            whatsComing={state.data.whatsComing}
        />
    );
}
