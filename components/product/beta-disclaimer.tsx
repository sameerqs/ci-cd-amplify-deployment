import { cn } from '@/lib/utils';

/**
 * The standing "documentation only" line. It appears on every unauthenticated
 * entry screen (design 2a) — the product makes a point of never reading as
 * veterinary advice, so this is not optional chrome.
 */
export function BetaDisclaimer({ className }: { className?: string }) {
    return (
        <p
            className={cn(
                'text-[11.5px] leading-relaxed text-[var(--neutral-600)]',
                className,
            )}
        >
            Beta · Documentation only — pet2text does not give veterinary advice.
        </p>
    );
}

/**
 * The pill that sits above a conversation (design 2d/2f/2g/2h).
 */
export function TrustPill({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                'flex items-center justify-center gap-2 rounded-full bg-[var(--accent-2-100)] px-4 py-2',
                className,
            )}
        >
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-2-800)"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
            >
                <rect x="4" y="10" width="16" height="10" rx="3" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <span className="text-[11.5px] font-semibold text-[var(--accent-2-800)]">
                Private • You control what is saved • Documentation only
            </span>
        </div>
    );
}
