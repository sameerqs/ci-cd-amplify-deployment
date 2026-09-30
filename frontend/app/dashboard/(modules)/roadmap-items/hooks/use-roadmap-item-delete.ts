'use client';

import { useCallback, useState, useTransition } from 'react';

import { toast } from '@/lib/toast';
import { entityDeletedMessage } from '@/lib/utils/success-messages';

import { deleteRoadmapItemAction } from '../_lib/actions';
import type { RoadmapItem } from '../_lib/api';

interface UseRoadmapItemDeleteResult {
    pendingDelete: RoadmapItem | null;
    isDeleting: boolean;
    requestDelete: (item: RoadmapItem) => void;
    cancelDelete: (open: boolean) => void;
    confirmDelete: () => void;
}

export function useRoadmapItemDelete(onMutated: () => void): UseRoadmapItemDeleteResult {
    const [pendingDelete, setPendingDelete] = useState<RoadmapItem | null>(null);
    const [isDeleting, startTransition] = useTransition();

    const requestDelete = useCallback((item: RoadmapItem) => {
        setPendingDelete(item);
    }, []);

    const cancelDelete = useCallback(
        (open: boolean) => {
            if (!open && !isDeleting) setPendingDelete(null);
        },
        [isDeleting],
    );

    const confirmDelete = useCallback(() => {
        const item = pendingDelete;
        if (!item) return;
        startTransition(async () => {
            const result = await deleteRoadmapItemAction(item.id);
            if (!result.ok) {
                toast.error(result.message);
                return;
            }
            toast.success(entityDeletedMessage(item.title));
            setPendingDelete(null);
            onMutated();
        });
    }, [pendingDelete, onMutated]);

    return {
        pendingDelete,
        isDeleting,
        requestDelete,
        cancelDelete,
        confirmDelete,
    };
}
