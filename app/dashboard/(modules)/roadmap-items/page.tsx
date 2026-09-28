'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';

import { LoadFailure } from '@/components/load-failure';
import { Shell } from '@/components/shell';
import { useRequireSuperAdmin } from '@/lib/auth/use-auth-guard';
import { useFetch } from '@/lib/hooks/use-fetch';
import { DASHBOARD_ROUTES } from '@/lib/routes';
import { searchParamsToRecord } from '@/lib/utils/query-params';

import { RoadmapItemsTable } from './_components/roadmap-items-table';
import { listRoadmapItems } from './_lib/api';
import { searchParamsToRoadmapItemsQuery } from './_lib/url-params';

/**
 * Roadmap items list. Backs the What's Coming surface users vote on; the
 * tallies come from the backend, not from a client aggregation.
 */
function RoadmapItemsListPageInner() {
    const { loading: guardLoading } = useRequireSuperAdmin();
    const query = useSearchParams().toString();
    const fetchPage = useCallback(
        () =>
            listRoadmapItems(
                searchParamsToRoadmapItemsQuery(searchParamsToRecord(new URLSearchParams(query))),
            ),
        [query],
    );
    const { state, refetch } = useFetch(guardLoading ? null : fetchPage, {
        keepPreviousData: true,
    });

    if (state.status === 'loading') return <Shell>{null}</Shell>;
    if (state.status !== 'ready') {
        return (
            <LoadFailure
                state={state}
                notFoundMessage="Roadmap items could not be loaded."
                backHref={DASHBOARD_ROUTES.HOME}
                backLabel="Back to dashboard"
            />
        );
    }

    return (
        <Shell>
            <RoadmapItemsTable
                data={state.data.items}
                pageCount={state.data.totalPages}
                rowCount={state.data.totalRecords}
                activeCounts={state.data.activeCounts}
                onMutated={refetch}
            />
        </Shell>
    );
}

export default function RoadmapItemsListPage() {
    return (
        <Suspense fallback={null}>
            <RoadmapItemsListPageInner />
        </Suspense>
    );
}
