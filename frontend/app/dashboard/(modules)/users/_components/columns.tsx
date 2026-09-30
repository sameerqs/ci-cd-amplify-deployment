'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { Check, Pencil, Trash2, X } from 'lucide-react';

import { StatusBadgeCustom } from '@/components/custom/StatusBadge';
import type { StatusVariant } from '@/components/custom/StatusBadge';
import { Button } from '@/components/ui/button';
import { DataTableColumnHeader } from '@/components/table/components/data-table-column-header';
import { TruncatedCell } from '@/components/table/components/truncated-cell';
import { USER_STATUS_LABEL, UserStatus } from '@/lib/enum';
import { formatUtcDate } from '@/lib/format';
import { USERS_ROUTES } from '@/lib/routes';

import type { User } from '../_lib/api';

interface BuildColumnsArgs {
    onDelete: (user: User) => void;
    isBusy: (id: string) => boolean;
    onApprove: (user: User) => void;
    onReject: (user: User) => void;
}

const STATUS_VARIANT: Record<UserStatus, StatusVariant> = {
    [UserStatus.Pending]: 'pending',
    [UserStatus.Active]: 'active',
    [UserStatus.Rejected]: 'inactive',
};

// The email is the only name this product holds.
const fullName = (u: User): string => u.email;

/**
 * Internal Users — TanStack column definitions.
 *
 * Filter UX: only the first column carries `meta.variant: "text"`, which
 * surfaces a single search input in the toolbar; the URL key it writes is
 * mapped onto the backend's `search` field, which matches on email.
 */
export function buildUserColumns({
    onDelete,
    isBusy,
    onApprove,
    onReject,
}: BuildColumnsArgs): ColumnDef<User>[] {
    return [
        {
            id: 'firstName',
            accessorFn: fullName,
            header: ({ column }) => (
                <DataTableColumnHeader column={column} label="Name" />
            ),
            cell: ({ row }) => (
                <TruncatedCell
                    value={fullName(row.original)}
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
            cell: ({ row }) => (
                <TruncatedCell value={row.original.email} />
            ),
            enableSorting: true,
            enableColumnFilter: false,
            meta: { label: 'Email', truncate: true },
        },
        {
            id: 'isActive',
            accessorKey: 'isActive',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} label="Status" />
            ),
            // why: the tri-state, not the derived boolean. A user awaiting
            // review rendered as "Inactive" here, which reads as a decision
            // that has already been taken rather than one still owed.
            cell: ({ row }) => (
                <StatusBadgeCustom
                    label={USER_STATUS_LABEL[row.original.status]}
                    variant={STATUS_VARIANT[row.original.status]}
                />
            ),
            enableSorting: true,
            enableColumnFilter: false,
            meta: { label: 'Status' },
        },
        {
            id: 'updatedAt',
            accessorKey: 'updatedAt',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} label="Last Updated" />
            ),
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm">
                    {row.original.updatedAt
                        ? formatUtcDate(row.original.updatedAt, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                          })
                        : '—'}
                </span>
            ),
            enableSorting: true,
            enableColumnFilter: false,
            meta: { label: 'Last Updated' },
        },
        {
            id: 'actions',
            header: () => <span className="sr-only">Actions</span>,
            // why: the decision is taken on the row it belongs to. Approving
            // used to mean opening the edit page and flipping a toggle that
            // never named the choice -- and the Signups screen already offered
            // it inline, so the same decision behaved differently per screen.
            // Shown only while the row is PENDING: once reviewed there is no
            // action left, and the backend refuses to re-review it anyway.
            cell: ({ row }) => {
                const user = row.original;
                const awaitingReview = user.status === UserStatus.Pending;
                const busy = isBusy(user.id);
                return (
                    <div className="flex justify-end gap-1">
                        {awaitingReview ? (
                            <>
                                <Button
                                    size="sm"
                                    variant="default"
                                    disabled={busy}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onApprove(user);
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
                                        onReject(user);
                                    }}
                                >
                                    <X className="size-4" />
                                    Not Approve
                                </Button>
                            </>
                        ) : null}
                        <Button size="icon" variant="ghost" aria-label="Edit" asChild>
                            <Link
                                href={USERS_ROUTES.edit(user.id)}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Pencil className="size-4" />
                            </Link>
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Delete"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(user);
                            }}
                        >
                            <Trash2 className="size-4 text-destructive" />
                        </Button>
                    </div>
                );
            },
            enableSorting: false,
            enableHiding: false,
            size: 260,
        },
    ];
}
