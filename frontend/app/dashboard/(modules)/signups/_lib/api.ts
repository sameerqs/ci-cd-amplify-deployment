import type { UserStatus } from '@/lib/enum';
import { call, type PaginatedData } from '@/lib/utils/api-utils';

export interface Signup {
    id: string;
    email: string;
    displayName: string;
    status: UserStatus;
    onboardingCompletedAt: string | null;
    createdAt: string;
    updatedAt: string | null;
}

export interface SignupStatusCount {
    status: UserStatus;
    count: number;
}

export type SignupsPage = PaginatedData<Signup> & {
    statusCounts: SignupStatusCount[];
};

export interface ListSignupsQuery {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: UserStatus;
    /** Comma-separated `field:asc|desc` pairs. */
    sort?: string;
}

const BASE = 'users/signups';

function buildQuery(q: ListSignupsQuery | undefined): string {
    if (!q) return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(q)) {
        if (value === undefined || value === null || value === '') continue;
        params.set(key, String(value));
    }
    const s = params.toString();
    return s ? `?${s}` : '';
}

export const listSignups = (query?: ListSignupsQuery) =>
    call<SignupsPage>({
        endpoint: `${BASE}${buildQuery(query)}`,
        method: 'GET',
        silent: true,
    });

export const approveSignup = (id: string) =>
    call<Signup>({
        endpoint: `${BASE}/${id}/approve`,
        method: 'PATCH',
        silent: true,
        returnEnvelope: true,
    });

export const rejectSignup = (id: string) =>
    call<Signup>({
        endpoint: `${BASE}/${id}/reject`,
        method: 'PATCH',
        silent: true,
    });
