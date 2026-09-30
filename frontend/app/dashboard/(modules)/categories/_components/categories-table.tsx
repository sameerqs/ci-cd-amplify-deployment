'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Plus } from 'lucide-react';

import { DataTable } from '@/components/table/components/data-table';
import { DataTableToolbar } from '@/components/table/components/data-table-toolbar';
import { useDataTable } from '@/components/table/hooks/use-data-table';
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog';
import { Button } from '@/components/ui/button';
import { CATEGORIES_ROUTES } from '@/lib/routes';

import type { ActiveCount, Category } from '../_lib/api';
import { useCategoryDelete } from '../hooks/use-category-delete';
import { buildCategoryColumns } from './columns';

interface CategoriesTableProps {
    data: Category[];
    pageCount: number;
    rowCount: number;
    activeCounts: ActiveCount[];
    /** Re-runs the page's own fetch — the static-export replacement for router.refresh(). */
    onMutated: () => void;
}

export function CategoriesTable({
    data,
    pageCount,
    rowCount,
    activeCounts,
    onMutated,
}: CategoriesTableProps) {
    const { pendingDelete, requestDelete, cancelDelete, confirmDelete } =
        useCategoryDelete(onMutated);

    const columns = useMemo(
        () => buildCategoryColumns({ activeCounts, onDelete: requestDelete }),
        [activeCounts, requestDelete],
    );

    const { table } = useDataTable<Category>({
        data,
        columns,
        pageCount,
        rowCount,
        initialState: {
            sorting: [{ id: 'name', desc: false }],
            pagination: { pageIndex: 0, pageSize: 15 },
        },
        getRowId: (row) => row.id,
        clearOnDefault: true,
    });

    return (
        <>
            <DataTable table={table}>
                <DataTableToolbar table={table}>
                    <Button asChild>
                        <Link href={CATEGORIES_ROUTES.CREATE}>
                            <Plus className="size-4" />
                            Add category
                        </Link>
                    </Button>
                </DataTableToolbar>
            </DataTable>

            <DeleteConfirmationDialog
                open={!!pendingDelete}
                onOpenChange={cancelDelete}
                onConfirm={confirmDelete}
                itemType="category"
                title={
                    pendingDelete ? `Delete ${pendingDelete.name}?` : undefined
                }
                description="The category stops being offered to users. Entries already filed under it keep their existing label."
            />
        </>
    );
}
