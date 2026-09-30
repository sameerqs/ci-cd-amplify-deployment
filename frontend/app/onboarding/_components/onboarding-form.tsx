'use client';

import { FormProvider } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

import { useOnboardingForm } from '../hooks/use-onboarding-form';
import { ConsentCard } from './consent-card';

export function OnboardingForm() {
    const { methods, onSubmit, isSubmitting, isLocked, hint } =
        useOnboardingForm();
    const {
        setValue,
        watch,
        formState: { errors },
    } = methods;

    const ageConfirmed = watch('ageConfirmed');
    const betaAccepted = watch('betaDisclaimerAccepted');

    return (
        <FormProvider {...methods}>
            <form
                onSubmit={methods.handleSubmit(onSubmit)}
                className="flex min-h-svh flex-col bg-background"
            >
                <div className="flex-1 px-7 pt-4">
                    <div className="mx-auto w-full max-w-[420px]">
                        <h1 className="font-heading text-[29px] leading-[1.1]">
                            Before we start
                        </h1>
                        <p className="mt-3 text-[15px] leading-[1.6] text-[var(--neutral-700)]">
                            pet2text is a place to talk something through and
                            write it down. Two small things to agree to first.
                        </p>

                        <div className="mt-5 flex flex-col gap-3">
                            <ConsentCard
                                tone="does"
                                heading="What it does"
                                body="Asks about your pet and what you noticed, holds onto the photos and files you add, and helps you put it into your own words."
                            />
                            <ConsentCard
                                tone="doesnt"
                                heading="What it doesn't do"
                                body="No diagnoses, no advice, no reading of your bill, no opinion on whether a charge is fair or how urgent something is. Those belong to your vet."
                            />
                        </div>

                        <div className="mt-5">
                            <label className="flex cursor-pointer items-start gap-3.5 px-1 py-3.5">
                                <Checkbox
                                    checked={ageConfirmed === true}
                                    onCheckedChange={(v) =>
                                        setValue('ageConfirmed', v === true, {
                                            shouldValidate: true,
                                        })
                                    }
                                    className="size-6 shrink-0"
                                />
                                <span className="text-[14.5px] leading-[1.5]">
                                    I&apos;m 18 or older.
                                </span>
                            </label>
                            <label className="flex cursor-pointer items-start gap-3.5 px-1 py-3.5">
                                <Checkbox
                                    checked={betaAccepted === true}
                                    onCheckedChange={(v) =>
                                        setValue(
                                            'betaDisclaimerAccepted',
                                            v === true,
                                            { shouldValidate: true },
                                        )
                                    }
                                    className="size-6 shrink-0"
                                />
                                <span className="text-[14.5px] leading-[1.5]">
                                    I understand this is a beta for
                                    documentation, not veterinary care.
                                </span>
                            </label>
                        </div>

                        {errors.root?.message ? (
                            <p
                                className="mt-2 text-sm text-destructive"
                                role="alert"
                            >
                                {errors.root.message}
                            </p>
                        ) : null}
                    </div>
                </div>

                <div className="px-7 pb-9 pt-3">
                    <div className="mx-auto w-full max-w-[420px]">
                        <Button
                            type="submit"
                            className="min-h-[52px] w-full text-[16px]"
                            disabled={isLocked || isSubmitting}
                        >
                            {isSubmitting ? 'Saving…' : 'Continue'}
                        </Button>
                        <p className="mt-3 text-center text-[11.5px] text-[var(--neutral-600)]">
                            {hint}
                        </p>
                    </div>
                </div>
            </form>
        </FormProvider>
    );
}
