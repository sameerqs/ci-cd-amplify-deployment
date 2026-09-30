'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { AuthGuard } from '@/app/(auth)/auth-guard';
import { EntryLayout } from '@/app/(auth)/entry-layout';
import { useAuth } from '@/app/context/auth-context';
import { postAuthRedirect } from '@/lib/auth-redirect';

import { LoginForm } from './login-form';

/**
 * why: an already-signed-in visitor is turned away from this screen. That
 * used to happen on the server, before anything painted; a static export has
 * no server left at request time, so it now waits on the auth bootstrap
 * (`loading`) instead — one blank frame beats rendering the sign-in form for
 * someone who is about to be redirected off it.
 *
 * `?expired=true` is the one case that skips this check entirely: the
 * session has to be ended before the form is usable (only AuthGuard does
 * that), and checking `user` here too would just relay the same identity
 * that `expired=true` exists specifically to discard.
 */
function LoginPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isExpired = searchParams.get('expired') === 'true';
    const { user, loading } = useAuth();

    useEffect(() => {
        if (isExpired || loading || user === null) return;
        router.replace(postAuthRedirect(user));
    }, [isExpired, loading, user, router]);

    if (!isExpired && (loading || user !== null)) return null;

    return (
        <AuthGuard expired={isExpired}>
            <EntryLayout>
                <LoginForm />
            </EntryLayout>
        </AuthGuard>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginPageInner />
        </Suspense>
    );
}
