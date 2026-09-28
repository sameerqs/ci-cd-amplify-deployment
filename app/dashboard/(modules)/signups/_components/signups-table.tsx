'use client';

import { useMemo } from 'react';

import { DataTable } from '@/components/table/components/data-table';
import { DataTableToolbar } from '@/components/table/components/data-table-toolbar';
import { useDataTable } from '@/components/table/hooks/use-data-table';
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog';

import type { Signup, SignupStatusCount } from '../_lib/api';
import { useSignupReview } from '../hooks/use-signup-review';
import { buildSignupColumns } from './columns';

interface SignupsTableProps {
    data: Signup[];
    pageCount: number;
    rowCount: number;
    statusCounts: SignupStatusCount[];
    /** Re-runs the page's own fetch — the static-export replacement for router.refresh(). */
    onMutated: () => void;
}

export function SignupsTable({
    data,
    pageCount,
    rowCount,
    statusCounts,
    onMutated,
}: SignupsTableProps) {
    const {
        pendingReject,
        isBusy,
        approve,
        requestReject,
        cancelReject,
        confirmReject,
    } = useSignupReview(onMutated);

    const columns = useMemo(
        () =>
            buildSignupColumns({
                statusCounts,
                isBusy,
                onApprove: approve,
                onReject: requestReject,
            }),
        [statusCounts, isBusy, approve, requestReject],
    );

    const { table } = useDataTable<Signup>({
        data,
        columns,
        pageCount,
        rowCount,
        initialState: {
            sorting: [{ id: 'createdAt', desc: false }],
            pagination: { pageIndex: 0, pageSize: 15 },
        },
        getRowId: (row) => row.id,
        clearOnDefault: true,
    });

    return (
        <>
            <DataTable table={table}>
                <DataTableToolbar table={table} />
            </DataTable>

            <DeleteConfirmationDialog
                open={!!pendingReject}
                onOpenChange={cancelReject}
                onConfirm={confirmReject}
                itemType="signup"
                title={
                    pendingReject
                        ? `Not approve ${pendingReject.displayName}?`
                        : undefined
                }
                description="They will not be able to sign in, and this cannot be undone from the dashboard. No email is sent."
            />
        </>
    );
}
