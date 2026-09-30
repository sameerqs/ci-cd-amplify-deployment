'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
    useForm,
    type SubmitHandler,
    type UseFormReturn,
} from 'react-hook-form';
import { toast } from "@/lib/toast";

import { USERS_ROUTES } from '@/lib/routes';
import { resolveBackUrl } from '@/lib/utils/resolve-back-url';
import { SUCCESS_MESSAGES } from '@/lib/utils/success-messages';

import { updateUserAction } from '../_lib/actions';
import type { User } from '../_lib/api';
import {
    updateUserSchema,
    type UpdateUserFormData,
    type UpdateUserFormInput,
} from '../_lib/schema';

interface UseEditUserFormArgs {
    user: User;
}

interface UseEditUserFormResult {
    methods: UseFormReturn<UpdateUserFormInput, unknown, UpdateUserFormData>;
    onSubmit: SubmitHandler<UpdateUserFormData>;
    isSubmitting: boolean;
}

function toFormDefaults(user: User): UpdateUserFormInput {
    return { isActive: user.isActive, isSaveAndClose: false };
}

/**
 * Internal Users — edit form hook. Email is intentionally not editable
 * here; admins use Change Email on the edit form (magic-link flow).
 */
export function useEditUserForm({
    user,
}: UseEditUserFormArgs): UseEditUserFormResult {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const methods = useForm<UpdateUserFormInput, unknown, UpdateUserFormData>({
        resolver: zodResolver(updateUserSchema),
        mode: 'onBlur',
        defaultValues: toFormDefaults(user),
    });

    const onSubmit: SubmitHandler<UpdateUserFormData> = (values) => {
        startTransition(async () => {
            const result = await updateUserAction(user.id, values);

            if (!result.ok) {
                toast.error(result.message);
                methods.setError('root', { message: result.message });
                return;
            }

            toast.success(SUCCESS_MESSAGES.USER_UPDATED);

            if (values.isSaveAndClose) {
                router.push(resolveBackUrl(USERS_ROUTES.LIST, searchParams));
                return;
            }

            methods.reset({
                ...toFormDefaults(result.data),
                isSaveAndClose: false,
            });
        });
    };

    return { methods, onSubmit, isSubmitting: isPending };
}
