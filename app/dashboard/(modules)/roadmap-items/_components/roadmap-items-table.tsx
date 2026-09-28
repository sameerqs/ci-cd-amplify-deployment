'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { Plus } from 'lucide-react';

import { DataTable } from '@/components/table/components/data-table';
import { DataTableToolbar } from '@/components/table/components/data-table-toolbar';
import { useDataTable } from '@/components/table/hooks/use-data-table';
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog';
import { Button } from '@/components/ui/button';
import { ROADMAP_ROUTES } from '@/lib/routes';

import type { ActiveCount, RoadmapItem } from '../_lib/api';
import { useRoadmapItemDelete } from '../hooks/use-roadmap-item-delete';
import { buildRoadmapItemColumns } from './columns';

interface RoadmapItemsTableProps {
    data: RoadmapItem[];
    pageCount: number;
    rowCount: number;
    activeCounts: ActiveCount[];
    /** Re-runs the page's own fetch — the static-export replacement for router.refresh(). */
    onMutated: () => void;
}

export function RoadmapItemsTable({
    data,
    pageCount,
    rowCount,
    activeCounts,
    onMutated,
}: RoadmapItemsTableProps) {
    const router = useRouter();
    const { pendingDelete, requestDelete, cancelDelete, confirmDelete } =
        useRoadmapItemDelete(onMutated);

    const columns = useMemo(
        () =>
            buildRoadmapItemColumns({ activeCounts, onDelete: requestDelete }),
        [activeCounts, requestDelete],
    );

    const { table } = useDataTable<RoadmapItem>({
        data,
        columns,
        pageCount,
        rowCount,
        initialState: {
            sorting: [{ id: 'title', desc: false }],
            pagination: { pageIndex: 0, pageSize: 15 },
        },
        getRowId: (row) => row.id,
        clearOnDefault: true,
    });

    return (
        <>
            <DataTable
                table={table}
                onRowClick={(row) => router.push(ROADMAP_ROUTES.feedback(row.id))}
            >
                <DataTableToolbar table={table}>
                    <Button asChild>
                        <Link href={ROADMAP_ROUTES.CREATE}>
                            <Plus className="size-4" />
                            Add item
                        </Link>
                    </Button>
                </DataTableToolbar>
            </DataTable>

            <DeleteConfirmationDialog
                open={!!pendingDelete}
                onOpenChange={cancelDelete}
                onConfirm={confirmDelete}
                itemType="roadmap item"
                title={
                    pendingDelete ? `Delete ${pendingDelete.title}?` : undefined
                }
                description="The item stops appearing in What's Coming. Votes already cast against it are removed with it."
            />
        </>
    );
}
