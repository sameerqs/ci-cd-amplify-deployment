/**
 * Guard for `?backTo=` style params: only allow same-app dashboard paths so a
 * crafted URL can never send the user off-site (open-redirect protection).
 */
export function isSafeDashboardBackTo(
    href: string | null | undefined,
): href is string {
    if (!href) return false;
    return href === '/dashboard' || href.startsWith('/dashboard/');
}
