'use client';

import { useCallback, useState, useTransition } from 'react';

import { toast } from '@/lib/toast';
import { entityDeletedMessage } from '@/lib/utils/success-messages';

import { deleteCategoryAction } from '../_lib/actions';
import type { Category } from '../_lib/api';

interface UseCategoryDeleteResult {
    pendingDelete: Category | null;
    isDeleting: boolean;
    requestDelete: (category: Category) => void;
    cancelDelete: (open: boolean) => void;
    confirmDelete: () => void;
}

export function useCategoryDelete(onMutated: () => void): UseCategoryDeleteResult {
    const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
    const [isDeleting, startTransition] = useTransition();

    const requestDelete = useCallback((category: Category) => {
        setPendingDelete(category);
    }, []);

    const cancelDelete = useCallback(
        (open: boolean) => {
            if (!open && !isDeleting) setPendingDelete(null);
        },
        [isDeleting],
    );

    const confirmDelete = useCallback(() => {
        const category = pendingDelete;
        if (!category) return;
        startTransition(async () => {
            const result = await deleteCategoryAction(category.id);
            if (!result.ok) {
                toast.error(result.message);
                return;
            }
            toast.success(entityDeletedMessage(category.name));
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
