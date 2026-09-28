import { DETAIL_HEADER_BACK_KEY } from '@/lib/utils/detail-header-query';
import { withSearchParams } from '@/lib/utils/with-search-params';

interface ReadonlySearchParams {
    toString(): string;
    get(key: string): string | null;
}

export function resolveBackUrl(
    fallbackPath: string,
    searchParams: ReadonlySearchParams | null | undefined,
): string {
    const backTo = searchParams?.get(DETAIL_HEADER_BACK_KEY);
    if (backTo) return backTo;
    return withSearchParams(fallbackPath, searchParams);
}
