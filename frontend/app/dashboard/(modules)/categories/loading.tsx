import { DataTableSkeleton } from '@/components/table/components/data-table-skeleton';

export default function CategoriesLoading() {
    return <DataTableSkeleton columnCount={5} filterCount={2} />;
}
