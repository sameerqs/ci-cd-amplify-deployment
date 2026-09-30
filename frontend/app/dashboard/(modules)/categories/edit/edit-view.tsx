'use client';

import { Shell } from '@/components/shell';
import { DetailPageHeader } from '@/components/custom/DetailPageHeader';
import { CATEGORIES_ROUTES } from '@/lib/routes';

import { CategoryForm } from '../_components/category-form';
import type { Category } from '../_lib/api';

interface EditCategoryViewProps {
    category: Category;
}

export function EditCategoryView({ category }: EditCategoryViewProps) {
    return (
        <Shell>
            <DetailPageHeader
                name={category.name}
                backTo={CATEGORIES_ROUTES.LIST}
            >
                <CategoryForm category={category} />
            </DetailPageHeader>
        </Shell>
    );
}
