'use client';

import { Shell } from '@/components/shell';
import { DetailPageHeader } from '@/components/custom/DetailPageHeader';
import { useRequireSuperAdmin } from '@/lib/auth/use-auth-guard';
import { USERS_ROUTES } from '@/lib/routes';

import { InviteUserForm } from '../_components/invite-user-form';

/**
 * Internal Users — Invite page. The header sets the breadcrumb name
 * "Invite user" via DetailHeaderSync.
 */
export default function InviteUserPage() {
    const { loading } = useRequireSuperAdmin();
    if (loading) return <Shell>{null}</Shell>;

    return (
        <Shell>
            <DetailPageHeader name="Invite User" backTo={USERS_ROUTES.LIST}>
                <InviteUserForm />
            </DetailPageHeader>
        </Shell>
    );
}
