'use client';

import { FormProvider } from 'react-hook-form';

import {
    FormFooter,
    FormInput,
    FormSwitch,
    FormTextarea,
} from '@/components/custom';
import CustomCard from '@/components/custom/CustomCard';
import { FormGuard } from '@/components/form-guard';
import { CardDescription, CardTitle } from '@/components/ui/card';
import { CATEGORIES_ROUTES } from '@/lib/routes';

import type { Category } from '../_lib/api';
import { useCategoryForm } from '../hooks/use-category-form';

interface CategoryFormProps {
    category?: Category;
}

export function CategoryForm({ category }: CategoryFormProps) {
    const { methods, onSubmit, isSubmitting, isEdit } = useCategoryForm({
        category,
    });
    const { isDirty } = methods.formState;

    return (
        <FormProvider {...methods}>
            <FormGuard isDirty={isDirty} enabled={!isSubmitting}>
                <form
                    onSubmit={methods.handleSubmit(onSubmit)}
                    className="flex flex-col gap-5"
                >
                    <div>
                        <CardTitle>
                            {isEdit ? 'Edit Category' : 'Add A Category'}
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Categories label what an entry is about. Deactivate
                            one to stop offering it without losing the entries
                            already filed under it.
                        </CardDescription>
                    </div>

                    <CustomCard heading="Details">
                        <input
                            type="hidden"
                            {...methods.register('isSaveAndClose')}
                        />
                        <div className="grid grid-cols-1 gap-4">
                            <FormInput
                                name="name"
                                label="Name"
                                placeholder="e.g. Vet visit"
                                isRequired
                                autoFocus
                                maxLength={50}
                            />
                            <FormTextarea
                                name="description"
                                label="Description"
                                placeholder="What belongs in this category?"
                                maxLength={255}
                                rows={3}
                            />
                            <FormSwitch name="isActive" label="Active" />
                        </div>
                    </CustomCard>

                    <FormFooter
                        isSubmitting={isSubmitting}
                        cancelRedirectUrl={CATEGORIES_ROUTES.LIST}
                        showSaveAndCloseButton={isEdit}
                        saveLabel={isEdit ? 'Save' : 'Add category'}
                    />
                </form>
            </FormGuard>
        </FormProvider>
    );
}
