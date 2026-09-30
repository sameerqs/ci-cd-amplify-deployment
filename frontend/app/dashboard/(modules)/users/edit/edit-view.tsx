'use client';

import { Shell } from '@/components/shell';
import { DetailPageHeader } from '@/components/custom/DetailPageHeader';
import { USERS_ROUTES } from '@/lib/routes';

import { EditUserForm } from '../_components/edit-user-form';
import type { User } from '../_lib/api';

interface EditUserViewProps {
    user: User;
}

/**
 * Edit-page client view. Wires the global site-header breadcrumb and
 * renders the shared edit form.
 */
export function EditUserView({ user }: EditUserViewProps) {
    return (
        <Shell>
            <DetailPageHeader name={user.email} backTo={USERS_ROUTES.LIST}>
                <EditUserForm user={user} />
            </DetailPageHeader>
        </Shell>
    );
}
