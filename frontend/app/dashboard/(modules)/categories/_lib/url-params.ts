import {
    asString,
    buildBaseListQuery,
    normalizeIsActive,
    type SearchParamsRecord,
} from '@/lib/utils/query-params';

import type { ListCategoriesQuery } from './api';

export type { SearchParamsRecord };

/**
 * Categories — URL → backend query mapping. The table's text-filter column
 * writes `?name=...`; the backend ORs it across name + description.
 */
export function searchParamsToCategoriesQuery(
    sp: SearchParamsRecord,
): ListCategoriesQuery {
    return {
        ...buildBaseListQuery(sp),
        search: asString(sp.name)?.trim() || undefined,
        isActive: normalizeIsActive(sp.isActive),
    };
}
