'use client';

import { useAuthGuard } from '@/app/(auth)/hooks/use-auth-guard';

/**
 * Ends the session once when the sign-in screen was reached after the API
 * rejected it.
 *
 * It renders no spinner and no branch of its own: turning an already-signed-in
 * visitor away is the server's job now (see `login/page.tsx`), and this is only
 * the side effect the server cannot perform from a render. `expired` arrives as
 * a prop rather than from `useSearchParams` so this subtree needs no Suspense
 * boundary of its own.
 */
export const AuthGuard = ({
    expired,
    children,
}: {
    expired: boolean;
    children: React.ReactNode;
}) => {
    useAuthGuard(expired);
    return children;
};
