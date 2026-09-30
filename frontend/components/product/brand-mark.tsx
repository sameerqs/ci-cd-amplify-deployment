import { cn } from '@/lib/utils';

interface BrandMarkProps {
    className?: string;
    /** Diameter of the rounded tile in px. */
    size?: number;
}

/**
 * The pet2text chat-bubble mark on its accent tile (design 2a).
 */
export function BrandMark({ className, size = 54 }: BrandMarkProps) {
    return (
        <span
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-200)]',
                className,
            )}
            style={{ width: size, height: size }}
            aria-hidden
        >
            <ChatBubbleIcon
                size={Math.round(size * 0.48)}
                className="text-[var(--accent-800)]"
            />
        </span>
    );
}

interface IconProps {
    size?: number;
    className?: string;
}

export function ChatBubbleIcon({ size = 23, className }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden
        >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    );
}

export function AccountIcon({ size = 23, className }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden
        >
            <circle cx="12" cy="8.5" r="3.7" />
            <path d="M5 20c.9-3.6 3.6-5.4 7-5.4s6.1 1.8 7 5.4" />
        </svg>
    );
}

/** A sparkle -- the What's Coming tab, next to Account in the product nav. */
export function SparkleIcon({ size = 23, className }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden
        >
            <path d="M12 3v4M12 17v4M20 12h-4M8 12H4" />
            <path d="M17 7l-2.5 2.5M9.5 14.5 7 17M17 17l-2.5-2.5M9.5 9.5 7 7" />
        </svg>
    );
}
