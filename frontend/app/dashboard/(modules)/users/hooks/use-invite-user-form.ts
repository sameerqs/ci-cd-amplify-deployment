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
import { invitationSentTo } from '@/lib/utils/success-messages';

import { inviteUserAction } from '../_lib/actions';
import {
    inviteUserSchema,
    type InviteUserFormData,
    type InviteUserFormInput,
} from '../_lib/schema';

interface UseInviteUserFormResult {
    methods: UseFormReturn<InviteUserFormInput, unknown, InviteUserFormData>;
    onSubmit: SubmitHandler<InviteUserFormData>;
    isSubmitting: boolean;
}

const EMPTY_DEFAULTS: InviteUserFormInput = {
    email: '',
    isSaveAndClose: false,
};

/**
 * Internal Users — invite form hook.
 *
 * Invite always returns to the internal users list afterwards. There is no
 * password anywhere: the invitee is an approved customer and signs in
 * through the same one-screen link everyone else uses.
 */
export function useInviteUserForm(): UseInviteUserFormResult {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const methods = useForm<InviteUserFormInput, unknown, InviteUserFormData>({
        resolver: zodResolver(inviteUserSchema),
        mode: 'onBlur',
        defaultValues: EMPTY_DEFAULTS,
    });

    const onSubmit: SubmitHandler<InviteUserFormData> = (values) => {
        startTransition(async () => {
            const result = await inviteUserAction(values);

            if (!result.ok) {
                toast.error(result.message);
                methods.setError('root', { message: result.message });
                return;
            }

            if (result.warning) {
                toast.success('User has been created successfully.');
                toast.warning(result.warning.message, {
                    description: result.warning.heading || undefined,
                });
            } else {
                toast.success(invitationSentTo(result.data.email));
            }
            methods.reset(values);
            router.push(resolveBackUrl(USERS_ROUTES.LIST, searchParams));
        });
    };

    return { methods, onSubmit, isSubmitting: isPending };
}
