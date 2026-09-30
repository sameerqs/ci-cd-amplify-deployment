'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';

import { LoadFailure } from '@/components/load-failure';
import { Shell } from '@/components/shell';
import { useRequireSuperAdmin } from '@/lib/auth/use-auth-guard';
import { useFetch } from '@/lib/hooks/use-fetch';
import { DASHBOARD_ROUTES } from '@/lib/routes';
import { searchParamsToRecord } from '@/lib/utils/query-params';

import { CategoriesTable } from './_components/categories-table';
import { listCategories } from './_lib/api';
import { searchParamsToCategoriesQuery } from './_lib/url-params';

/**
 * Categories list. Categories are admin-configurable rows rather than a
 * numeric enum, so the chat extraction reads the live set.
 */
function CategoriesListPageInner() {
    const { loading: guardLoading } = useRequireSuperAdmin();
    const query = useSearchParams().toString();
    const fetchPage = useCallback(
        () =>
            listCategories(
                searchParamsToCategoriesQuery(searchParamsToRecord(new URLSearchParams(query))),
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
                notFoundMessage="Categories could not be loaded."
                backHref={DASHBOARD_ROUTES.HOME}
                backLabel="Back to dashboard"
            />
        );
    }

    return (
        <Shell>
            <CategoriesTable
                data={state.data.items}
                pageCount={state.data.totalPages}
                rowCount={state.data.totalRecords}
                activeCounts={state.data.activeCounts}
                onMutated={refetch}
            />
        </Shell>
    );
}

export default function CategoriesListPage() {
    return (
        <Suspense fallback={null}>
            <CategoriesListPageInner />
        </Suspense>
    );
}
