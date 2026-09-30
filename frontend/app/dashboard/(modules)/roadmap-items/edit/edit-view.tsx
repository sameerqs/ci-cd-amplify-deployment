'use client';

import { Shell } from '@/components/shell';
import { DetailPageHeader } from '@/components/custom/DetailPageHeader';
import { ROADMAP_ROUTES } from '@/lib/routes';

import { RoadmapItemForm } from '../_components/roadmap-item-form';
import type { RoadmapItem } from '../_lib/api';

interface EditRoadmapItemViewProps {
    item: RoadmapItem;
}

export function EditRoadmapItemView({ item }: EditRoadmapItemViewProps) {
    return (
        <Shell>
            <DetailPageHeader name={item.title} backTo={ROADMAP_ROUTES.LIST}>
                <RoadmapItemForm item={item} />
            </DetailPageHeader>
        </Shell>
    );
}
