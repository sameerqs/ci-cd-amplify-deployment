'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';

import { LoadFailure } from '@/components/load-failure';
import { Shell } from '@/components/shell';
import { useRequireSuperAdmin } from '@/lib/auth/use-auth-guard';
import { useFetch } from '@/lib/hooks/use-fetch';
import { DASHBOARD_ROUTES } from '@/lib/routes';
import { searchParamsToRecord } from '@/lib/utils/query-params';

import { UsersTable } from './_components/users-table';
import { listUsers } from './_lib/api';
import { searchParamsToUsersQuery } from './_lib/url-params';

/**
 * Internal Users list. Paging / sort / filter state lives in the URL; the
 * page is fetched client-side and the backend filters to the administrative
 * user set automatically.
 */
function UsersListPageInner() {
    const { loading: guardLoading } = useRequireSuperAdmin();
    // why: the string, not the object — useSearchParams hands back a new
    // instance on every navigation, which would refetch on unrelated renders.
    const query = useSearchParams().toString();
    const fetchPage = useCallback(
        () => listUsers(searchParamsToUsersQuery(searchParamsToRecord(new URLSearchParams(query)))),
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
                notFoundMessage="Users could not be loaded."
                backHref={DASHBOARD_ROUTES.HOME}
                backLabel="Back to dashboard"
            />
        );
    }

    return (
        <Shell>
            <UsersTable
                data={state.data.items}
                pageCount={state.data.totalPages}
                rowCount={state.data.totalRecords}
                onMutated={refetch}
            />
        </Shell>
    );
}

export default function UsersListPage() {
    return (
        <Suspense fallback={null}>
            <UsersListPageInner />
        </Suspense>
    );
}
