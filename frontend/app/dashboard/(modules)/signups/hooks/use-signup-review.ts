'use client';

import { useCallback, useState, useTransition } from 'react';

import { toast } from '@/lib/toast';

import { approveSignupAction, rejectSignupAction } from '../_lib/actions';
import type { Signup } from '../_lib/api';

interface UseSignupReviewResult {
    pendingReject: Signup | null;
    isBusy: (id: string) => boolean;
    isRejecting: boolean;
    approve: (signup: Signup) => void;
    requestReject: (signup: Signup) => void;
    cancelReject: (open: boolean) => void;
    confirmReject: () => void;
}

/**
 * Signups — review orchestration. Approve applies straight away (non-destructive
 * per house style); Reject is terminal — the backend refuses to re-review a row
 * once it leaves PENDING — so it goes through a confirmation first.
 */
export function useSignupReview(onMutated: () => void): UseSignupReviewResult {
    const [busyId, setBusyId] = useState<string | null>(null);
    const [pendingReject, setPendingReject] = useState<Signup | null>(null);
    const [isPending, startTransition] = useTransition();

    const isBusy = useCallback((id: string) => busyId === id, [busyId]);

    const approve = useCallback(
        (signup: Signup) => {
            setBusyId(signup.id);
            startTransition(async () => {
                const result = await approveSignupAction(signup.id);
                setBusyId(null);
                if (!result.ok) {
                    toast.error(result.message);
                    return;
                }
                toast.success(`${signup.displayName} can now sign in.`);
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

    const requestReject = useCallback((signup: Signup) => {
        setPendingReject(signup);
    }, []);

    const cancelReject = useCallback(
        (open: boolean) => {
            if (!open && busyId === null) setPendingReject(null);
        },
        [busyId],
    );

    const confirmReject = useCallback(() => {
        const signup = pendingReject;
        if (!signup) return;
        setBusyId(signup.id);
        startTransition(async () => {
            const result = await rejectSignupAction(signup.id);
            setBusyId(null);
            if (!result.ok) {
                toast.error(result.message);
                return;
            }
            toast.success(`${signup.displayName}'s request has been rejected.`);
            setPendingReject(null);
            onMutated();
        });
    }, [pendingReject, onMutated]);

    return {
        pendingReject,
        isBusy,
        isRejecting: isPending,
        approve,
        requestReject,
        cancelReject,
        confirmReject,
    };
}
