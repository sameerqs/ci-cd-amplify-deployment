'use client';

import { Button } from '@/components/ui/button';

import type { CaptureCard as CaptureCardModel } from '../../_lib/types';

interface CaptureCardProps {
    card: CaptureCardModel;
    isBusy: boolean;
    onConfirm: () => void;
    onUndo: () => void;
    onEdit: () => void;
    onAddMore: () => void;
}

/** Alternating tones so adjacent category groups stay distinguishable. */
const TONES = [
    { label: 'text-[var(--accent-700)]', dot: 'bg-[var(--accent-400)]' },
    { label: 'text-[var(--accent-2-700)]', dot: 'bg-[var(--accent-2-400)]' },
] as const;

/**
 * The "What I captured" confirmation card (design 2f). Nothing reaches the
 * pet's profile until the owner confirms — the card is the consent step.
 */
export function CaptureCard({
    card,
    isBusy,
    onConfirm,
    onUndo,
    onEdit,
    onAddMore,
}: CaptureCardProps) {
    return (
        <div className="rounded-[30px] border-[1.5px] border-[var(--neutral-200)] bg-card px-[18px] pb-[18px] pt-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
                <span className="flex size-[26px] items-center justify-center rounded-full bg-[var(--accent-200)]">
                    <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--accent-800)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                    >
                        <path d="M20 6 9 17l-5-5" />
                    </svg>
                </span>
                <span className="font-heading text-[18px]">What I captured</span>
            </div>

            {card.groups.map((group, i) => {
                const tone = TONES[i % TONES.length];
                return (
                    <div key={group.category} className="mb-2.5">
                        <div
                            className={`mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] ${tone.label}`}
                        >
                            {group.category}
                        </div>
                        <ul className="flex flex-col gap-2.5">
                            {group.entries.map((entry) => (
                                <li key={entry.id} className="flex gap-2.5">
                                    <span
                                        className={`mt-2 size-1.5 shrink-0 rounded-full ${tone.dot}`}
                                        aria-hidden
                                    />
                                    <span className="text-[14.5px] leading-[1.5]">
                                        {entry.text}
                                        <span className="block text-[11.5px] text-[var(--neutral-600)]">
                                            {entry.provenance}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}

            {card.isConfirmed ? (
                <div className="mt-3 flex items-center justify-between gap-2.5 rounded-[22px] bg-[var(--status-success-bg)] px-4 py-3">
                    <span className="text-[13.5px] font-semibold leading-[1.4] text-[var(--status-success-fg)]">
                        Saved to the pet&apos;s profile
                    </span>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onUndo}
                        disabled={isBusy}
                        className="h-auto px-2 py-1 text-[13.5px] text-[var(--status-success-fg)]"
                    >
                        Undo
                    </Button>
                </div>
            ) : (
                <>
                    <Button
                        type="button"
                        onClick={onConfirm}
                        disabled={isBusy}
                        className="mt-3 min-h-[50px] w-full text-[15.5px]"
                    >
                        Yes, that&apos;s right
                    </Button>
                    <div className="mt-2 flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onEdit}
                            disabled={isBusy}
                            className="min-h-[44px] flex-1 text-[14.5px]"
                        >
                            Edit
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onAddMore}
                            disabled={isBusy}
                            className="min-h-[44px] flex-1 text-[14.5px]"
                        >
                            Add more
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
