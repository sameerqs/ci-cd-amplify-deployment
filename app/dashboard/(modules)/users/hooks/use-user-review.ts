'use client';

import { useCallback, useState, useTransition } from 'react';

import { toast } from '@/lib/toast';

import { approveUserAction, rejectUserAction } from '../_lib/actions';
import type { User } from '../_lib/api';

interface UseUserReviewResult {
    pendingReject: User | null;
    isBusy: (id: string) => boolean;
    approve: (user: User) => void;
    requestReject: (user: User) => void;
    cancelReject: (open: boolean) => void;
    confirmReject: () => void;
}

/**
 * Users — review orchestration, the same contract the Signups screen uses:
 * Approve applies straight away (non-destructive per house style); Not Approve
 * is terminal -- the backend refuses to re-review a row once it leaves PENDING
 * -- so it goes through a confirmation first.
 */
export function useUserReview(onMutated: () => void): UseUserReviewResult {
    const [busyId, setBusyId] = useState<string | null>(null);
    const [pendingReject, setPendingReject] = useState<User | null>(null);
    const [, startTransition] = useTransition();

    const isBusy = useCallback((id: string) => busyId === id, [busyId]);

    const approve = useCallback(
        (user: User) => {
            setBusyId(user.id);
            startTransition(async () => {
                const result = await approveUserAction(user.id);
                setBusyId(null);
                if (!result.ok) {
                    toast.error(result.message);
                    return;
                }
                toast.success(`${user.email} can now sign in.`);
                if (result.warning) {
                    toast.warning(result.warning.message, {
                        description: result.warning.heading || undefined,
                    });
                }
                onMutated();
            });
        },
        [onMutated],
    );

    const requestReject = useCallback((user: User) => {
        setPendingReject(user);
    }, []);

    const cancelReject = useCallback(
        (open: boolean) => {
            if (!open && busyId === null) setPendingReject(null);
        },
        [busyId],
    );

    const confirmReject = useCallback(() => {
        const user = pendingReject;
        if (!user) return;
        setBusyId(user.id);
        startTransition(async () => {
            const result = await rejectUserAction(user.id);
            setBusyId(null);
            if (!result.ok) {
                toast.error(result.message);
                return;
            }
            toast.success(`${user.email}'s request was not approved.`);
            setPendingReject(null);
            onMutated();
        });
    }, [pendingReject, onMutated]);

    return {
        pendingReject,
        isBusy,
        approve,
        requestReject,
        cancelReject,
        confirmReject,
    };
}
