'use client';

import Link from 'next/link';

import { BrandMark } from '@/components/product/brand-mark';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AUTH_ROUTES } from '@/lib/routes';

import { useVerifyMagicLink } from './hooks/use-verify-magic-link';

export function VerifyView() {
    const { state, message } = useVerifyMagicLink();

    if (state === 'verifying') {
        return (
            <div className="flex flex-col items-start">
                <BrandMark className="mb-6" />
                <h1 className="font-heading text-[32px] leading-[1.05]">
                    Signing you in
                </h1>
                <p className="mt-3 flex items-center gap-2.5 text-[16px] leading-[1.55] text-[var(--neutral-700)]">
                    <Spinner className="size-4" />
                    One moment.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-start">
            <BrandMark className="mb-6" />
            <h1 className="font-heading text-[32px] leading-[1.05]">
                That link didn&apos;t work
            </h1>
            <p className="mt-3 text-[16px] leading-[1.55] text-[var(--neutral-700)]">
                {message}
            </p>
            <Button asChild className="mt-7 min-h-[52px] w-full text-[16px]">
                <Link href={AUTH_ROUTES.LOGIN}>Send a new link</Link>
            </Button>
        </div>
    );
}
