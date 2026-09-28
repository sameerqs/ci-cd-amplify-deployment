import { DataTableSkeleton } from "@/components/table/components/data-table-skeleton";

export default function UsersLoading() {
  return <DataTableSkeleton columnCount={5} filterCount={1} />;
}
