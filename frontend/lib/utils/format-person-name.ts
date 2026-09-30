export function formatPersonName(
    firstName: string | null | undefined,
    lastName: string | null | undefined,
    fallback = '',
): string {
    const name = [firstName, lastName].filter(Boolean).join(' ').trim();
    return name || fallback;
}
