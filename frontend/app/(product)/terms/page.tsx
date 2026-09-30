import Link from 'next/link';

import { PRODUCT_ROUTES } from '@/lib/routes';

import { BackLink } from '../_components/back-link';

const DOES = [
    'Asks about your pet and what you noticed.',
    'Holds onto the photos and files you add, without reading what is in them.',
    'Helps you put what happened into your own words, so the next vet visit starts from something clear.',
];

const DOES_NOT = [
    'No diagnoses.',
    'No advice on what to do next.',
    'No reading of your bill, and no opinion on whether a charge is fair.',
    'No view on how urgent something is.',
];

export default function TermsPage() {
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-10 pt-1">
            <div className="mx-auto w-full max-w-[560px]">
                <BackLink href={PRODUCT_ROUTES.ACCOUNT} label="Account" />
                <h1 className="font-heading text-[26px] leading-tight">
                    Terms &amp; what this app isn&apos;t
                </h1>
                <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[var(--neutral-600)]">
                    pet2text is a place to talk something through and write it down.
                    It is documentation, not veterinary care.
                </p>

                <section className="mt-6 rounded-[22px] border border-border bg-card p-5">
                    <h2 className="font-heading text-[16px]">What it does</h2>
                    <ul className="mt-3 flex flex-col gap-2">
                        {DOES.map((line) => (
                            <li
                                key={line}
                                className="text-[13.5px] leading-[1.55] text-foreground"
                            >
                                {line}
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="mt-3 rounded-[22px] border border-border bg-card p-5">
                    <h2 className="font-heading text-[16px]">What it doesn&apos;t do</h2>
                    <ul className="mt-3 flex flex-col gap-2">
                        {DOES_NOT.map((line) => (
                            <li
                                key={line}
                                className="text-[13.5px] leading-[1.55] text-foreground"
                            >
                                {line}
                            </li>
                        ))}
                    </ul>
                    <p className="mt-4 text-[13px] leading-[1.55] text-[var(--neutral-600)]">
                        Those belong to your vet. If you believe your pet is in an
                        emergency, contact a vet or an emergency clinic directly.
                    </p>
                </section>

                <section className="mt-3 rounded-[22px] border border-border bg-card p-5">
                    <h2 className="font-heading text-[16px]">Your information</h2>
                    <p className="mt-3 text-[13.5px] leading-[1.55] text-foreground">
                        Nothing you write is shared with anyone else. Nothing reaches a
                        pet&apos;s profile until you confirm it. Archiving a pet hides
                        them and their chat without deleting anything, and you can bring
                        them back from Account at any time.
                    </p>
                </section>

                <p className="mt-6 text-[12px] leading-[1.55] text-[var(--neutral-600)]">
                    This is a beta. Features may change.{' '}
                    <Link
                        href={PRODUCT_ROUTES.ACCOUNT}
                        className="text-primary underline underline-offset-2"
                    >
                        Back to Account
                    </Link>
                </p>
            </div>
        </div>
    );
}
