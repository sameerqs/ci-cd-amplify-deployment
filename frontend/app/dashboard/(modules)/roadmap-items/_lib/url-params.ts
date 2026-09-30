import {
    asString,
    buildBaseListQuery,
    normalizeIsActive,
    type SearchParamsRecord,
} from '@/lib/utils/query-params';

import type { ListRoadmapItemsQuery } from './api';

export type { SearchParamsRecord };

/**
 * Roadmap items — URL → backend query mapping. The table's text-filter column
 * writes `?title=...`; the backend ORs it across title + description.
 */
export function searchParamsToRoadmapItemsQuery(
    sp: SearchParamsRecord,
): ListRoadmapItemsQuery {
    return {
        ...buildBaseListQuery(sp),
        search: asString(sp.title)?.trim() || undefined,
        isActive: normalizeIsActive(sp.isActive),
    };
}
