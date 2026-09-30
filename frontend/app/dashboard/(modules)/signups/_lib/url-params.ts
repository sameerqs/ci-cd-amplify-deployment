import { UserStatus } from '@/lib/enum';
import {
    asString,
    buildBaseListQuery,
    type SearchParamsRecord,
} from '@/lib/utils/query-params';

import type { ListSignupsQuery } from './api';

export type { SearchParamsRecord };

const VALID_STATUSES = new Set<number>([
    UserStatus.Pending,
    UserStatus.Active,
    UserStatus.Rejected,
]);

/**
 * Signups — URL → backend query mapping. The table's text-filter column writes
 * `?displayName=...`; the backend ORs it across the name parts + email.
 */
export function searchParamsToSignupsQuery(
    sp: SearchParamsRecord,
): ListSignupsQuery {
    const statusRaw = asString(sp.status);
    const statusNum =
        statusRaw === undefined ? NaN : Number.parseInt(statusRaw, 10);
    return {
        ...buildBaseListQuery(sp),
        search: asString(sp.displayName)?.trim() || undefined,
        status:
            Number.isFinite(statusNum) && VALID_STATUSES.has(statusNum)
                ? (statusNum as UserStatus)
                : undefined,
    };
}
