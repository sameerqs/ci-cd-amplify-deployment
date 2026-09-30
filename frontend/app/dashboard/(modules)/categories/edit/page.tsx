'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';

import { LoadFailure } from '@/components/load-failure';
import { Shell } from '@/components/shell';
import { useRequireSuperAdmin } from '@/lib/auth/use-auth-guard';
import { useFetch } from '@/lib/hooks/use-fetch';
import { CATEGORIES_ROUTES } from '@/lib/routes';
import { ApiCallError } from '@/lib/utils/api-utils';

import { getCategory } from '../_lib/api';
import { EditCategoryView } from './edit-view';

/** Categories — Edit page. `?id=` routed; see users/edit/page.tsx. */
function EditCategoryPageInner() {
    const { loading: guardLoading } = useRequireSuperAdmin();
    const id = useSearchParams().get('id');
    const fetchCategory = useCallback(async () => {
        if (!id) throw new ApiCallError('Missing id', null, 404);
        return getCategory(id);
    }, [id]);
    const { state } = useFetch(guardLoading ? null : fetchCategory);

    if (state.status === 'loading') return <Shell>{null}</Shell>;
    if (state.status !== 'ready') {
        return (
            <LoadFailure
                state={state}
                notFoundMessage="This category could not be found."
                backHref={CATEGORIES_ROUTES.LIST}
                backLabel="Back to Categories"
            />
        );
    }

    return <EditCategoryView category={state.data} />;
}

export default function EditCategoryPage() {
    return (
        <Suspense fallback={null}>
            <EditCategoryPageInner />
        </Suspense>
    );
}
