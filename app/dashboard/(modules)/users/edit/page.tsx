'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';

import { LoadFailure } from '@/components/load-failure';
import { Shell } from '@/components/shell';
import { useRequireSuperAdmin } from '@/lib/auth/use-auth-guard';
import { useFetch } from '@/lib/hooks/use-fetch';
import { USERS_ROUTES } from '@/lib/routes';
import { ApiCallError } from '@/lib/utils/api-utils';

import { getUser } from '../_lib/api';
import { EditUserView } from './edit-view';

/**
 * Internal Users — Edit page. The id comes from `?id=` (a static export
 * cannot pre-render one page per database id), and the user is fetched
 * client-side once the guard has resolved.
 */
function EditUserPageInner() {
    const { loading: guardLoading } = useRequireSuperAdmin();
    const id = useSearchParams().get('id');
    const fetchUser = useCallback(async () => {
        if (!id) throw new ApiCallError('Missing id', null, 404);
        return getUser(id);
    }, [id]);
    const { state } = useFetch(guardLoading ? null : fetchUser);

    if (state.status === 'loading') return <Shell>{null}</Shell>;
    if (state.status !== 'ready') {
        return (
            <LoadFailure
                state={state}
                notFoundMessage="This user could not be found."
                backHref={USERS_ROUTES.LIST}
                backLabel="Back to Users"
            />
        );
    }

    return <EditUserView user={state.data} />;
}

export default function EditUserPage() {
    return (
        <Suspense fallback={null}>
            <EditUserPageInner />
        </Suspense>
    );
}
