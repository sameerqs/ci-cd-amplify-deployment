'use client';

import { FormProvider } from 'react-hook-form';

import {
    FormCheckbox,
    FormFooter,
    FormLabel,
} from '@/components/custom';
import CustomCard from '@/components/custom/CustomCard';
import { FormGuard } from '@/components/form-guard';
import { Input } from '@/components/ui/input';
import { USERS_ROUTES } from '@/lib/routes';

import type { User } from '../_lib/api';
import { useEditUserForm } from '../hooks/use-edit-user-form';

interface EditUserFormProps {
    user: User;
}

export function EditUserForm({ user }: EditUserFormProps) {
    const { methods, onSubmit, isSubmitting } = useEditUserForm({ user });
    const { isDirty } = methods.formState;

    return (
        <>
            <FormProvider {...methods}>
                <FormGuard isDirty={isDirty} enabled={!isSubmitting}>
                <form
                    onSubmit={methods.handleSubmit(onSubmit)}
                    className="flex flex-col gap-5"
                >
                    <input
                        type="hidden"
                        {...methods.register('isSaveAndClose')}
                    />
                    <CustomCard heading="Status">
                        <FormCheckbox
                            name="isActive"
                            label="Account is active"
                            helper="Deactivating an account invalidates all of its existing sessions and prevents future logins until reactivated."
                        />
                    </CustomCard>

                    <CustomCard heading="Account">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-1">
                                <FormLabel htmlFor="user-email">
                                    Email Address
                                </FormLabel>
                                <Input
                                    id="user-email"
                                    type="email"
                                    value={user.email}
                                    readOnly
                                    disabled
                                    className="disabled:bg-muted"
                                />
                            </div>
                        </div>
                    </CustomCard>

                    <FormFooter
                        isSubmitting={isSubmitting}
                        cancelRedirectUrl={USERS_ROUTES.LIST}
                        showDeleteButton
                        recordId={user.id}
                        deleteApiEndpoint="users"
                        itemType="user"
                        redirectAfterDelete={USERS_ROUTES.LIST}
                    />
                </form>
                </FormGuard>
            </FormProvider>
        </>
    );
}
