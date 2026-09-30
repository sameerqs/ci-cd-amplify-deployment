'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { toast } from "@/lib/toast";

import { DataTable } from '@/components/table/components/data-table';
import { DataTableToolbar } from '@/components/table/components/data-table-toolbar';
import { useDataTable } from '@/components/table/hooks/use-data-table';
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog';
import { Button } from '@/components/ui/button';
import { SUCCESS_MESSAGES } from '@/lib/utils/success-messages';
import { USERS_ROUTES } from '@/lib/routes';
import { withSearchParams } from '@/lib/utils/with-search-params';
import { withDetailHeaderParams } from '@/lib/utils/detail-header-query';

import { deleteUserAction } from '../_lib/actions';
import type { User } from '../_lib/api';
import { useUserReview } from '../hooks/use-user-review';
import { buildUserColumns } from './columns';

interface UsersTableProps {
    data: User[];
    pageCount: number;
    rowCount: number;
    /** Re-runs the page's own fetch — the static-export replacement for router.refresh(). */
    onMutated: () => void;
}

// The email is the only name this product holds.
const fullName = (u: User): string => u.email;

export function UsersTable({ data, pageCount, rowCount, onMutated }: UsersTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [pendingDelete, setPendingDelete] = useState<User | null>(null);
    const [isDeleting, startDeleteTransition] = useTransition();
    const {
        pendingReject,
        isBusy,
        approve,
        requestReject,
        cancelReject,
        confirmReject,
    } = useUserReview(onMutated);

    const columns = useMemo(
        () =>
            buildUserColumns({
                onDelete: (u) => setPendingDelete(u),
                isBusy,
                onApprove: approve,
                onReject: requestReject,
            }),
        [isBusy, approve, requestReject],
    );

    const { table } = useDataTable<User>({
        data,
        columns,
        pageCount,
        rowCount,
        initialState: {
            sorting: [{ id: 'updatedAt', desc: true }],
            pagination: { pageIndex: 0, pageSize: 15 },
        },
        getRowId: (row) => row.id,
        clearOnDefault: true,
    });

    const handleConfirmDelete = () => {
        if (!pendingDelete) return;
        startDeleteTransition(async () => {
            const result = await deleteUserAction(pendingDelete.id);
            if (result.ok) {
                toast.success(SUCCESS_MESSAGES.USER_REMOVED);
                setPendingDelete(null);
                onMutated();
            } else {
                toast.error(result.message);
            }
        });
    };

    return (
        <>
            <DataTable
                table={table}
                onRowClick={(row) => {
                    const backHref = withSearchParams(
                        USERS_ROUTES.LIST,
                        searchParams,
                    );
                    const detailHref = withSearchParams(
                        USERS_ROUTES.edit(row.id),
                        searchParams,
                        ['page', 'perPage'],
                    );
                    router.push(
                        withDetailHeaderParams(detailHref, {
                            name: fullName(row),
                            backTo: backHref,
                        }),
                    );
                }}
            >
                <DataTableToolbar table={table}>
                    <Button asChild>
                        <Link href={USERS_ROUTES.CREATE}>
                            <Plus className="size-4" />
                            Invite user
                        </Link>
                    </Button>
                </DataTableToolbar>
            </DataTable>

            <DeleteConfirmationDialog
                open={!!pendingDelete}
                onOpenChange={(o) => {
                    if (!o && !isDeleting) setPendingDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                itemType="user"
                title={
                    pendingDelete ? `Remove ${fullName(pendingDelete)}?` : undefined
                }
                description="The account will be deactivated and the email anonymised. Existing audit trails are preserved."
            />

            <DeleteConfirmationDialog
                open={!!pendingReject}
                onOpenChange={cancelReject}
                onConfirm={confirmReject}
                itemType="user"
                title={
                    pendingReject ? `Not approve ${pendingReject.email}?` : undefined
                }
                description="They will not be able to sign in, and this cannot be undone from the dashboard. No email is sent."
            />
        </>
    );
}
