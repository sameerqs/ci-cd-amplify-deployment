import {
    asString,
    buildBaseListQuery,
    type SearchParamsRecord,
} from '@/lib/utils/query-params';

import type { ListUsersQuery } from './api';

export type { SearchParamsRecord };

/**
 * Internal Users — URL → backend query mapping.
 *
 * The list table's text-filter column writes `?email=...`; we route
 * it onto the backend's `search` field which ORs across name + email.
 */
export function searchParamsToUsersQuery(
    sp: SearchParamsRecord,
): ListUsersQuery {
    return {
        ...buildBaseListQuery(sp),
        search: asString(sp.email)?.trim() || undefined,
    };
}
