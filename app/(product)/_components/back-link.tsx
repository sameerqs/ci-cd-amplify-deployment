import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

/**
 * A way back for a screen that isn't one of the two nav destinations
 * (Chat, Account) -- reaching it otherwise means switching tabs to get back,
 * which isn't obvious and loses the thread of where you came from.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="mb-2.5 inline-flex items-center gap-1 rounded-full border border-[var(--neutral-200)] bg-card py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium text-[var(--neutral-700)] shadow-sm transition-colors hover:border-[var(--neutral-300)] hover:bg-[var(--neutral-100)] hover:text-foreground"
        >
            <ChevronLeft className="size-4" aria-hidden />
            {label}
        </Link>
    );
}
