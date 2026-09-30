'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';

import { LoadFailure } from '@/components/load-failure';
import { Shell } from '@/components/shell';
import { useRequireSuperAdmin } from '@/lib/auth/use-auth-guard';
import { useFetch } from '@/lib/hooks/use-fetch';
import { DASHBOARD_ROUTES } from '@/lib/routes';
import { searchParamsToRecord } from '@/lib/utils/query-params';

import { SignupsTable } from './_components/signups-table';
import { listSignups } from './_lib/api';
import { searchParamsToSignupsQuery } from './_lib/url-params';

/**
 * Signups review list. Shows pet-owner accounts awaiting an admin decision;
 * the internal-users list is a separate, Super Admin surface.
 */
function SignupsListPageInner() {
    const { loading: guardLoading } = useRequireSuperAdmin();
    const query = useSearchParams().toString();
    const fetchPage = useCallback(
        () =>
            listSignups(searchParamsToSignupsQuery(searchParamsToRecord(new URLSearchParams(query)))),
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
                notFoundMessage="Signups could not be loaded."
                backHref={DASHBOARD_ROUTES.HOME}
                backLabel="Back to dashboard"
            />
        );
    }

    return (
        <Shell>
            <SignupsTable
                data={state.data.items}
                pageCount={state.data.totalPages}
                rowCount={state.data.totalRecords}
                statusCounts={state.data.statusCounts}
                onMutated={refetch}
            />
        </Shell>
    );
}

export default function SignupsListPage() {
    return (
        <Suspense fallback={null}>
            <SignupsListPageInner />
        </Suspense>
    );
}
