'use client';

import { FormProvider } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PRODUCT_ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';

import { BackLink } from '../../../_components/back-link';
import { SPECIES_LABEL, SPECIES_ORDER } from '../../../_lib/types';
import { usePetForm } from '../hooks/use-pet-form';

export function PetForm() {
    const {
        methods,
        onSubmit,
        isSubmitting,
        species,
        pickSpecies,
        submitLabel,
    } = usePetForm();
    const {
        register,
        formState: { errors },
    } = methods;

    return (
        <FormProvider {...methods}>
            <form
                onSubmit={methods.handleSubmit(onSubmit)}
                className="flex min-h-0 flex-1 flex-col"
            >
                <div className="px-6 pb-2.5 pt-1">
                    <div className="mx-auto w-full max-w-[460px]">
                        <BackLink href={PRODUCT_ROUTES.CHAT} label="Chat" />
                        <h1 className="font-heading text-[26px] leading-tight">
                            Who are we talking about?
                        </h1>
                        <p className="mt-1 text-[13.5px] leading-[1.5] text-[var(--neutral-700)]">
                            Just enough to keep their chats separate. You can add
                            more pets later.
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-1">
                    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-3.5">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="name" className="text-[12.5px]">
                                Name
                            </Label>
                            <Input
                                id="name"
                                placeholder="Milo"
                                autoFocus
                                maxLength={50}
                                aria-invalid={!!errors.name}
                                className="min-h-12 text-[15.5px]"
                                {...register('name')}
                            />
                            {errors.name?.message ? (
                                <p
                                    className="text-sm text-destructive"
                                    role="alert"
                                >
                                    {errors.name.message}
                                </p>
                            ) : null}
                        </div>

                        <fieldset>
                            <legend className="mb-2 text-[12.5px] font-semibold">
                                Species
                            </legend>
                            <div className="flex gap-2">
                                {SPECIES_ORDER.map((value) => {
                                    const selected = species === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => pickSpecies(value)}
                                            aria-pressed={selected}
                                            className={cn(
                                                'min-h-11 flex-1 rounded-full border px-4 text-[14.5px] transition-colors',
                                                selected
                                                    ? 'border-transparent bg-[var(--accent-200)] font-semibold text-[var(--accent-900)]'
                                                    : 'border-[var(--neutral-300)] bg-card text-[var(--neutral-700)] hover:border-ring/50',
                                            )}
                                        >
                                            {SPECIES_LABEL[value]}
                                        </button>
                                    );
                                })}
                            </div>
                        </fieldset>

                        <div className="flex gap-2.5">
                            <div className="flex flex-1 flex-col gap-2">
                                <Label htmlFor="age" className="text-[12.5px]">
                                    Age
                                </Label>
                                <Input
                                    id="age"
                                    placeholder="7 yrs"
                                    maxLength={20}
                                    className="min-h-12 text-[15.5px]"
                                    {...register('age')}
                                />
                            </div>
                            <div className="flex flex-1 flex-col gap-2">
                                <Label
                                    htmlFor="weight"
                                    className="text-[12.5px]"
                                >
                                    Weight{' '}
                                    <span className="font-normal text-[var(--neutral-600)]">
                                        optional
                                    </span>
                                </Label>
                                <Input
                                    id="weight"
                                    placeholder="11 kg"
                                    maxLength={20}
                                    className="min-h-12 text-[15.5px]"
                                    {...register('weight')}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="breed" className="text-[12.5px]">
                                Breed{' '}
                                <span className="font-normal text-[var(--neutral-600)]">
                                    optional
                                </span>
                            </Label>
                            <Input
                                id="breed"
                                placeholder="Beagle mix"
                                maxLength={50}
                                className="min-h-12 text-[15.5px]"
                                {...register('breed')}
                            />
                        </div>

                        <p className="rounded-[20px] bg-[var(--accent-2-100)] px-4 py-3.5 text-[12.5px] leading-[1.55] text-[var(--accent-2-900)]">
                            Nothing here is shared with anyone. You can edit or
                            archive a pet from Account any time.
                        </p>
                    </div>
                </div>

                <div className="px-6 pb-7 pt-2.5">
                    <div className="mx-auto w-full max-w-[460px]">
                        <Button
                            type="submit"
                            className="min-h-[52px] w-full text-[16px]"
                            disabled={isSubmitting}
                        >
                            {submitLabel}
                        </Button>
                    </div>
                </div>
            </form>
        </FormProvider>
    );
}
