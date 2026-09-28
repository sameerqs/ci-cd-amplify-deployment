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
import { ROADMAP_ROUTES } from '@/lib/routes';

import type { RoadmapItem } from '../_lib/api';
import { useRoadmapItemForm } from '../hooks/use-roadmap-item-form';

interface RoadmapItemFormProps {
    item?: RoadmapItem;
}

export function RoadmapItemForm({ item }: RoadmapItemFormProps) {
    const { methods, onSubmit, isSubmitting, isEdit } = useRoadmapItemForm({
        item,
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
                            {isEdit
                                ? 'Edit Roadmap Item'
                                : 'Add A Roadmap Item'}
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Roadmap items appear in What&apos;s Coming, where
                            users vote on what to build next. Deactivate one to
                            take it off the list without losing its votes.
                        </CardDescription>
                    </div>

                    <CustomCard heading="Details">
                        <input
                            type="hidden"
                            {...methods.register('isSaveAndClose')}
                        />
                        <div className="grid grid-cols-1 gap-4">
                            <FormInput
                                name="title"
                                label="Title"
                                placeholder="e.g. Pet Circle"
                                isRequired
                                autoFocus
                                maxLength={100}
                            />
                            <FormTextarea
                                name="description"
                                label="Description"
                                placeholder="What would this feature do?"
                                maxLength={500}
                                rows={4}
                            />
                            <FormTextarea
                                name="commentPrompt"
                                label="Comment prompt"
                                placeholder="e.g. Who would you invite?"
                                helper="Opens the owner's comment box on this card. Leave blank to use the generic prompt."
                                maxLength={200}
                                rows={2}
                            />
                            <FormSwitch name="isActive" label="Active" />
                        </div>
                    </CustomCard>

                    <FormFooter
                        isSubmitting={isSubmitting}
                        cancelRedirectUrl={ROADMAP_ROUTES.LIST}
                        showSaveAndCloseButton={isEdit}
                        saveLabel={isEdit ? 'Save' : 'Add item'}
                    />
                </form>
            </FormGuard>
        </FormProvider>
    );
}
