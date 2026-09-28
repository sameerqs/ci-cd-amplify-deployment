import { Suspense } from 'react';

import { EntryLayout } from '@/app/(auth)/entry-layout';
import { FullPageSpinner } from '@/components/ui/spinner';

import { VerifyView } from './verify-view';

/**
 * Landing target for a sign-in link. Suspense-wrapped because the view reads
 * the token from useSearchParams.
 */
export default function VerifyMagicLinkPage() {
    return (
        <EntryLayout>
            <Suspense fallback={<FullPageSpinner text="Signing you in..." />}>
                <VerifyView />
            </Suspense>
        </EntryLayout>
    );
}
