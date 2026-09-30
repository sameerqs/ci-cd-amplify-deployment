'use client';

import { FormProvider } from 'react-hook-form';

import { BrandMark } from '@/components/product/brand-mark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useMagicLinkForm } from './hooks/use-magic-link-form';

export function LoginForm() {
    const { methods, onSubmit, isSubmitting, sentTo, reset } =
        useMagicLinkForm();
    const {
        register,
        formState: { errors },
    } = methods;

    if (sentTo) {
        return (
            <div className="flex flex-col">
                <BrandMark className="mb-6" />
                <h1 className="font-heading text-[32px] leading-[1.05]">
                    Check your email
                </h1>
                <p className="mt-3 text-[16px] leading-relaxed text-[var(--neutral-700)]">
                    If {sentTo} has an approved account, a secure sign-in link is
                    on its way. It works once, and expires shortly.
                </p>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={reset}
                    className="mt-7 min-h-[52px] w-full text-[16px]"
                >
                    Use a different email
                </Button>
            </div>
        );
    }

    return (
        <FormProvider {...methods}>
            <form
                onSubmit={methods.handleSubmit(onSubmit)}
                className="flex flex-col"
            >
                <BrandMark className="mb-6" />
                <h1 className="font-heading text-[38px] leading-[1.05]">
                    pet2text
                </h1>
                <p className="mt-3.5 max-w-[270px] text-[16px] leading-[1.55] text-[var(--neutral-700)]">
                    Talk it through and write it down, so the next vet visit
                    starts from something clear.
                </p>

                <div className="mt-7 flex flex-col gap-2">
                    <Label htmlFor="email" className="text-[12.5px]">
                        Email
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        aria-invalid={!!errors.email}
                        className="min-h-[52px] text-[16px]"
                        {...register('email')}
                    />
                    {errors.email?.message ? (
                        <p className="text-sm text-destructive" role="alert">
                            {errors.email.message}
                        </p>
                    ) : null}
                </div>

                {errors.root?.message ? (
                    <p className="mt-3 text-sm text-destructive" role="alert">
                        {errors.root.message}
                    </p>
                ) : null}

                <Button
                    type="submit"
                    className="mt-3.5 min-h-[52px] w-full text-[16px]"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Sending…' : 'Send me a secure link'}
                </Button>

                <p className="mt-4.5 text-[12.5px] leading-[1.5] text-[var(--neutral-600)]">
                    No password to remember. We&apos;ll email you a link that
                    signs you in.
                </p>
            </form>
        </FormProvider>
    );
}
