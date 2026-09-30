import Link from 'next/link';

import { Shell } from '@/components/shell';

interface LoadFailureProps {
    state: { status: 'not-found' } | { status: 'error'; message: string };
    /** e.g. "This user could not be found." */
    notFoundMessage: string;
    backHref: string;
    backLabel: string;
}

/** The not-found / error screen for a page whose `useFetch` did not succeed. */
export function LoadFailure({ state, notFoundMessage, backHref, backLabel }: LoadFailureProps) {
    return (
        <Shell>
            <div className="p-6 text-center text-sm text-[var(--neutral-600)]">
                {state.status === 'not-found' ? notFoundMessage : state.message}{' '}
                <Link href={backHref} className="underline">
                    {backLabel}
                </Link>
            </div>
        </Shell>
    );
}
