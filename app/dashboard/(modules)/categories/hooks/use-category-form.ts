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
import { CATEGORIES_ROUTES } from '@/lib/routes';
import { resolveBackUrl } from '@/lib/utils/resolve-back-url';

import { createCategoryAction, updateCategoryAction } from '../_lib/actions';
import type { Category } from '../_lib/api';
import {
    categorySchema,
    type CategoryFormData,
    type CategoryFormInput,
} from '../_lib/schema';

interface UseCategoryFormArgs {
    /** Omitted on /new — presence switches the hook into edit mode. */
    category?: Category;
}

interface UseCategoryFormResult {
    methods: UseFormReturn<CategoryFormInput, unknown, CategoryFormData>;
    onSubmit: SubmitHandler<CategoryFormData>;
    isSubmitting: boolean;
    isEdit: boolean;
}

function toFormDefaults(category?: Category): CategoryFormInput {
    return {
        name: category?.name ?? '',
        description: category?.description ?? '',
        isActive: category?.isActive ?? true,
        isSaveAndClose: false,
    };
}

export function useCategoryForm({
    category,
}: UseCategoryFormArgs): UseCategoryFormResult {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const isEdit = category !== undefined;

    const methods = useForm<CategoryFormInput, unknown, CategoryFormData>({
        resolver: zodResolver(categorySchema),
        mode: 'onBlur',
        defaultValues: toFormDefaults(category),
    });

    const onSubmit: SubmitHandler<CategoryFormData> = (values) => {
        startTransition(async () => {
            const result = category
                ? await updateCategoryAction(category.id, values)
                : await createCategoryAction(values);

            if (!result.ok) {
                toast.error(result.message);
                methods.setError('root', { message: result.message });
                return;
            }

            toast.success(
                isEdit
                    ? `${result.data.name} has been updated successfully.`
                    : `${result.data.name} has been added successfully.`,
            );

            if (!isEdit || values.isSaveAndClose) {
                router.push(
                    resolveBackUrl(CATEGORIES_ROUTES.LIST, searchParams),
                );
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
