'use client';

import { Check, SendHorizonal } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PRODUCT_ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';

import { VoteChoice, type RoadmapEntry } from '../../_lib/types';
import { useRoadmapVote } from '../hooks/use-roadmap-vote';

const NOTE_MAX_LENGTH = 500;

interface WhatsComingListProps {
    entries: RoadmapEntry[];
    className?: string;
}

/**
 * The vote rows, shared by the standalone What's Coming screen and the panel
 * that sits beside Account on desktop (design 2j and 2l) so the two cannot
 * drift apart.
 */
export function WhatsComingList({ entries, className }: WhatsComingListProps) {
    const {
        entries: rows,
        busyId,
        expandedId,
        vote,
        sendReason,
        setDraftNote,
        notePlaceholder,
    } = useRoadmapVote(entries);

    return (
        // why: a grid, not a stack. The caller decides how many columns it has
        // room for -- the standalone screen spreads out on a desktop, the
        // Account sidebar stays one column -- and the cards no longer have to
        // be squeezed flat to fit a phone's worth of height on every viewport.
        <ul className={cn('grid w-full grid-cols-1 gap-2.5', className)}>
            {rows.map((entry) => (
                <li
                    key={entry.id}
                    className="flex flex-col rounded-[22px] border border-[var(--neutral-200)] bg-card p-4"
                >
                    <h2 className="font-heading text-[16.5px] leading-[1.3]">
                        {entry.title}
                    </h2>
                    {entry.description ? (
                        <p className="mt-1 text-[13px] leading-[1.5] text-[var(--neutral-700)]">
                            {entry.description}
                        </p>
                    ) : null}

                    <div
                        role="group"
                        aria-label={`Would you use ${entry.title}?`}
                        className="mt-3.5"
                    >
                        {/* why: the question sat on the same wrapping row as the
                            two choices, so on a phone it broke mid-sentence and
                            the buttons landed wherever there was room. Its own
                            line costs one line of height and reads as a question. */}
                        <span
                            aria-hidden
                            className="block text-[12px] font-medium text-[var(--neutral-700)]"
                        >
                            Would you use this?
                        </span>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <VoteButton
                                label="Yes"
                                selected={entry.myVote === VoteChoice.Yes}
                                tone="yes"
                                disabled={busyId === entry.id}
                                onClick={() => vote(entry, VoteChoice.Yes)}
                            />
                            <VoteButton
                                label="Not for me"
                                selected={entry.myVote === VoteChoice.No}
                                tone="no"
                                disabled={busyId === entry.id}
                                onClick={() => vote(entry, VoteChoice.No)}
                            />
                        </div>
                    </div>

                    {entry.myVote !== null ? (
                        <ReasonBox
                            entry={entry}
                            isExpanded={expandedId === entry.id}
                            isBusy={busyId === entry.id}
                            placeholder={notePlaceholder(entry)}
                            onSend={(note) => sendReason(entry, note)}
                            onDraftChange={(note) => setDraftNote(entry.id, note)}
                        />
                    ) : null}
                </li>
            ))}
        </ul>
    );
}

interface ReasonBoxProps {
    entry: RoadmapEntry;
    isExpanded: boolean;
    isBusy: boolean;
    placeholder: string;
    onSend: (note: string) => void;
    onDraftChange: (note: string) => void;
}

/**
 * The reason for a vote — collapsed by default, even for a card the owner
 * voted on in an earlier session. Casting a fresh vote opens it; otherwise it
 * only opens on request, and a Send icon is what actually submits it.
 */
