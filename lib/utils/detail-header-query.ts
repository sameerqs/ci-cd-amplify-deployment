import { USERS_ROUTES } from "@/lib/routes";

export const DETAIL_HEADER_NAME_KEY = "detailName";
export const DETAIL_HEADER_BACK_KEY = "detailBack";
export const DETAIL_HEADER_PARENT_NAME_KEY = "parentName";
export const DETAIL_HEADER_PARENT_BACK_KEY = "parentBack";

/** Module list pages — add each feature module's LIST route here. */
const MODULE_TABLE_PATHS = new Set<string>([USERS_ROUTES.LIST]);

export function isModuleTableListPath(pathname: string): boolean {
    return MODULE_TABLE_PATHS.has(pathname);
}

interface DetailHeaderParams {
    name?: string | null;
    backTo?: string | null;
    /** Parent entity name — surfaces as the middle segment of a nested breadcrumb. */
    parentName?: string | null;
    /** URL the parent crumb links back to. */
    parentBack?: string | null;
}

export function withDetailHeaderParams(
    path: string,
    { name, backTo, parentName, parentBack }: DetailHeaderParams,
) {
    const [basePath, hash = ""] = path.split("#");
    const [base, existingQuery = ""] = basePath.split("?");
    const params = new URLSearchParams(existingQuery);

    if (name) {
        params.set(DETAIL_HEADER_NAME_KEY, name);
    }
    if (backTo) {
        params.set(DETAIL_HEADER_BACK_KEY, backTo);
    }
    if (parentName) {
        params.set(DETAIL_HEADER_PARENT_NAME_KEY, parentName);
    }
    if (parentBack) {
        params.set(DETAIL_HEADER_PARENT_BACK_KEY, parentBack);
    }

    const query = params.toString();
    const queryPath = query ? `${base}?${query}` : base;

    return hash ? `${queryPath}#${hash}` : queryPath;
}

export function getDetailHeaderParams(searchParams: URLSearchParams) {
    return {
        name: searchParams.get(DETAIL_HEADER_NAME_KEY),
        backTo: searchParams.get(DETAIL_HEADER_BACK_KEY),
        parentName: searchParams.get(DETAIL_HEADER_PARENT_NAME_KEY),
        parentBack: searchParams.get(DETAIL_HEADER_PARENT_BACK_KEY),
    };
}

export function stripDetailHeaderParams(url: string): string {
    const [basePath, hash = ""] = url.split("#");
    const [base, query = ""] = basePath.split("?");
    if (!query) return url;

    const params = new URLSearchParams(query);
    params.delete(DETAIL_HEADER_NAME_KEY);
    params.delete(DETAIL_HEADER_BACK_KEY);
    params.delete(DETAIL_HEADER_PARENT_NAME_KEY);
    params.delete(DETAIL_HEADER_PARENT_BACK_KEY);

    const remaining = params.toString();
    const cleanPath = remaining ? `${base}?${remaining}` : base;
    return hash ? `${cleanPath}#${hash}` : cleanPath;
}
