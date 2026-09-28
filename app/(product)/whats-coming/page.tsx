'use client';

import { LoadFailure } from '@/components/load-failure';
import { useRequireOnboarded } from '@/lib/auth/use-auth-guard';
import { useFetch } from '@/lib/hooks/use-fetch';
import { PRODUCT_ROUTES } from '@/lib/routes';

import { listWhatsComing } from './_lib/api';
import { WhatsComingView } from './_components/whats-coming-view';

/**
 * What's coming — vote and say why (design 2j). Reads the owner-facing route,
 * which returns the caller's own vote and deliberately no crowd tallies.
 */
export default function WhatsComingPage() {
    const { loading: guardLoading } = useRequireOnboarded();
    const { state } = useFetch(guardLoading ? null : listWhatsComing);

    if (state.status === 'loading') return null;
    if (state.status !== 'ready') {
        return (
            <LoadFailure
                state={state}
                notFoundMessage="What's coming could not be loaded."
                backHref={PRODUCT_ROUTES.CHAT}
                backLabel="Back to chat"
            />
        );
    }

    return <WhatsComingView initialEntries={state.data} />;
}
