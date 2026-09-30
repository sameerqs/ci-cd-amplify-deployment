import { DetailPageHeader } from '@/components/custom/DetailPageHeader';
import { Shell } from '@/components/shell';
import { ROADMAP_ROUTES } from '@/lib/routes';

import type { RoadmapFeedback, RoadmapItem } from '../_lib/api';
import { FeedbackTable } from './feedback-table';

interface FeedbackViewProps {
    item: RoadmapItem;
    feedback: RoadmapFeedback[];
    onMutated: () => void;
}

export function FeedbackView({ item, feedback, onMutated }: FeedbackViewProps) {
    return (
        <Shell>
            <DetailPageHeader
                name={`Feedback — ${item.title}`}
                backTo={ROADMAP_ROUTES.LIST}
            >
                <FeedbackTable itemId={item.id} feedback={feedback} onMutated={onMutated} />
            </DetailPageHeader>
        </Shell>
    );
}
