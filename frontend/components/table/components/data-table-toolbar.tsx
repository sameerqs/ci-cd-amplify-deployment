"use client";

import type { Column, Table } from "@tanstack/react-table";
import { Search, X } from "lucide-react";
import * as React from "react";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Split chunks so pages that only use text/number filters avoid pulling cmdk/calendar/slider graphs up front. */
const DataTableDateFilterLazy = React.lazy(() =>
	import("@/components/table/components/data-table-date-filter").then((m) => ({
		default: m.DataTableDateFilter,
	})),
);
const DataTableFacetedFilterLazy = React.lazy(() =>
	import("@/components/table/components/data-table-faceted-filter").then((m) => ({
		default: m.DataTableFacetedFilter,
	})),
);
const DataTableSliderFilterLazy = React.lazy(() =>
	import("@/components/table/components/data-table-slider-filter").then((m) => ({
		default: m.DataTableSliderFilter,
	})),
);

function FilterChunkFallback() {
	return (
		<div
			className="h-8 min-w-[7rem] animate-pulse rounded-md bg-muted/60"
			aria-hidden
		/>
	);
}

type FilterableColumn<TData> = Column<TData, unknown>;

function isPrimaryFilterColumn<TData>(column: FilterableColumn<TData>) {
	const variant = column.columnDef.meta?.variant;
	return variant === "text" || variant === "number";
}

function partitionFilterColumns<TData>(table: Table<TData>) {
	const filterable = table
		.getAllColumns()
		.filter((column) => column.getCanFilter());
	const primaryColumns: FilterableColumn<TData>[] = [];
	const facetColumns: FilterableColumn<TData>[] = [];

	for (const column of filterable) {
		if (!column.columnDef.meta?.variant) continue;
		if (isPrimaryFilterColumn(column)) {
			primaryColumns.push(column);
		} else {
			facetColumns.push(column);
		}
	}

	return { primaryColumns, facetColumns };
}

interface DataTableToolbarProps<TData> extends React.ComponentProps<"div"> {
	table: Table<TData>;
}

export function DataTableToolbar<TData>({
	table,
	children,
	className,
	...props
}: DataTableToolbarProps<TData>) {
	const isFiltered = table.getState().columnFilters.length > 0;

	const { primaryColumns, facetColumns } = React.useMemo(
		() => partitionFilterColumns(table),
		[table],
	);

	const onReset = React.useCallback(() => {
		table.resetColumnFilters();
	}, [table]);

	const resetButton = isFiltered ? (
		<Button
			aria-label="Reset filters"
			variant="outline"
			size="sm"
			className="shrink-0 border-dashed"
			onClick={onReset}
		>
			<X />
			Reset
		</Button>
	) : null;

	const showResetWithPrimary = resetButton && facetColumns.length === 0;
	const showResetWithFacets = resetButton && facetColumns.length > 0;

	return (
		<div
			role="toolbar"
			aria-orientation="horizontal"
			className={cn("flex w-full min-w-0 flex-col gap-2 p-1", className)}
			{...props}
		>
			<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
					{primaryColumns.map((column) => (
						<DataTableToolbarFilter key={column.id} column={column} />
					))}
					{showResetWithPrimary ? resetButton : null}
				</div>
				{children ? (
					<div className="flex w-full shrink-0 items-center gap-2 sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
						{children}
					</div>
				) : null}
			</div>
			{facetColumns.length > 0 ? (
				<div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
					{facetColumns.map((column) => (
						<div key={column.id} className="shrink-0">
							<DataTableToolbarFilter column={column} />
						</div>
					))}
					{showResetWithFacets ? resetButton : null}
				</div>
			) : null}
		</div>
	);
}

interface DataTableToolbarFilterProps<TData> {
	column: Column<TData>;
}

function DataTableToolbarFilter<TData>({
	column,
}: DataTableToolbarFilterProps<TData>) {
	const columnMeta = column.columnDef.meta;

	if (!columnMeta?.variant) return null;

	switch (columnMeta.variant) {
		case "text":
			return (
				<div className="relative min-w-0 w-full sm:w-auto">
					<Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder={"Search..."}
						value={(column.getFilterValue() as string) ?? ""}
						onChange={(event) => column.setFilterValue(event.target.value)}
						className="h-8 w-full min-w-0 bg-white pl-8 sm:w-40 lg:w-86"
					/>
				</div>
			);

		case "number":
			return (
				<div className="relative min-w-0 w-full sm:w-auto">
					<Input
						type="number"
						inputMode="numeric"
						placeholder={columnMeta.placeholder ?? columnMeta.label}
						value={(column.getFilterValue() as string) ?? ""}
						onChange={(event) => column.setFilterValue(event.target.value)}
						className={cn(
							"h-8 w-full min-w-0 bg-white sm:w-[120px]",
							columnMeta.unit && "pr-8",
						)}
					/>
					{columnMeta.unit && (
						<span className="absolute top-0 right-0 bottom-0 flex items-center rounded-r-md bg-accent px-2 text-sm text-muted-foreground">
							{columnMeta.unit}
						</span>
					)}
				</div>
			);

		case "range":
			return (
				<Suspense fallback={<FilterChunkFallback />}>
					<DataTableSliderFilterLazy
						column={column as Column<unknown>}
						title={columnMeta.label ?? column.id}
					/>
				</Suspense>
			);

		case "date":
		case "dateRange":
			return (
				<Suspense fallback={<FilterChunkFallback />}>
					<DataTableDateFilterLazy
						column={column as Column<unknown>}
						title={columnMeta.label ?? column.id}
						multiple={columnMeta.variant === "dateRange"}
					/>
				</Suspense>
			);

		case "select":
		case "multiSelect":
			return (
				<Suspense fallback={<FilterChunkFallback />}>
					<DataTableFacetedFilterLazy
						column={column as Column<unknown>}
						title={columnMeta.label ?? column.id}
						options={columnMeta.options ?? []}
						multiple={columnMeta.variant === "multiSelect"}
					/>
				</Suspense>
			);

		default:
			return null;
	}
}
