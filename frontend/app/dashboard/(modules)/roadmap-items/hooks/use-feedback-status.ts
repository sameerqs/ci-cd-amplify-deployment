'use client';

import { useCallback, useState, useTransition } from 'react';

import type { FeedbackStatus } from '@/lib/enum';
import { toast } from '@/lib/toast';

import { updateFeedbackStatusAction } from '../_lib/actions';

interface UseFeedbackStatusResult {
    isBusy: (voteId: string) => boolean;
    updateStatus: (itemId: string, voteId: string, status: FeedbackStatus) => void;
}

/** Admin review action on a single feedback row — status only, applies straight away. */
export function useFeedbackStatus(onMutated: () => void): UseFeedbackStatusResult {
    const [busyId, setBusyId] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    const isBusy = useCallback((voteId: string) => busyId === voteId, [busyId]);

    const updateStatus = useCallback(
        (itemId: string, voteId: string, status: FeedbackStatus) => {
            setBusyId(voteId);
            startTransition(async () => {
                const result = await updateFeedbackStatusAction(itemId, voteId, status);
                setBusyId(null);
                if (!result.ok) {
                    toast.error(result.message);
                    return;
                }
                toast.success('Feedback status updated.');
                onMutated();
            });
        },
        [onMutated],
    );

    return { isBusy, updateStatus };
}
