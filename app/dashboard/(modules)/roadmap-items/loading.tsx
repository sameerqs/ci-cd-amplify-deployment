import { DataTableSkeleton } from '@/components/table/components/data-table-skeleton';

export default function RoadmapItemsLoading() {
    return <DataTableSkeleton columnCount={6} filterCount={2} />;
}
