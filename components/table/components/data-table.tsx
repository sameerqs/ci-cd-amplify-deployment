import {
  flexRender,
  type Row,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import { Fragment } from "react";
import type * as React from "react";

import { DataTablePagination } from "@/components/table/components/data-table-pagination";
import { getColumnPinningStyle } from "@/components/table/lib/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> extends React.ComponentProps<"div"> {
  table: TanstackTable<TData>;
  actionBar?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  showPagination?: boolean;
  pageSizeOptions?: number[];
  /**
   * Optional renderer for an expanded row's nested content. When provided and
   * a row is expanded (TanStack `row.getIsExpanded()`), its output is rendered
   * in a full-width row beneath the row. Omit it and the table behaves exactly
   * as before — existing callers are unaffected.
   */
  renderSubComponent?: (row: Row<TData>) => React.ReactNode;
}

export function DataTable<TData>({
  table,
  actionBar,
  onRowClick,
  showPagination = true,
  pageSizeOptions,
  renderSubComponent,
  children,
  className,
  ...props
}: DataTableProps<TData>) {
  return (
    <div
      className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)}
      {...props}
    >
      {children}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup, rowIndex, allRows) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const totalHeaderRows = allRows.length;
                  const isLeaf = header.column.columns.length === 0;
                  const isUngroupedTopLevelLeaf =
                    isLeaf && header.column.depth === 0;

                  // Multi-row header tables: TanStack puts the real
                  // header for an un-grouped top-level leaf column in
                  // the BOTTOM row and emits placeholders in the rows
                  // above. We lift the leaf header up by rendering it
                  // in the first placeholder slot with rowSpan, and
                  // skipping the real header in later rows. Grouped
                  // leaves (children of a parent group, depth > 0)
                  // keep their natural bottom-row position.
                  if (totalHeaderRows > 1 && isUngroupedTopLevelLeaf) {
                    if (rowIndex === 0 && header.isPlaceholder) {
                      return (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          rowSpan={totalHeaderRows}
                          className={cn(
                            "font-normal text-sm text-muted-foreground leading-5 align-middle",
                            header.column.columnDef.meta?.wrapText &&
                              "whitespace-normal",
                          )}
                          style={{
                            ...getColumnPinningStyle({
                              column: header.column,
                            }),
                            background: "var(--muted)",
                          }}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </TableHead>
                      );
                    }
                    return null;
                  }

                  if (header.isPlaceholder) return null;

                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        "font-normal text-sm text-muted-foreground leading-5 align-middle",
                        header.column.columnDef.meta?.wrapText &&
                          "whitespace-normal",
                      )}
                      style={{
                        ...getColumnPinningStyle({ column: header.column }),
                        background: "var(--muted)",
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && "selected"}
                    className={
                      onRowClick
                        ? "cursor-pointer hover:bg-secondary!"
                        : undefined
                    }
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      const isInteractive = target.closest(
                        'button, a, input, [role="checkbox"], [data-slot="checkbox"]',
                      );
                      if (!isInteractive) {
                        onRowClick?.(row.original);
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          cell.column.getIsPinned() && "bg-background",
                          "group-data-[state=selected]:bg-secondary",
                          cell.column.columnDef.meta?.wrapText
                            ? "align-top whitespace-normal"
                            : "align-middle",
                          cell.column.columnDef.meta?.truncate &&
                            "overflow-hidden",
                          cell.column.id === "actions" &&
                            "py-1 [&_[data-slot=button][data-size=icon]]:size-8",
                        )}
                        style={{
                          ...getColumnPinningStyle({ column: cell.column }),
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {renderSubComponent && row.getIsExpanded() ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={table.getVisibleLeafColumns().length}
                        className="bg-muted/30 p-0"
                      >
                        {renderSubComponent(row)}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-24 text-center"
                >
                  No Data Available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {(showPagination || actionBar) && (
        <div className="flex flex-col gap-2.5">
          {showPagination && <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />}
          {actionBar &&
            table.getFilteredSelectedRowModel().rows.length > 0 &&
            actionBar}
        </div>
      )}
    </div>
  );
}
