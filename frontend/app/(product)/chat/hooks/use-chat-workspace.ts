'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { toast } from '@/lib/toast';
import { PRODUCT_ROUTES } from '@/lib/routes';

import {
    buildTimeline,
    MessageAuthor,
    type ChatMessage,
    type Conversation,
    type Pet,
    type TimelineItem,
} from '../../_lib/types';
import { openConversation } from '../_lib/api';
import { sendMessageAction, trackEventAction } from '../_lib/actions';

interface UseChatWorkspaceArgs {
    pets: Pet[];
    initialConversation: Conversation | null;
    /**
     * The pet the URL resolved to, decided server-side. Source of truth for
     * which chat is open -- deriving it from the conversation instead meant a
     * failed conversation fetch (which arrives as null) silently fell back to
     * the first pet while the URL, the rail and the chip row still said another.
     */
    activePetId: string | null;
}

/** PET-7's two starting chips, sent verbatim as the owner's first message. */
export const QUICK_REPLIES = ['Start with the bill', 'Something I noticed'] as const;

interface FailedSend {
    body: string;
    files: File[];
}

interface UseChatWorkspaceResult {
    activePet: Pet | null;
    timeline: TimelineItem[];
    composerRef: React.RefObject<HTMLInputElement | null>;
    /** Attach to the scrollable message list -- auto-scrolls to the newest turn. */
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    applyConversation: (next: Conversation) => void;
    livePets: Pet[];
    selectPet: (id: string) => void;
    conversation: Conversation | null;
    draft: string;
    setDraft: (value: string) => void;
    canSend: boolean;
    isBusy: boolean;
    send: () => void;
    isCaptureOpen: boolean;
    openCapture: () => void;
    closeCapture: () => void;
    isCameraOpen: boolean;
    openCamera: () => void;
    closeCamera: () => void;
    /** Files chosen but not sent yet — they sit in the composer until Send. */
    pendingFiles: File[];
    addFiles: (files: File[]) => void;
    removeFile: (index: number) => void;
    loadOlder: () => void;
    isLoadingOlder: boolean;
    /** True only for a brand-new chat: the greeting and nothing else yet. */
    showQuickReplies: boolean;
    sendQuickReply: (label: (typeof QUICK_REPLIES)[number]) => void;
    /** Set the moment a send fails; cleared on the next attempt either way. */
    canRetry: boolean;
    retry: () => void;
}

/**
 * The owner's turn, echoed locally until the server's copy lands.
 *
 * why: the API answers with the whole conversation only once the model has
 * replied, so what someone typed used to stay invisible for the length of the
 * round-trip and then appear in the same frame as the answer to it. Files are
 * deliberately left off: their download URL is built from a storage key that
 * does not exist yet, and a files-only send skips the echo entirely rather
 * than render an empty bubble.
 */
function echoMessage(body: string): ChatMessage {
    return {
        id: `pending-${crypto.randomUUID()}`,
        author: MessageAuthor.Owner,
        body,
        isEmergencyNotice: false,
        createdAt: new Date().toISOString(),
        attachments: [],
    };
}

/** Identity of the most recent timeline entry, or null for an empty one. */
function lastTimelineItemKey(timeline: TimelineItem[]): string | null {
    const last = timeline[timeline.length - 1];
    if (!last) return null;
    return last.kind === 'message' ? `m:${last.message.id}` : `a:${last.attachment.id}`;
}

function toForm(body: string, files: File[]): FormData {
    const form = new FormData();
    form.append('body', body);
    for (const file of files) form.append('files', file);
    return form;
}

