import { DataTableSkeleton } from '@/components/table/components/data-table-skeleton';

export default function SignupsLoading() {
    return <DataTableSkeleton columnCount={5} filterCount={2} />;
}
