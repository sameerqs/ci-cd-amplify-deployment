'use client';

import { FormProvider } from 'react-hook-form';

import {
    FormFooter,
    FormInputEmail,
} from '@/components/custom';
import CustomCard from '@/components/custom/CustomCard';
import { FormGuard } from '@/components/form-guard';
import { CardDescription, CardTitle } from '@/components/ui/card';
import { USERS_ROUTES } from '@/lib/routes';

import { useInviteUserForm } from '../hooks/use-invite-user-form';

export function InviteUserForm() {
    const { methods, onSubmit, isSubmitting } = useInviteUserForm();
    const { isDirty } = methods.formState;

    return (
        <FormProvider {...methods}>
            <FormGuard isDirty={isDirty} enabled={!isSubmitting}>
            <form
                onSubmit={methods.handleSubmit(onSubmit)}
                className="flex flex-col gap-5"
            >
                <div>
                    <CardTitle>Invite A Customer</CardTitle>
                    <CardDescription className="mt-1">
                        Send an invitation to a customer. They will sign in with
                        a secure email link.
                    </CardDescription>
                </div>

                <CustomCard heading="Account">
                    <input
                        type="hidden"
                        {...methods.register('isSaveAndClose')}
                    />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormInputEmail
                            name="email"
                            label="Email Address"
                            placeholder="email@example.com"
                            isRequired

                        />
                    </div>
                </CustomCard>

                <FormFooter
                    isSubmitting={isSubmitting}
                    cancelRedirectUrl={USERS_ROUTES.LIST}
                    showSaveAndCloseButton={false}
                    saveLabel="Invite"
                    saveSubmittingLabel="Inviting..."
                />
            </form>
            </FormGuard>
        </FormProvider>
    );
}
