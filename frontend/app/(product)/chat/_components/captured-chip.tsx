'use client';

import { ClipboardList } from 'lucide-react';

interface CapturedChipProps {
    label: string;
    onExpand: () => void;
}

/**
 * The capture card, collapsed (design 2f, emergency variant). Mid-emergency the
 * facts are still written down — that is what the owner will be repeating at the
 * clinic — but a card asking them to confirm or undo it right then is not. This
 * is the quiet way back to it.
 */
export function CapturedChip({ label, onExpand }: CapturedChipProps) {
    return (
        <button
            type="button"
            onClick={onExpand}
            className="flex w-full items-center gap-2.5 rounded-[22px] border-[1.5px] border-[var(--neutral-200)] bg-card px-4 py-3 text-left transition-colors hover:bg-[var(--neutral-100)]"
        >
            <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--accent-200)]">
                <ClipboardList className="size-[13px] text-[var(--accent-800)]" aria-hidden />
            </span>
            <span className="text-[13.5px] text-[var(--neutral-700)]">{label}</span>
        </button>
    );
}
