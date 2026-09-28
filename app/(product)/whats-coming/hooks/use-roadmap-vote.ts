'use client';

import { useCallback, useState, useTransition } from 'react';

import { toast } from '@/lib/toast';

import { VoteChoice, type RoadmapEntry } from '../../_lib/types';
import { castVoteAction, clearVoteAction } from '../_lib/actions';

interface UseRoadmapVoteResult {
    entries: RoadmapEntry[];
    busyId: string | null;
    /** The one entry whose reason box is open. Never open on first render —
     * only a vote cast this session, or an explicit tap, opens it. */
    expandedId: string | null;
    vote: (entry: RoadmapEntry, choice: VoteChoice) => void;
    sendReason: (entry: RoadmapEntry, note: string) => void;
    setDraftNote: (id: string, note: string) => void;
    notePlaceholder: (entry: RoadmapEntry) => string;
}

/**
 * Voting for What's Coming (design 2j). One vote per person per item — tapping
 * the choice you already hold withdraws it, so a mis-tap is recoverable without
 * a separate control. Casting a fresh vote opens the reason box for it; nothing
 * opens on its own when the page just loads.
 */
export function useRoadmapVote(
    initialEntries: RoadmapEntry[],
): UseRoadmapVoteResult {
    const [entries, setEntries] = useState<RoadmapEntry[]>(initialEntries);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    const replace = useCallback((next: RoadmapEntry) => {
        setEntries((current) =>
            current.map((row) => (row.id === next.id ? next : row)),
        );
    }, []);

    const vote = useCallback(
        (entry: RoadmapEntry, choice: VoteChoice) => {
            const withdrawing = entry.myVote === choice;
            const hasSavedNote = Boolean(entry.note);
            setBusyId(entry.id);
            startTransition(async () => {
                const result = withdrawing
                    ? await clearVoteAction(entry.id)
                    : await castVoteAction(entry.id, choice, entry.note ?? '');
                setBusyId(null);
                if (!result.ok) {
                    toast.error(result.message);
                    return;
                }
                replace(result.data);
                // why: withdrawing leaves nothing to explain, so the box has
                // nothing to be open for. A fresh choice with no note on file
                // yet is exactly the moment to ask why -- open it. A note
                // already sent is final: it moves to admin review, not back
                // into an editable box.
                setExpandedId(withdrawing || hasSavedNote ? null : entry.id);
            });
        },
        [replace],
    );

    const setDraftNote = useCallback((id: string, note: string) => {
        setEntries((current) =>
            current.map((row) => (row.id === id ? { ...row, note } : row)),
        );
    }, []);

    const sendReason = useCallback(
        (entry: RoadmapEntry, note: string) => {
            if (entry.myVote === null) return;
            setBusyId(entry.id);
            startTransition(async () => {
                const result = await castVoteAction(entry.id, entry.myVote!, note);
                setBusyId(null);
                if (!result.ok) {
                    toast.error(result.message);
                    return;
                }
                replace(result.data);
                setExpandedId(null);
            });
        },
        [replace],
    );

    const notePlaceholder = useCallback(
        (entry: RoadmapEntry) =>
            entry.commentPrompt ??
            (entry.myVote === VoteChoice.Yes
                ? 'What would you use it for?'
                : "What's missing for you?"),
        [],
    );

    return {
        entries,
        busyId,
        expandedId,
        vote,
        sendReason,
        setDraftNote,
        notePlaceholder,
    };
}
