'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/app/context/auth-context';
import { AUTH_ROUTES, DASHBOARD_ROUTES, PRODUCT_ROUTES } from '@/lib/routes';

/**
 * Front door. Pet owners belong in chat, staff in the admin console, and anyone
 * without a session at the one entry screen — sending an owner to /dashboard
 * only bounced them off a Super Admin guard.
 */
export default function Home() {
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading) return;
        if (user === null) {
            router.replace(AUTH_ROUTES.LOGIN);
            return;
        }
        router.replace(user.isSuperAdmin ? DASHBOARD_ROUTES.HOME : PRODUCT_ROUTES.CHAT);
    }, [loading, user, router]);

    return null;
}
