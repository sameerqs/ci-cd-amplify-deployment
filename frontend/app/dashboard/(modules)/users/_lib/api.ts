import type { UserStatus } from '@/lib/enum';
import { call, type PaginatedData } from '@/lib/utils/api-utils';

export interface User {
    id: string;
    email: string;
    displayName: string;
    isSuperAdmin: boolean;
    /** The review state. `isActive` is the derived view of it the API also sends. */
    status: UserStatus;
    isActive: boolean;
    createdById: string | null;
    updatedById: string | null;
    createdAt: string;
    updatedAt: string | null;
}

export interface InviteUserPayload {
    email: string;
}

export interface UpdateUserPayload {
    isActive?: boolean;
}

export interface ListUsersQuery {
    page?: number;
    pageSize?: number;
    search?: string;
    isActive?: boolean;
    /** "<startMs>,<endMs>" — inclusive UNIX-ms range. */
    createdAt?: string;
    /** Comma-separated `field:asc|desc` pairs. */
    sort?: string;
}

export type UsersPage = PaginatedData<User>;

export interface AdminUserPickerOption {
    id: string;
    label: string;
}

const BASE = 'users';

function buildQuery(q: ListUsersQuery | undefined): string {
    if (!q) return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(q)) {
        if (value === undefined || value === null || value === '') continue;
        params.set(key, String(value));
    }
    const s = params.toString();
    return s ? `?${s}` : '';
}

export const listUsers = (query?: ListUsersQuery) =>
    call<UsersPage>({
        endpoint: `${BASE}${buildQuery(query)}`,
        method: 'GET',
        silent: true,
    });

export const listAdminUsersForPicker = async (): Promise<
    AdminUserPickerOption[]
> => {
    const res = await call<
        AdminUserPickerOption[] | { items: AdminUserPickerOption[] }
    >({
        endpoint: `${BASE}/picker`,
        method: 'GET',
        silent: true,
    });
    if (Array.isArray(res)) return res;
    return res?.items ?? [];
};

// Backend + DB enforce the singleton — this is just for UI disable hints.
export const checkSuperAdminExists = () =>
    call<{ exists: boolean }>({
        endpoint: `${BASE}/super-admin-exists`,
        method: 'GET',
        silent: true,
    });

export const getUser = (id: string) =>
    call<User>({
        endpoint: `${BASE}/${id}`,
        method: 'GET',
        silent: true,
    });

export const inviteUser = (payload: InviteUserPayload) =>
    call<User>({
        endpoint: `${BASE}/invite`,
        method: 'POST',
        payload,
        silent: true,
        returnEnvelope: true,
    });

export const updateUser = (id: string, payload: UpdateUserPayload) =>
    call<User>({
        endpoint: `${BASE}/${id}`,
        method: 'PATCH',
        payload,
        silent: true,
    });

// why: the same endpoints the Signups screen uses. Approval is one decision on
// one row whichever list you are looking at, so it must not fork into a second
// implementation that can drift from it.
export const approveUser = (id: string) =>
    call<User>({
        endpoint: `${BASE}/signups/${id}/approve`,
        method: 'PATCH',
        silent: true,
        returnEnvelope: true,
    });

export const rejectUser = (id: string) =>
    call<User>({
        endpoint: `${BASE}/signups/${id}/reject`,
        method: 'PATCH',
        silent: true,
    });

export const deleteUser = (id: string) =>
    call<User>({
        endpoint: `${BASE}/${id}`,
        method: 'DELETE',
        silent: true,
    });
