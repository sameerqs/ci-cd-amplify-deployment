'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { Eye, Pencil, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';

import { StatusBadge } from '@/components/custom/StatusBadge';
import { Button } from '@/components/ui/button';
import { DataTableColumnHeader } from '@/components/table/components/data-table-column-header';
import { TruncatedCell } from '@/components/table/components/truncated-cell';
import type { Option } from '@/components/table/types/data-table';
import { formatUtcDate } from '@/lib/format';
import { ROADMAP_ROUTES } from '@/lib/routes';

import type { ActiveCount, RoadmapItem } from '../_lib/api';

interface BuildColumnsArgs {
    activeCounts: ActiveCount[];
    onDelete: (item: RoadmapItem) => void;
}

function activeOptions(counts: ActiveCount[]): Option[] {
    const byActive = new Map(counts.map((c) => [c.isActive, c.count]));
    return [
        { label: 'Active', value: 'true', count: byActive.get(true) ?? 0 },
        { label: 'Inactive', value: 'false', count: byActive.get(false) ?? 0 },
    ];
}

/**
 * Roadmap items — TanStack column definitions. Only `title` carries
 * `meta.variant: "text"`, so the toolbar shows one search box; the URL key it
 * writes maps onto the backend's `search`, which ORs title + description.
 */
export function buildRoadmapItemColumns({
    activeCounts,
    onDelete,
}: BuildColumnsArgs): ColumnDef<RoadmapItem>[] {
    return [
        {
            id: 'title',
            accessorKey: 'title',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} label="Title" />
            ),
            cell: ({ row }) => (
                <TruncatedCell
                    value={row.original.title}
                    className="font-medium"
                />
            ),
            enableSorting: true,
            enableColumnFilter: true,
            meta: {
                label: 'Search',
                variant: 'text',
                placeholder: 'Search roadmap items',
                truncate: true,
            },
        },
        {
            id: 'description',
            accessorKey: 'description',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} label="Description" />
            ),
            cell: ({ row }) => (
                <TruncatedCell value={row.original.description ?? '—'} />
            ),
            enableSorting: false,
            enableColumnFilter: false,
            meta: { label: 'Description', truncate: true },
        },
        {
            id: 'votes',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} label="Votes" />
            ),
            cell: ({ row }) => (
                <div className="text-muted-foreground flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1">
                        <ThumbsUp className="size-3.5" aria-hidden />
                        {row.original.yesCount}
                    </span>
                    <span className="flex items-center gap-1">
                        <ThumbsDown className="size-3.5" aria-hidden />
                        {row.original.noCount}
                    </span>
                </div>
            ),
            enableSorting: false,
            enableColumnFilter: false,
            meta: { label: 'Votes' },
        },
        {
            id: 'isActive',
            accessorKey: 'isActive',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} label="Status" />
            ),
            cell: ({ row }) => <StatusBadge status={row.original.isActive} />,
            enableSorting: true,
            enableColumnFilter: true,
            meta: {
                label: 'Status',
                variant: 'select',
                options: activeOptions(activeCounts),
            },
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
            cell: ({ row }) => (
                <div className="flex justify-end gap-1">
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label="View feedback"
                        asChild
                    >
                        <Link href={ROADMAP_ROUTES.feedback(row.original.id)}>
                            <Eye className="size-4" />
                        </Link>
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Edit"
                        asChild
                    >
                        <Link href={ROADMAP_ROUTES.edit(row.original.id)}>
                            <Pencil className="size-4" />
                        </Link>
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(row.original);
                        }}
                    >
                        <Trash2 className="size-4 text-destructive" />
                    </Button>
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
            size: 80,
        },
    ];
}
