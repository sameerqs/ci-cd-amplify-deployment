import { SearchParams } from "nuqs";

export interface SearchParamsRecord {
    [key: string]: string | string[] | undefined;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 15;

export function asString(
    value: string | string[] | undefined,
): string | undefined {
    if (Array.isArray(value)) return value[0];
    return value;
}

export function asInt(
    value: string | string[] | undefined,
    fallback: number,
): number {
    const s = asString(value);
    if (!s) return fallback;
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function asBool(
    value: string | string[] | undefined,
): boolean | undefined {
    const raw = asString(value);
    if (raw === undefined) return undefined;
    const v = raw.toLowerCase();
    if (["true", "1", "yes", "y", "active"].includes(v)) return true;
    if (["false", "0", "no", "n", "inactive"].includes(v)) return false;
    return undefined;
}

// "active,inactive" → undefined (filter is a no-op when both picked).
export function normalizeIsActive(
    value: string | string[] | undefined,
): boolean | undefined {
    const raw = asString(value);
    if (!raw) return undefined;
    const tokens = raw.split(/[,]+/).filter(Boolean);
    if (tokens.length !== 1) return undefined;
    return asBool(tokens[0]);
}

interface SortItem {
    id: string;
    desc: boolean;
}

// Returns undefined on empty input (vs formatSortParams's "").
export function parseSort(value: string | undefined): string | undefined {
    if (!value) return undefined;
    try {
        const parsed = JSON.parse(value) as SortItem[];
        if (!Array.isArray(parsed) || parsed.length === 0) return undefined;
        return parsed
            .filter((item) => typeof item?.id === "string")
            .map((item) => `${item.id}:${item.desc ? "desc" : "asc"}`)
            .join(",");
    } catch {
        return undefined;
    }
}

export interface BaseListQuery {
    page?: number;
    pageSize?: number;
    sort?: string;
    createdAt?: string;
}

export function buildBaseListQuery(sp: SearchParamsRecord): BaseListQuery {
    return {
        page: asInt(sp.page, DEFAULT_PAGE),
        pageSize: asInt(sp.perPage, DEFAULT_PAGE_SIZE),
        sort: parseSort(asString(sp.sort)),
        createdAt: asString(sp.createdAt),
    };
}

/**
 * `useSearchParams()`'s `ReadonlyURLSearchParams` as a plain record, for the
 * client-side list pages that used to receive `searchParams` as an RSC prop.
 * `URLSearchParams` collapses a repeated key to its first value the same way
 * Next's RSC `searchParams` prop did, which is all `asString`'s `Array.isArray`
 * branch above ever needed.
 */
export function searchParamsToRecord(
    searchParams: URLSearchParams,
): SearchParamsRecord {
    return Object.fromEntries(searchParams.entries());
}


export function addPaginationParams(
    params: URLSearchParams,
    searchParams: SearchParams,
): void {
    params.append("page", String(searchParams.page || DEFAULT_PAGE));
    params.append("pageSize", String(searchParams.perPage || DEFAULT_PAGE_SIZE));
}

export function addDateRangeParams(
    params: URLSearchParams,
    searchParams: SearchParams,
): void {
    if (searchParams.createdAt) {
        params.append("createdAt", String(searchParams.createdAt));
    }
}

// Back-compat — new code should prefer the typed normalizeIsActive.
export function normalizeIsActiveValue(
    rawIsActive: string | string[] | undefined,
): string | null {
    const result = normalizeIsActive(rawIsActive);
    if (result === undefined) return null;
    return result ? "true" : "false";
}

export function formatSortParams(sortParam: string | string[] | undefined): string {
    if (!sortParam) {
        return "";
    }

    try {
        const sortArray = JSON.parse(sortParam as string);
        const sortString = sortArray
            .map((item: { id: string; desc?: boolean }) => {
                const obj = typeof item === "string" ? JSON.parse(item) : item;
                const direction = obj.desc ? "desc" : "asc";
                return `${obj.id}:${direction}`;
            })
            .join(",");

        return sortString;
    } catch {
        // Malformed sort param — fall back to no sort.
        return "";
    }
}

export function addSortParams(
    params: URLSearchParams,
    searchParams: SearchParams,
): void {
    const sortString = formatSortParams(searchParams.sort);
    if (sortString) {
        params.append("sort", sortString);
    }
}

export function addCommonParams(
    params: URLSearchParams,
    searchParams: SearchParams,
): void {
    addPaginationParams(params, searchParams);
    addDateRangeParams(params, searchParams);
    addSortParams(params, searchParams);
}
