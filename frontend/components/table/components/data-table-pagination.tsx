import type { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface DataTablePaginationProps<TData> extends React.ComponentProps<"div"> {
  table: Table<TData>;
  pageSizeOptions?: number[];
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [15, 30, 50, 100],
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  return (
    <div
      className={cn(
        "flex w-full flex-col-reverse flex-wrap items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-4",
        className,
      )}
      {...props}
    >
      <div className="flex-1 whitespace-nowrap text-muted-foreground text-sm">
        {table.options.rowCount ?? table.getFilteredRowModel().rows.length}{" "}
        total row(s)
      </div>
      <div className="flex flex-col-reverse items-end!  flex-1 justify-end! gap-4 sm:flex-row sm:gap-6 lg:gap-8">
        <div className="flex items-center justify-center font-medium text-sm">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>

        <div className="flex items-center space-x-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Go to first page"
                variant="outline"
                size="icon"
                className={cn(
                  "hidden size-8 lg:flex disabled:pointer-events-auto disabled:cursor-not-allowed",
                )}
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeft />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">First</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Go to previous page"
                variant="outline"
                size="icon"
                className={cn(
                  "size-8 disabled:pointer-events-auto disabled:cursor-not-allowed",
                )}
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Previous</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Go to next page"
                variant="outline"
                size="icon"
                className={cn(
                  "size-8 disabled:pointer-events-auto disabled:cursor-not-allowed",
                )}
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Next</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Go to last page"
                variant="outline"
                size="icon"
                className={cn(
                  "hidden size-8 lg:flex disabled:pointer-events-auto disabled:cursor-not-allowed",
                )}
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRight />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Last</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center space-x-2">
          <p className="whitespace-nowrap font-medium text-sm">Rows per page</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
            
          >
            <SelectTrigger className="h-8 w-fit data-size:h-8 bg-white">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
