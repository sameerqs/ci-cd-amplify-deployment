import { toast } from "@/lib/toast";

import { AUTH_ENDPOINTS } from '@/app/(auth)/auth-endpoints';
import { clearAccessToken, getAccessToken } from '@/lib/auth/auth-client';
import { renewSession } from '@/lib/auth/renew-session';
import { AUTH_ROUTES } from '@/lib/routes';
import { appSettings } from '@/lib/app-settings';

// Mirror of server/src/common/types/api-response.types.ts.
export type WarningType = 'INFO' | 'SOFT' | 'CRITICAL';

export interface ApiError {
    field?: string;
    code?: string;
    message: string;
}

export interface ApiResponse<TData = unknown> {
    isSuccess: boolean;
    message: string;
    data: TData;
    errors: ApiError[];
    warningHeading: string;
    warningMessage: string;
    warningType: WarningType | null;
}

export interface PaginatedData<TItem> {
    items: TItem[];
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
}

// Shown when the reverse proxy rejects an over-sized upload body (HTTP 413).
const FILE_TOO_LARGE_MESSAGE =
    'This file is too large to upload to the server.';

// These endpoints ARE the login flow — a 401 means "bad credentials",
// not "session expired", so don't redirect.
const PUBLIC_AUTH_ENDPOINTS = new Set<string>(Object.values(AUTH_ENDPOINTS));

type CallOptions = {
    payload?: unknown;
    endpoint: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    isFormData?: boolean;
    responseType?: 'json' | 'blob' | 'text';
    signal?: AbortSignal | null;
    /** Pass `null` to skip sending Authorization (public endpoints). */
    token?: string | null;
    /** Suppresses automatic error toasts so the caller can handle them inline. */
    silent?: boolean;
    /** Returns the full envelope (for warningMessage / pagination metadata). */
    returnEnvelope?: boolean;
    /** Internal: false on the replay after a refresh, so a 401 cannot loop. */
    allowRetry?: boolean;
};

class ApiCallError extends Error {
    constructor(
        message: string,
        public readonly envelope: ApiResponse<unknown> | null,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'ApiCallError';
    }
}

// JSON.stringify drops `undefined` keys but preserves Next.js's
// `"$undefined"` serialization sentinel — strip both so DTOs see
// either a real value or the key omitted entirely.
function sanitizePayload(value: unknown): unknown {
    if (value === undefined || value === '$undefined') return undefined;
    if (value === null) return null;
    if (Array.isArray(value)) {
        return value.map((item) => {
            const cleaned = sanitizePayload(item);
            return cleaned === undefined ? null : cleaned;
        });
    }
    if (typeof value === 'object') {
        // Multipart payloads bypass walking.
        if (value instanceof Blob || value instanceof FormData) return value;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            const cleaned = sanitizePayload(v);
            if (cleaned !== undefined) out[k] = cleaned;
        }
        return out;
    }
    return value;
}

function pickErrorMessage(envelope: ApiResponse<unknown> | null, fallback: string): string {
    if (!envelope) return fallback;
    if (envelope.warningMessage) return envelope.warningMessage;
    const first = envelope.errors?.[0];
    if (first?.message) return first.message;
    if (envelope.message) return envelope.message;
    return fallback;
}

