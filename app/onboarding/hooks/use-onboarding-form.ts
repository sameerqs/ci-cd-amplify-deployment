'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useRef, useTransition } from 'react';
import {
    useForm,
    type SubmitHandler,
    type UseFormReturn,
} from 'react-hook-form';

import { useAuth } from '@/app/context/auth-context';
import { toast } from '@/lib/toast';
import { PRODUCT_ROUTES } from '@/lib/routes';

import { completeOnboardingAction } from '../_lib/actions';
import {
    onboardingSchema,
    type OnboardingFormData,
    type OnboardingFormInput,
} from '../_lib/schema';

interface UseOnboardingFormResult {
    methods: UseFormReturn<OnboardingFormInput, unknown, OnboardingFormData>;
    onSubmit: SubmitHandler<OnboardingFormData>;
    isSubmitting: boolean;
    /** True while either box is unticked — drives the disabled Continue button. */
    isLocked: boolean;
    hint: string;
}

export function useOnboardingForm(): UseOnboardingFormResult {
    const router = useRouter();
    const { adoptSession } = useAuth();
    const [isPending, startTransition] = useTransition();
    // why: `isPending` only flips once React has entered the transition, so a
    // second click landing in the same tick got through the disabled button and
    // posted the consent twice. A ref closes that window synchronously.
    const submitting = useRef(false);

    const methods = useForm<OnboardingFormInput, unknown, OnboardingFormData>({
        resolver: zodResolver(onboardingSchema),
        mode: 'onChange',
        defaultValues: {
            ageConfirmed: false,
            betaDisclaimerAccepted: false,
        },
    });

    const age = methods.watch('ageConfirmed');
    const beta = methods.watch('betaDisclaimerAccepted');
    const isLocked = !age || !beta;

    const onSubmit: SubmitHandler<OnboardingFormData> = (values) => {
        if (submitting.current) return;
        submitting.current = true;
        startTransition(async () => {
            try {
                const result = await completeOnboardingAction(values);
                if (!result.ok) {
                    submitting.current = false;
                    toast.error(result.message);
                    methods.setError('root', { message: result.message });
                    return;
                }
                // why: the client provider still holds the identity from before
                // the consent, and the destination's own guard reads the server's
                // copy. Catch the client up first, then navigate once -- the
                // previous `replace` followed immediately by `refresh` re-rendered
                // the gate this submission had just cleared and cancelled the
                // navigation with it, which is why nothing appeared to happen.
                await adoptSession();
                router.replace(PRODUCT_ROUTES.CHAT);
            } catch (error: unknown) {
                submitting.current = false;
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Unable to save your answers. Please try again.';
                toast.error(message);
                methods.setError('root', { message });
            }
        });
    };

    return {
        methods,
        onSubmit,
        isSubmitting: isPending,
        isLocked,
        hint: isLocked
            ? 'Tick both to continue.'
            : 'Thanks — this is asked once.',
    };
}