function ReasonBox({
    entry,
    isExpanded,
    isBusy,
    placeholder,
    onSend,
    onDraftChange,
}: ReasonBoxProps) {
    const note = entry.note ?? '';
    const noteLength = note.length;
    const atLimit = noteLength >= NOTE_MAX_LENGTH;
    const countId = `roadmap-note-count-${entry.id}`;

    if (!isExpanded) {
        // why: once a reason is sent it goes to admin review, not back on
        // screen for the owner to re-read or re-edit -- this line only ever
        // confirms receipt, never echoes what was written.
        return (
            <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--status-success-fg)]">
                <Check className="size-3" aria-hidden />
                Feedback sent
            </div>
        );
    }

    return (
        <div className="mt-3 rounded-[18px] border border-[var(--neutral-200)] bg-[var(--neutral-100)] p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
                <span className="text-[11.5px] font-semibold text-[var(--neutral-800)]">
                    Add a reason <span className="font-normal text-[var(--neutral-600)]">(optional)</span>
                </span>
                <span className="text-[11px] text-[var(--neutral-600)]">
                    You can send this blank
                </span>
            </div>
            <Textarea
                value={note}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder={placeholder}
                aria-label={`Why — ${entry.title}`}
                aria-describedby={countId}
                maxLength={NOTE_MAX_LENGTH}
                rows={2}
                autoFocus
                disabled={isBusy}
                className="min-h-[72px] resize-none rounded-[14px] border-[var(--neutral-300)] bg-card text-[12.5px] shadow-none"
            />
            <div className="mt-2 flex items-center justify-between gap-2 px-1">
                <span
                    id={countId}
                    aria-live="polite"
                    className={cn(
                        'text-[11px]',
                        atLimit
                            ? 'font-medium text-[var(--status-danger-fg)]'
                            : 'text-[var(--neutral-600)]',
                    )}
                >
                    {noteLength} / {NOTE_MAX_LENGTH}
                </span>
                <Button
                    type="button"
                    size="icon"
                    disabled={isBusy}
                    onClick={() => onSend(note)}
                    aria-label="Send your reason"
                    className="size-8 rounded-full"
                >
                    <SendHorizonal className="size-3.5" aria-hidden />
                </Button>
            </div>
        </div>
    );
}

/**
 * The Account-screen sidebar version (design 2l) -- shows only the most
 * recently added roadmap item (the list comes back oldest-first, so that's
 * the last entry) rather than the full list, since the sidebar is a third of
 * the screen, not the whole one. "See all" opens the standalone screen with
 * every item.
 */
export function WhatsComingPanel({ entries }: { entries: RoadmapEntry[] }) {
    const latest = entries.at(-1);

    return (
        <div className="rounded-[26px] border border-[var(--neutral-200)] bg-card p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <span className="inline-flex rounded-full bg-[var(--neutral-200)] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-700)]">
                        Beta
                    </span>
                    <h2 className="mt-2 font-heading text-[19px]">What&apos;s coming</h2>
                </div>
                <Button
                    asChild
                    variant="secondary"
                    className="min-h-8 shrink-0 bg-card px-3 text-[12.5px]"
                >
                    <Link href={PRODUCT_ROUTES.WHATS_COMING}>See all</Link>
                </Button>
            </div>
            <p className="mt-0.5 text-[12.5px] leading-[1.45] text-[var(--neutral-700)]">
                Nothing here works yet. Tell us what&apos;s worth building.
            </p>

            {latest ? <WhatsComingList entries={[latest]} className="mt-3" /> : null}

            <p className="mt-4 rounded-[18px] bg-[var(--accent-2-100)] px-3.5 py-3 text-[12px] leading-[1.5] text-[var(--accent-2-800)]">
                pet2text documents what you tell it. It does not diagnose, advise,
                or judge costs.
            </p>
        </div>
    );
}

interface VoteButtonProps {
    label: string;
    selected: boolean;
    tone: 'yes' | 'no';
    disabled: boolean;
    onClick: () => void;
}

function VoteButton({ label, selected, tone, disabled, onClick }: VoteButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-pressed={selected}
            className={cn(
                'min-h-9 w-full rounded-full border px-3.5 text-[13px] transition-colors disabled:opacity-50',
                selected && tone === 'yes'
                    ? 'border-transparent bg-[var(--accent-200)] font-semibold text-[var(--accent-900)]'
                    : selected
                      ? 'border-transparent bg-[var(--neutral-300)] font-semibold text-[var(--neutral-900)]'
                      : 'border-[var(--neutral-300)] bg-card text-[var(--neutral-700)] hover:border-ring/50',
            )}
        >
            {label}
        </button>
    );
}