// Auto-prepends ${API_BASE}/. Reads the JWT from the in-memory client token
// store (see lib/auth/auth-client.ts) when the caller doesn't pass one.
// 401 redirects to /login except for the auth flow itself.
// AbortError re-thrown unchanged so callers can opt into cancel.
//
// This runs in the browser only — the app is a static export with no server
// at request time, so every call site is a client component's event handler
// or effect, never a build-time prerender pass.
export async function call<TData = unknown>(
    options: CallOptions & { returnEnvelope: true },
): Promise<ApiResponse<TData>>;
export async function call<TData = unknown>(
    options: CallOptions,
): Promise<TData>;
export async function call<TData = unknown>({
    payload,
    endpoint,
    method = 'POST',
    isFormData = false,
    responseType = 'json',
    signal = null,
    token,
    silent = false,
    returnEnvelope = false,
    allowRetry = true,
}: CallOptions): Promise<TData | ApiResponse<TData>> {
    const authToken =
        token === null ? null : token !== undefined ? token : getAccessToken();

    const url = `${appSettings.API_BASE}/${endpoint}`;

    const headers: HeadersInit = {
        'Cache-Control': 'no-cache',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    };
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    const config: RequestInit = {
        method,
        headers,
        // The API is now a different origin (EC2) from this static site
        // (S3/CloudFront) — credentials must be explicit for the httpOnly
        // `sessionId` cookie to ride along on the /auth/refresh retry below.
        credentials: 'include',
        signal: signal ?? undefined,
    };
    if (method !== 'GET' && payload !== undefined) {
        config.body = isFormData
            ? (payload as BodyInit)
            : JSON.stringify(sanitizePayload(payload));
    }

    let response: Response;
    try {
        response = await fetch(url, config);
        // why: a long-running request can outlive the access token it was sent
        // with. One refresh-and-retry turns that into a non-event instead of
        // bouncing the user to /login. Guarded by `allowRetry` so a genuinely
        // dead session cannot loop.
        if (
            response.status === 401 &&
            allowRetry &&
            token === undefined &&
            !PUBLIC_AUTH_ENDPOINTS.has(endpoint)
        ) {
            const renewal = await renewSession();
            if (renewal.action === 'renewed') {
                return call<TData>({
                    payload,
                    endpoint,
                    method,
                    isFormData,
                    responseType,
                    signal,
                    silent,
                    returnEnvelope,
                    token: renewal.accessToken,
                    allowRetry: false,
                } as CallOptions) as Promise<TData | ApiResponse<TData>>;
            }
        }
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') throw error;
        const msg =
            error instanceof Error ? error.message : 'Network error — please try again.';
        if (!silent) toast.error(msg);
        throw new ApiCallError(msg, null, 0);
    }

    // Non-JSON responses (file downloads, raw text) bypass envelope handling.
    if (responseType !== 'json') {
        if (!response.ok) {
            const msg =
                response.status === 413
                    ? FILE_TOO_LARGE_MESSAGE
                    : `Request failed with status ${response.status}`;
            if (!silent) toast.error(msg);
            throw new ApiCallError(msg, null, response.status);
        }
        const body =
            responseType === 'blob' ? await response.blob() : await response.text();
        return body as unknown as TData;
    }

    let envelope: ApiResponse<TData> | null = null;
    try {
        envelope = (await response.json()) as ApiResponse<TData>;
    } catch {
        envelope = null;
    }

    // 401 after a refresh has already been tried — the session really is over.
    if (response.status === 401 && !PUBLIC_AUTH_ENDPOINTS.has(endpoint)) {
        clearAccessToken();
        window.location.replace(AUTH_ROUTES.loginWithExpired());
        return new Promise<never>(() => {});
    }

    if (!response.ok || envelope?.isSuccess === false) {
        // A 413 is raised by the reverse proxy (nginx client_max_body_size),
        // so its body is HTML, not our JSON envelope — give a clear message
        // instead of the generic fallback.
        const fallback =
            response.status === 413 ? FILE_TOO_LARGE_MESSAGE : 'Request failed.';
        const msg = pickErrorMessage(envelope, fallback);
        if (!silent) toast.error(msg);
        throw new ApiCallError(msg, envelope, response.status);
    }

    if (!envelope) {
        const msg = 'Malformed response from server.';
        if (!silent) toast.error(msg);
        throw new ApiCallError(msg, null, response.status);
    }

    // Success — surface any non-fatal warning the backend tagged.
    if (!silent && envelope.warningMessage) {
        toast.info(envelope.warningMessage, envelope.warningHeading ? { description: envelope.warningHeading } : undefined);
    }

    return returnEnvelope ? envelope : envelope.data;
}

export { ApiCallError };
