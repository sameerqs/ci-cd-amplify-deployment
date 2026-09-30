import type { LucideIcon } from 'lucide-react';
import {
    LayoutDashboard,
    Map,
    Settings,
    ShieldCheck,
    UserCheck,
} from 'lucide-react';

import { isSafeDashboardBackTo } from '@/lib/utils/safe-back-to';
import {
    ADMIN_DASHBOARD_ROUTES,
    DASHBOARD_ROUTES,
    ROADMAP_ROUTES,
    SIGNUPS_ROUTES,
    USERS_ROUTES,
} from '@/lib/routes';
import { DETAIL_HEADER_BACK_KEY } from '@/lib/utils/detail-header-query';

export interface NavItem {
    label: string;
    /** Optional on collapsible-parent rows. */
    href?: string;
    icon: LucideIcon;
    /** Set on collapsible parents — `href` is ignored when present. */
    children?: NavItem[];
    badge?: number;
}

function buildAdminNav(): NavItem[] {
    return [
        { label: 'Dashboard', href: ADMIN_DASHBOARD_ROUTES.HOME, icon: LayoutDashboard },
        // why: Signups and Users are the same rows from the same table -- a
        // "signup" is a user whose status is still Pending -- and both screens
        // carried the identical Approve/Not Approve actions. Only Users is
        // listed, since it is the superset. The Signups route is left intact
        // and reachable by URL.
        { label: 'Users', href: USERS_ROUTES.LIST, icon: ShieldCheck },
        { label: "What's Coming", href: ROADMAP_ROUTES.LIST, icon: Map },
    ];
}

export function getNavForUser(isSuperAdmin: boolean | null | undefined): NavItem[] {
    if (isSuperAdmin) return buildAdminNav();
    return [
        {
            label: 'Dashboard',
            href: DASHBOARD_ROUTES.HOME,
            icon: LayoutDashboard,
        },
    ];
}

const MODULE_ICONS: ReadonlyArray<readonly [prefix: string, icon: LucideIcon, list: string]> = [
    ['/dashboard/users', ShieldCheck, USERS_ROUTES.LIST],
    ['/dashboard/signups', UserCheck, SIGNUPS_ROUTES.LIST],
    ['/dashboard/roadmap-items', Map, ROADMAP_ROUTES.LIST],
];

export interface ModuleMeta {
    icon: LucideIcon;
    listHref: string;
}

export function getModuleMeta(pathname: string): ModuleMeta | null {
    const hit = MODULE_ICONS.find(([prefix]) => pathname.startsWith(prefix));
    if (!hit) return null;
    return { icon: hit[1], listHref: hit[2] };
}

export function getModuleMetaForHref(href: string): ModuleMeta | null {
    const hit = MODULE_ICONS.find(
        ([, , listHref]) => listHref === href || href.startsWith(`${listHref}/`),
    );
    if (hit) return { icon: hit[1], listHref: hit[2] };
    const prefixHit = MODULE_ICONS.find(([prefix]) => href.startsWith(prefix));
    if (!prefixHit) return null;
    return { icon: prefixHit[1], listHref: prefixHit[2] };
}

function isDashboardHomeHref(href: string): boolean {
    return href === DASHBOARD_ROUTES.HOME || href === ADMIN_DASHBOARD_ROUTES.HOME;
}

function hrefMatchesNavTarget(targetPath: string, href: string): boolean {
    if (isDashboardHomeHref(href)) {
        return targetPath === href;
    }
    return targetPath === href || targetPath.startsWith(`${href}/`);
}

function longestMatchingHref(targetPath: string, allHrefs: string[]): string | null {
    const matches = allHrefs.filter((href) =>
        hrefMatchesNavTarget(targetPath, href),
    );
    if (matches.length === 0) return null;
    return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

/**
 * Resolves which sidebar nav href should appear active for the current route.
 * Honors `detailBack` on cross-module drill-ins.
 */
export function resolveNavActiveHref(
    pathname: string,
    searchParams: URLSearchParams,
    allHrefs: string[],
): string | null {
    const detailBack = searchParams.get(DETAIL_HEADER_BACK_KEY);
    if (isSafeDashboardBackTo(detailBack)) {
        const fromBack = longestMatchingHref(detailBack!, allHrefs);
        if (fromBack) return fromBack;
    }

    return longestMatchingHref(pathname, allHrefs);
}

export function isNavItemActive(
    pathname: string,
    searchParams: URLSearchParams,
    itemHref: string | undefined,
    allHrefs: string[],
): boolean {
    if (!itemHref) return false;
    const activeHref = resolveNavActiveHref(pathname, searchParams, allHrefs);
    return activeHref === itemHref;
}
