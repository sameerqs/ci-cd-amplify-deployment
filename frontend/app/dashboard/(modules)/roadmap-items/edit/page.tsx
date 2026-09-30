'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';

import { LoadFailure } from '@/components/load-failure';
import { Shell } from '@/components/shell';
import { useRequireSuperAdmin } from '@/lib/auth/use-auth-guard';
import { useFetch } from '@/lib/hooks/use-fetch';
import { ROADMAP_ROUTES } from '@/lib/routes';
import { ApiCallError } from '@/lib/utils/api-utils';

import { getRoadmapItem } from '../_lib/api';
import { EditRoadmapItemView } from './edit-view';

/** Roadmap items — Edit page. `?id=` routed; see users/edit/page.tsx. */
function EditRoadmapItemPageInner() {
    const { loading: guardLoading } = useRequireSuperAdmin();
    const id = useSearchParams().get('id');
    const fetchItem = useCallback(async () => {
        if (!id) throw new ApiCallError('Missing id', null, 404);
        return getRoadmapItem(id);
    }, [id]);
    const { state } = useFetch(guardLoading ? null : fetchItem);

    if (state.status === 'loading') return <Shell>{null}</Shell>;
    if (state.status !== 'ready') {
        return (
            <LoadFailure
                state={state}
                notFoundMessage="This roadmap item could not be found."
                backHref={ROADMAP_ROUTES.LIST}
                backLabel="Back to Roadmap"
            />
        );
    }

    return <EditRoadmapItemView item={state.data} />;
}

export default function EditRoadmapItemPage() {
    return (
        <Suspense fallback={null}>
            <EditRoadmapItemPageInner />
        </Suspense>
    );
}
