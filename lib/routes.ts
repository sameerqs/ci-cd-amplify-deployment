export const AUTH_ROUTES = {
    LOGIN: '/login',
    VERIFY_MAGIC_LINK: '/auth/verify',
    LOGOUT: '/logout',
    loginWithExpired: () => '/login?expired=true' as const,
} as const;

export const DASHBOARD_ROUTES = {
    HOME: '/dashboard',
    UNAUTHORIZED: '/unauthorized',
} as const;

export const ADMIN_DASHBOARD_ROUTES = {
    HOME: '/dashboard',
} as const;

export const USERS_ROUTES = {
    LIST: '/dashboard/users',
    CREATE: '/dashboard/users/new',
    // Query-string id, not a dynamic path segment: static export requires
    // generateStaticParams() to enumerate every path at build time, which is
    // impossible for arbitrary user ids — see nextjs/app/dashboard/(modules)/users/edit/page.tsx.
    edit: (id: string) => `/dashboard/users/edit?id=${id}` as const,
} as const;

export const SIGNUPS_ROUTES = {
    LIST: '/dashboard/signups',
} as const;

export const CATEGORIES_ROUTES = {
    LIST: '/dashboard/categories',
    CREATE: '/dashboard/categories/new',
    // Query-string id — see the comment on USERS_ROUTES.edit above.
    edit: (id: string) => `/dashboard/categories/edit?id=${id}` as const,
} as const;

export const ROADMAP_ROUTES = {
    LIST: '/dashboard/roadmap-items',
    CREATE: '/dashboard/roadmap-items/new',
    // Query-string id — see the comment on USERS_ROUTES.edit above.
    edit: (id: string) => `/dashboard/roadmap-items/edit?id=${id}` as const,
    feedback: (id: string) => `/dashboard/roadmap-items/feedback?id=${id}` as const,
} as const;

/** The pet-owner product surface, as distinct from the /dashboard admin console. */
export const PRODUCT_ROUTES = {
    ONBOARDING: '/onboarding',
    CHAT: '/chat',
    NEW_CHAT: '/chat/new',
    ACCOUNT: '/account',
    WHATS_COMING: '/whats-coming',
    TERMS: '/terms',
} as const;

export const ROUTES = {
    AUTH: AUTH_ROUTES,
    PRODUCT: PRODUCT_ROUTES,
    DASHBOARD: DASHBOARD_ROUTES,
    ADMIN: ADMIN_DASHBOARD_ROUTES,
    USERS: USERS_ROUTES,
    SIGNUPS: SIGNUPS_ROUTES,
    CATEGORIES: CATEGORIES_ROUTES,
    ROADMAP: ROADMAP_ROUTES,
} as const;

export type AuthRoutes = typeof AUTH_ROUTES;
export type DashboardRoutes = typeof DASHBOARD_ROUTES;
export type AppRoutes = typeof ROUTES;
