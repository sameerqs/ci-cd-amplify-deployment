import { call, type PaginatedData } from '@/lib/utils/api-utils';

export interface Category {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdById: string | null;
    updatedById: string | null;
    createdAt: string;
    updatedAt: string | null;
}

export interface ActiveCount {
    isActive: boolean;
    count: number;
}

export type CategoriesPage = PaginatedData<Category> & {
    activeCounts: ActiveCount[];
};

export interface CreateCategoryPayload {
    name: string;
    description?: string;
    isActive: boolean;
}

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export interface ListCategoriesQuery {
    page?: number;
    pageSize?: number;
    search?: string;
    isActive?: boolean;
    /** Comma-separated `field:asc|desc` pairs. */
    sort?: string;
}

export interface CategoryPickerOption {
    id: string;
    name: string;
}

const BASE = 'categories';

function buildQuery(q: ListCategoriesQuery | undefined): string {
    if (!q) return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(q)) {
        if (value === undefined || value === null || value === '') continue;
        params.set(key, String(value));
    }
    const s = params.toString();
    return s ? `?${s}` : '';
}

export const listCategories = (query?: ListCategoriesQuery) =>
    call<CategoriesPage>({
        endpoint: `${BASE}${buildQuery(query)}`,
        method: 'GET',
        silent: true,
    });

export const listCategoriesForPicker = async (): Promise<
    CategoryPickerOption[]
> => {
    const res = await call<{ items: CategoryPickerOption[] }>({
        endpoint: `${BASE}/picker`,
        method: 'GET',
        silent: true,
    });
    return res?.items ?? [];
};

export const getCategory = (id: string) =>
    call<Category>({
        endpoint: `${BASE}/${id}`,
        method: 'GET',
        silent: true,
    });

export const createCategory = (payload: CreateCategoryPayload) =>
    call<Category>({
        endpoint: BASE,
        method: 'POST',
        payload,
        silent: true,
    });

export const updateCategory = (id: string, payload: UpdateCategoryPayload) =>
    call<Category>({
        endpoint: `${BASE}/${id}`,
        method: 'PATCH',
        payload,
        silent: true,
    });

export const deleteCategory = (id: string) =>
    call<Category>({
        endpoint: `${BASE}/${id}`,
        method: 'DELETE',
        silent: true,
    });
