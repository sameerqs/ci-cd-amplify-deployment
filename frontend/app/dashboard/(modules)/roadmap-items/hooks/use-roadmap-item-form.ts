'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
    useForm,
    type SubmitHandler,
    type UseFormReturn,
} from 'react-hook-form';

import { toast } from '@/lib/toast';
import { ROADMAP_ROUTES } from '@/lib/routes';
import { resolveBackUrl } from '@/lib/utils/resolve-back-url';

import {
    createRoadmapItemAction,
    updateRoadmapItemAction,
} from '../_lib/actions';
import type { RoadmapItem } from '../_lib/api';
import {
    roadmapItemSchema,
    type RoadmapItemFormData,
    type RoadmapItemFormInput,
} from '../_lib/schema';

interface UseRoadmapItemFormArgs {
    /** Omitted on /new — presence switches the hook into edit mode. */
    item?: RoadmapItem;
}

interface UseRoadmapItemFormResult {
    methods: UseFormReturn<RoadmapItemFormInput, unknown, RoadmapItemFormData>;
    onSubmit: SubmitHandler<RoadmapItemFormData>;
    isSubmitting: boolean;
    isEdit: boolean;
}

function toFormDefaults(item?: RoadmapItem): RoadmapItemFormInput {
    return {
        title: item?.title ?? '',
        description: item?.description ?? '',
        commentPrompt: item?.commentPrompt ?? '',
        isActive: item?.isActive ?? true,
        isSaveAndClose: false,
    };
}

export function useRoadmapItemForm({
    item,
}: UseRoadmapItemFormArgs): UseRoadmapItemFormResult {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const isEdit = item !== undefined;

    const methods = useForm<
        RoadmapItemFormInput,
        unknown,
        RoadmapItemFormData
    >({
        resolver: zodResolver(roadmapItemSchema),
        mode: 'onBlur',
        defaultValues: toFormDefaults(item),
    });

    const onSubmit: SubmitHandler<RoadmapItemFormData> = (values) => {
        startTransition(async () => {
            const result = item
                ? await updateRoadmapItemAction(item.id, values)
                : await createRoadmapItemAction(values);

            if (!result.ok) {
                toast.error(result.message);
                methods.setError('root', { message: result.message });
                return;
            }

            toast.success(
                isEdit
                    ? `${result.data.title} has been updated successfully.`
                    : `${result.data.title} has been added successfully.`,
            );

            if (!isEdit || values.isSaveAndClose) {
                router.push(resolveBackUrl(ROADMAP_ROUTES.LIST, searchParams));
                return;
            }

            methods.reset({
                ...toFormDefaults(result.data),
                isSaveAndClose: false,
            });
        });
    };

    return { methods, onSubmit, isSubmitting: isPending, isEdit };
}