export function useChatWorkspace({
    pets,
    initialConversation,
    activePetId,
}: UseChatWorkspaceArgs): UseChatWorkspaceResult {
    const router = useRouter();
    const livePets = useMemo(() => pets.filter((p) => !p.isArchived), [pets]);
    const [conversation, setConversation] = useState<Conversation | null>(
        initialConversation,
    );
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [echoes, setEchoes] = useState<ChatMessage[]>([]);
    // why: the conversation arrives as a prop from a server render keyed on the
    // ?pet= param, so a pet switch must reset the locally-held copy. Keyed on
    // the resolved pet rather than the conversation's own petId, or a null
    // conversation reads as "no change" and leaves the previous pet's
    // transcript on screen under the new pet's header.
    const [seenPetId, setSeenPetId] = useState(activePetId);
    if (seenPetId !== activePetId) {
        setSeenPetId(activePetId);
        setConversation(initialConversation);
        // why: a file picked for one pet must never follow you to another's chat.
        setPendingFiles([]);
        setEchoes([]);
    }
    const [draft, setDraft] = useState('');
    const [isCaptureOpen, setCaptureOpen] = useState(false);
    const [isCameraOpen, setCameraOpen] = useState(false);
    const [lastFailedSend, setLastFailedSend] = useState<FailedSend | null>(null);
    const composerRef = useRef<HTMLInputElement | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isLoadingOlder, startLoadingOlder] = useTransition();

    const focusComposer = useCallback(() => {
        composerRef.current?.focus();
    }, []);

    const activePet =
        livePets.find((p) => p.id === activePetId) ?? livePets[0] ?? null;


    const mergeConversation = useCallback(
        (next: Conversation, older: boolean) => {
            setConversation((current) => {
                if (!current || current.id !== next.id) return next;
                const messages = older
                    ? [...next.messages, ...current.messages]
                    : [...current.messages, ...next.messages];
                const uniqueMessages = Array.from(
                    new Map(messages.map((message) => [message.id, message])).values(),
                );
                const attachments = Array.from(
                    new Map(
                        [...current.attachments, ...next.attachments].map((attachment) => [
                            attachment.id,
                            attachment,
                        ]),
                    ).values(),
                );
                return { ...next, messages: uniqueMessages, attachments };
            });
        },
        [],
    );

    const run = useCallback(
        (
            work: () => Promise<{ ok: boolean; data?: Conversation; message?: string }>,
            onFailure?: () => void,
        ) => {
            startTransition(async () => {
                const result = await work();
                // why: cleared on the same tick the outcome lands, either way --
                // on success the server's copy of the turn replaces it, on
                // failure the Retry banner is what is left to act on. Clearing
                // it in a separate update would flash the turn twice.
                setEchoes([]);
                if (!result.ok || !result.data) {
                    toast.error(result.message ?? 'Something went wrong.');
                    onFailure?.();
                    return;
                }
                mergeConversation(result.data, false);
            });
        },
        [mergeConversation],
    );

    const post = useCallback(
        (body: string, files: File[]) => {
            if (!activePet) return;
            // why: cleared optimistically so a successful send always leaves no
            // stale Retry behind; onFailure below puts it right back.
            setLastFailedSend(null);
            if (body) setEchoes([echoMessage(body)]);
            run(
                () => sendMessageAction(activePet.id, toForm(body, files)),
                // why: a failure needs an explicit way back in, not just a
                // restored composer -- Retry resends exactly what failed even
                // if the owner has since changed what's in the box.
                () => setLastFailedSend({ body, files }),
            );
        },
        [activePet, run],
    );

    const loadOlder = useCallback(() => {
        if (!activePet || !conversation?.hasMoreMessages || conversation.nextBefore == null) {
            return;
        }
        const before = conversation.nextBefore;
        startLoadingOlder(async () => {
            try {
                const result = await openConversation(activePet.id, before);
                mergeConversation(result, true);
            } catch {
                toast.error('Failed to load older messages.');
            }
        });
    }, [activePet, conversation, mergeConversation]);

    const timeline = useMemo(
        () => buildTimeline(conversation, echoes),
        [conversation, echoes],
    );

    // why: the message list otherwise stayed wherever it was scrolled while a
    // new turn -- the owner's own echoed message, or the assistant's reply --
    // landed below the fold, invisible until scrolled to manually. Keyed on the
    // identity of the LAST item rather than on `timeline` itself, so loading
    // older history (which prepends at the top and leaves the last item
    // unchanged) does not yank the view back down while it's being read.
    const lastItemKey = lastTimelineItemKey(timeline);
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [lastItemKey, isPending]);

    return {
        activePet,
        livePets,
        timeline,
        composerRef,
        scrollContainerRef,
        applyConversation: setConversation,
        selectPet: (id: string) => router.push(`${PRODUCT_ROUTES.CHAT}?pet=${id}`),
        conversation,
        draft,
        setDraft,
        canSend: (draft.trim().length > 0 || pendingFiles.length > 0) && !isPending,
        isBusy: isPending,
        send: () => {
            const body = draft.trim();
            const files = pendingFiles;
            if (!body && files.length === 0) return;
            // why: the composer used to be cleared before the request and never
            // restored, so a failed send destroyed what the user had typed and
            // left them nothing to retry from. The files go back too, via
            // post()'s own onFailure -- not duplicated here.
            setDraft('');
            setPendingFiles([]);
            post(body, files);
        },
        isCaptureOpen,
        openCapture: () => {
            void trackEventAction('capture_sheet_opened');
            setCaptureOpen(true);
        },
        closeCapture: () => setCaptureOpen(false),
        isCameraOpen,
        // why: the picker is what launched the viewfinder, so it gets out of
        // the way -- leaving a popover open over a live camera helps nobody.
        openCamera: () => {
            setCaptureOpen(false);
            setCameraOpen(true);
        },
        closeCamera: () => setCameraOpen(false),
        pendingFiles,
        addFiles: (files: File[]) => {
            setPendingFiles((current) => [...current, ...files]);
            focusComposer();
        },
        removeFile: (index: number) =>
            setPendingFiles((current) => current.filter((_, i) => i !== index)),
        loadOlder,
        isLoadingOlder,
        // why: only a brand-new chat -- the greeting and nothing else, with no
        // older page to load -- offers the chips. Once the owner has said
        // anything, in whatever order they chose, the prompt no longer fits.
        showQuickReplies: Boolean(
            conversation &&
                !conversation.hasMoreMessages &&
                conversation.messages.length === 1 &&
                conversation.messages[0]?.author === MessageAuthor.Assistant,
        ),
        sendQuickReply: (label) => {
            void trackEventAction('chip_tapped', { label });
            post(label, []);
        },
        canRetry: lastFailedSend !== null,
        retry: () => {
            if (!lastFailedSend) return;
            post(lastFailedSend.body, lastFailedSend.files);
        },
    };
}
