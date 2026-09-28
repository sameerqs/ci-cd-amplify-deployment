/**
 * Map the current pathname to a header title. Detail pages can override the
 * resolved title via `?detailName=...` (handled in `site-header.tsx`); this
 * function only kicks in when no detailName is present.
 */
export const getTitleFromPath = (path: string): string => {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return 'Dashboard';

    const lastSegment = segments[segments.length - 1];
    const secondLast = segments[segments.length - 2];

    // "New <Singular>" for `/<module>/new` leaves so the header reads
    // naturally instead of a bare "New".
    if (lastSegment === 'new' && secondLast) {
        const singular = secondLast.endsWith('s')
            ? secondLast.slice(0, -1)
            : secondLast;
        return (
            'New ' + singular.charAt(0).toUpperCase() + singular.slice(1)
        );
    }
    if (lastSegment === 'edit') return 'Edit';

    // Detail pages — `/<module>/<id>` → "<Singular> Details".
    const isId =
        /^[0-9a-fA-F]{24,32}$/.test(lastSegment) ||
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(
            lastSegment,
        );
    if (isId && secondLast) {
        const singular = secondLast.endsWith('s') ? secondLast.slice(0, -1) : secondLast;
        return singular.charAt(0).toUpperCase() + singular.slice(1) + ' Details';
    }

    return lastSegment
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
};
