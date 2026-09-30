'use client';

import { Shell } from '@/components/shell';
import { DetailPageHeader } from '@/components/custom/DetailPageHeader';
import { useRequireSuperAdmin } from '@/lib/auth/use-auth-guard';
import { ROADMAP_ROUTES } from '@/lib/routes';

import { RoadmapItemForm } from '../_components/roadmap-item-form';

export default function NewRoadmapItemPage() {
    const { loading } = useRequireSuperAdmin();
    if (loading) return <Shell>{null}</Shell>;

    return (
        <Shell>
            <DetailPageHeader
                name="Add Roadmap Item"
                backTo={ROADMAP_ROUTES.LIST}
            >
                <RoadmapItemForm />
            </DetailPageHeader>
        </Shell>
    );
}
