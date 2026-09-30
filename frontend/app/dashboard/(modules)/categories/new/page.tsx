'use client';

import { Shell } from '@/components/shell';
import { DetailPageHeader } from '@/components/custom/DetailPageHeader';
import { useRequireSuperAdmin } from '@/lib/auth/use-auth-guard';
import { CATEGORIES_ROUTES } from '@/lib/routes';

import { CategoryForm } from '../_components/category-form';

export default function NewCategoryPage() {
    const { loading } = useRequireSuperAdmin();
    if (loading) return <Shell>{null}</Shell>;

    return (
        <Shell>
            <DetailPageHeader name="Add Category" backTo={CATEGORIES_ROUTES.LIST}>
                <CategoryForm />
            </DetailPageHeader>
        </Shell>
    );
}
