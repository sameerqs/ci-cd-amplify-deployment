'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useTransition } from 'react';
import {
    useForm,
    type SubmitHandler,
    type UseFormReturn,
} from 'react-hook-form';

import { requestMagicLinkAction } from '@/app/(auth)/_lib/actions';
import {
    magicLinkSchema,
    type MagicLinkFormData,
    type MagicLinkFormInput,
} from '../login.schema';

interface UseMagicLinkFormResult {
    methods: UseFormReturn<MagicLinkFormInput, unknown, MagicLinkFormData>;
    onSubmit: SubmitHandler<MagicLinkFormData>;
    isSubmitting: boolean;
    /** The address we told the user we sent to; null until a send succeeds. */
    sentTo: string | null;
    reset: () => void;
}

export function useMagicLinkForm(): UseMagicLinkFormResult {
    const [isPending, startTransition] = useTransition();
    const [sentTo, setSentTo] = useState<string | null>(null);

    const methods = useForm<MagicLinkFormInput, unknown, MagicLinkFormData>({
        resolver: zodResolver(magicLinkSchema),
        mode: 'onBlur',
        defaultValues: { email: '' },
    });

    const onSubmit: SubmitHandler<MagicLinkFormData> = (values) => {
        startTransition(async () => {
            const result = await requestMagicLinkAction(values);
            if (!result.ok) {
                methods.setError('root', { message: result.message });
                return;
            }

            setSentTo(values.email);
        });
    };

    const reset = () => {
        setSentTo(null);
        methods.reset({ email: '' });
    };

    return { methods, onSubmit, isSubmitting: isPending, sentTo, reset };
}
