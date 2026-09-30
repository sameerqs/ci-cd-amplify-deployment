'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';

import { LoadFailure } from '@/components/load-failure';
import { Shell } from '@/components/shell';
import { useRequireSuperAdmin } from '@/lib/auth/use-auth-guard';
import { useFetch } from '@/lib/hooks/use-fetch';
import { ROADMAP_ROUTES } from '@/lib/routes';
import { ApiCallError } from '@/lib/utils/api-utils';

import {
    getRoadmapItem,
    listRoadmapItemFeedback,
    type RoadmapFeedback,
    type RoadmapItem,
} from '../_lib/api';
import { FeedbackView } from './feedback-view';

interface FeedbackPageData {
    item: RoadmapItem;
    feedback: RoadmapFeedback[];
}

/**
 * Feedback review for a single roadmap item — Super Admin only. Owners never
 * see this: once a reason is sent on What's Coming it becomes admin-only
 * triage state, not something the submitter can re-read or re-edit.
 */
function RoadmapItemFeedbackPageInner() {
    const { loading: guardLoading } = useRequireSuperAdmin();
    const id = useSearchParams().get('id');
    const fetchData = useCallback(async (): Promise<FeedbackPageData> => {
        if (!id) throw new ApiCallError('Missing id', null, 404);
        const [item, feedback] = await Promise.all([
            getRoadmapItem(id),
            listRoadmapItemFeedback(id),
        ]);
        return { item, feedback };
    }, [id]);
    const { state, refetch } = useFetch(guardLoading ? null : fetchData);

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

    return (
        <FeedbackView
            item={state.data.item}
            feedback={state.data.feedback}
            onMutated={refetch}
        />
    );
}

export default function RoadmapItemFeedbackPage() {
    return (
        <Suspense fallback={null}>
            <RoadmapItemFeedbackPageInner />
        </Suspense>
    );
}
