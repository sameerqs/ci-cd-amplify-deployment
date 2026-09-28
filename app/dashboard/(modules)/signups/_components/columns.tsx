'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Check, X } from 'lucide-react';

import { StatusBadgeCustom } from '@/components/custom/StatusBadge';
import type { StatusVariant } from '@/components/custom/StatusBadge';
import { Button } from '@/components/ui/button';
import { DataTableColumnHeader } from '@/components/table/components/data-table-column-header';
import { TruncatedCell } from '@/components/table/components/truncated-cell';
import type { Option } from '@/components/table/types/data-table';
import { USER_STATUS_LABEL, UserStatus } from '@/lib/enum';
import { formatUtcDate } from '@/lib/format';

import type { Signup, SignupStatusCount } from '../_lib/api';

interface BuildColumnsArgs {
    statusCounts: SignupStatusCount[];
    isBusy: (id: string) => boolean;
    onApprove: (signup: Signup) => void;
    onReject: (signup: Signup) => void;
}

const STATUS_VARIANT: Record<UserStatus, StatusVariant> = {
    [UserStatus.Pending]: 'pending',
    [UserStatus.Active]: 'active',
    [UserStatus.Rejected]: 'inactive',
};

function statusOptions(counts: SignupStatusCount[]): Option[] {
    const byStatus = new Map(counts.map((c) => [c.status, c.count]));
    return [UserStatus.Pending, UserStatus.Active, UserStatus.Rejected].map(
        (status) => ({
            label: USER_STATUS_LABEL[status],
            value: String(status),
            count: byStatus.get(status) ?? 0,
        }),
    );
}

/**
 * Signups — TanStack column definitions.
 *
 * Only `displayName` carries `meta.variant: "text"`, so the toolbar shows a single
 * search box; the URL key it writes is mapped onto the backend's `search`,
 * which ORs across the name parts + email.
 */
export function buildSignupColumns({
    statusCounts,
    isBusy,
    onApprove,
    onReject,
}: BuildColumnsArgs): ColumnDef<Signup>[] {
    return [
        {
            id: 'displayName',
            accessorKey: 'displayName',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} label="Name" />
            ),
            cell: ({ row }) => (
                <TruncatedCell
                    value={row.original.displayName}
                    className="font-medium"
                />
            ),
            enableSorting: true,
            enableColumnFilter: true,
            meta: {
                label: 'Search',
                variant: 'text',
                placeholder: 'Search by name or email',
                truncate: true,
            },
        },
        {
            id: 'email',
            accessorKey: 'email',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} label="Email" />
            ),
            cell: ({ row }) => <TruncatedCell value={row.original.email} />,
            enableSorting: true,
            enableColumnFilter: false,
            meta: { label: 'Email', truncate: true },
        },
        {
            id: 'status',
            accessorKey: 'status',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} label="Status" />
            ),
            cell: ({ row }) => (
                <StatusBadgeCustom
                    label={USER_STATUS_LABEL[row.original.status]}
                    variant={STATUS_VARIANT[row.original.status]}
                />
            ),
            enableSorting: true,
            enableColumnFilter: true,
            meta: {
                label: 'Status',
                variant: 'select',
                options: statusOptions(statusCounts),
            },
        },
        {
            id: 'createdAt',
            accessorKey: 'createdAt',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} label="Requested" />
            ),
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm">
                    {formatUtcDate(row.original.createdAt, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                    })}
                </span>
            ),
            enableSorting: true,
            enableColumnFilter: false,
            meta: { label: 'Requested' },
        },
        {
            id: 'actions',
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => {
                const signup = row.original;
                if (signup.status !== UserStatus.Pending) {
                    return <span className="sr-only">Already reviewed</span>;
                }
                const busy = isBusy(signup.id);
                return (
                    <div className="flex justify-end gap-2">
                        <Button
                            size="sm"
                            variant="default"
                            disabled={busy}
                            onClick={(e) => {
                                e.stopPropagation();
                                onApprove(signup);
                            }}
                        >
                            <Check className="size-4" />
                            Approve
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                            onClick={(e) => {
                                e.stopPropagation();
                                onReject(signup);
                            }}
                        >
                            <X className="size-4" />
                            Not Approve
                        </Button>
                    </div>
                );
            },
            enableSorting: false,
            enableHiding: false,
            size: 200,
        },
    ];
}
