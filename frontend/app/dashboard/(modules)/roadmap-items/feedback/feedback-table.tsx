'use client';

import {
    StatusBadgeCustom,
    type StatusVariant,
} from '@/components/custom/StatusBadge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    FEEDBACK_STATUS_LABEL,
    FeedbackStatus,
    VOTE_CHOICE_LABEL,
    VoteChoice,
} from '@/lib/enum';
import { formatUtcDate } from '@/lib/format';

import type { RoadmapFeedback } from '../_lib/api';
import { useFeedbackStatus } from '../hooks/use-feedback-status';

interface FeedbackTableProps {
    itemId: string;
    feedback: RoadmapFeedback[];
    onMutated: () => void;
}

const STATUS_VARIANT: Record<FeedbackStatus, StatusVariant> = {
    [FeedbackStatus.New]: 'pending',
    [FeedbackStatus.Reviewed]: 'info',
    [FeedbackStatus.Planned]: 'success',
    [FeedbackStatus.Rejected]: 'inactive',
};

const STATUS_ORDER = [
    FeedbackStatus.New,
    FeedbackStatus.Reviewed,
    FeedbackStatus.Planned,
    FeedbackStatus.Rejected,
];

export function FeedbackTable({ itemId, feedback, onMutated }: FeedbackTableProps) {
    const { isBusy, updateStatus } = useFeedbackStatus(onMutated);

    if (feedback.length === 0) {
        return (
            <p className="text-muted-foreground text-sm">
                No feedback has been submitted for this item yet.
            </p>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Vote</TableHead>
                    <TableHead>Feedback</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {feedback.map((row) => (
                    <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.userEmail}</TableCell>
                        <TableCell>
                            <StatusBadgeCustom
                                label={VOTE_CHOICE_LABEL[row.choice]}
                                variant={row.choice === VoteChoice.Yes ? 'success' : 'inactive'}
                            />
                        </TableCell>
                        <TableCell className="max-w-[360px] whitespace-normal text-sm">
                            {row.note ?? (
                                <span className="text-muted-foreground">
                                    No written reason provided
                                </span>
                            )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                            {formatUtcDate(row.createdAt, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                            })}
                        </TableCell>
                        <TableCell>
                            <Select
                                value={String(row.status)}
                                disabled={isBusy(row.id)}
                                onValueChange={(value) =>
                                    updateStatus(itemId, row.id, Number(value) as FeedbackStatus)
                                }
                            >
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue>
                                        <StatusBadgeCustom
                                            label={FEEDBACK_STATUS_LABEL[row.status]}
                                            variant={STATUS_VARIANT[row.status]}
                                        />
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_ORDER.map((status) => (
                                        <SelectItem key={status} value={String(status)}>
                                            {FEEDBACK_STATUS_LABEL[status]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
