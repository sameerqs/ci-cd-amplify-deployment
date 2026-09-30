'use client';

import Link from 'next/link';
import { SendHorizonal } from 'lucide-react';

import { TrustPill } from '@/components/product/beta-disclaimer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PRODUCT_ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';

import {
    petMetaLine,
    type Conversation,
    type Pet,
} from '../../_lib/types';
import { CHAT_COLUMN_WIDTH } from '../_lib/layout';
import { QUICK_REPLIES, useChatWorkspace } from '../hooks/use-chat-workspace';
import { AttachmentChip } from './attachment-chip';
import { CameraCapturePanel } from './camera-capture-panel';
import { CaptureSheet } from './capture-sheet';
import { MessageBubble } from './message-bubble';

interface ChatWorkspaceProps {
    pets: Pet[];
    conversation: Conversation | null;
    /** Resolved server-side from ?pet=; the URL owns the selection. */
    activePetId: string | null;
}

export function ChatWorkspace({
    pets,
    conversation,
    activePetId,
}: ChatWorkspaceProps) {
    const {
        activePet,
        livePets,
        timeline,
        composerRef,
        scrollContainerRef,
        selectPet,
        conversation: live,
        draft,
        setDraft,
        canSend,
        isBusy,
        send,
        isCaptureOpen,
        openCapture,
        closeCapture,
        isCameraOpen,
        openCamera,
        closeCamera,
        pendingFiles,
        addFiles,
        removeFile,
        loadOlder,
        isLoadingOlder,
        showQuickReplies,
        sendQuickReply,
        canRetry,
        retry,
    } = useChatWorkspace({
        pets,
        initialConversation: conversation,
        activePetId,
    });

    if (!activePet) return <EmptyState />;

    return (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            <header className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-1">
                <span className="font-heading text-[17px]">
                    {activePet.name}
                </span>
                <span className="rounded-full bg-[var(--neutral-200)] px-3 py-1 text-[10.5px] text-[var(--neutral-700)]">
                    {petMetaLine(activePet)}
                </span>
            </header>

            {livePets.length > 1 ? (
                <div className="flex shrink-0 gap-2 overflow-x-auto px-4 pb-2 lg:hidden">
                    {livePets.map((pet) => (
                        <button
                            key={pet.id}
                            type="button"
                            onClick={() => selectPet(pet.id)}
                            aria-pressed={pet.id === activePet.id}
                            className={cn(
                                'shrink-0 rounded-full px-3.5 py-1.5 text-[13px]',
                                pet.id === activePet.id
                                    ? 'bg-[var(--accent-200)] font-semibold text-[var(--accent-900)]'
                                    : 'bg-[var(--neutral-200)] text-[var(--neutral-700)]',
                            )}
                        >
                            {pet.name}
                        </button>
                    ))}
                </div>
            ) : null}

            <TrustPill className="mx-4 mb-2.5 shrink-0" />

            <div
                ref={scrollContainerRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-1 pt-2"
                role="log"
                aria-live="polite"
                aria-relevant="additions"
                onScroll={(event) => {
                    if (
                        event.currentTarget.scrollTop < 80 &&
                        live?.hasMoreMessages &&
                        !isLoadingOlder
                    ) {
                        loadOlder();
                    }
                }}
            >
                <div className={cn('mx-auto flex flex-col gap-3', CHAT_COLUMN_WIDTH)}>
                    {live?.hasMoreMessages ? (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={loadOlder}
                            disabled={isLoadingOlder}
                            className="self-center text-[13px]"
                        >
                            {isLoadingOlder ? 'Loading older messages…' : 'Load older messages'}
                        </Button>
                    ) : null}
                    {timeline.map((item) =>
                        item.kind === 'message' ? (
                            <MessageBubble
                                key={item.message.id}
                                message={item.message}
                            />
                        ) : (
                            <AttachmentChip
                                key={item.attachment.id}
                                attachment={item.attachment}
                            />
                        ),
                    )}

                    {isBusy ? <ThinkingIndicator /> : null}

                    {showQuickReplies ? (
                        <div className="flex flex-wrap gap-2 self-start">
                            {QUICK_REPLIES.map((label) => (
                                <Button
                                    key={label}
                                    type="button"
                                    variant="outline"
                                    onClick={() => sendQuickReply(label)}
                                    disabled={isBusy}
                                    className="min-h-[38px] rounded-full text-[13.5px]"
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                    ) : null}

                    {canRetry ? (
                        <div
                            role="alert"
                            className="flex items-center justify-between gap-3 self-start rounded-[18px] border border-[var(--status-danger-fg)]/30 bg-[var(--status-danger-bg)] px-4 py-2.5 text-[13.5px] text-[var(--status-danger-fg)]"
                        >
                            <span>Couldn&apos;t send that.</span>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={retry}
                                disabled={isBusy}
                                className="h-auto px-2 py-1 text-[13.5px] text-[var(--status-danger-fg)] underline"
                            >
                                Retry
                            </Button>
                        </div>
                    ) : null}
                </div>
            </div>

            {isCameraOpen ? (
                <CameraCapturePanel onCaptured={addFiles} onClose={closeCamera} />
            ) : null}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    send();
                }}
                className="shrink-0 px-4 pb-1.5 pt-2"
            >
                {pendingFiles.length > 0 ? (
                    <div className={cn('mx-auto mb-2 flex flex-wrap gap-2', CHAT_COLUMN_WIDTH)}>
                        {pendingFiles.map((file, index) => (
                            <div
                                key={`${file.name}-${index}`}
                                className="flex items-center gap-2 rounded-full border border-[var(--neutral-200)] bg-card px-3 py-1.5 text-[12px]"
                            >
                                <span className="max-w-[180px] truncate">{file.name}</span>
                                <button
                                    type="button"
                                    aria-label={`Remove ${file.name}`}
                                    onClick={() => removeFile(index)}
                                    className="text-[var(--neutral-600)] hover:text-[var(--neutral-900)]"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                ) : null}

                <div className={cn('mx-auto flex items-end gap-2.5', CHAT_COLUMN_WIDTH)}>
                    <CaptureSheet
                        open={isCaptureOpen}
                        onOpenChange={(open) => (open ? openCapture() : closeCapture())}
                        onPicked={addFiles}
                        onCamera={openCamera}
                    />
                    <Input
                        ref={composerRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Type what happened…"
                        aria-label="Message"
                        disabled={isBusy}
                        className="min-h-[46px] flex-1 text-[15px]"
                    />
                    <Button
                        type="submit"
                        size="icon"
                        aria-label="Send"
                        disabled={!canSend}
                        className="size-[46px] shrink-0"
                    >
                        <SendHorizonal className="size-5" />
                    </Button>
                </div>
            </form>
        </div>
    );
}

function ThinkingIndicator() {
    return (
        <div
            role="status"
            aria-live="polite"
            className="self-start rounded-[20px] bg-surface px-4 py-3"
        >
            <span className="sr-only">Writing a reply</span>
            <span className="flex items-center gap-1.5" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        style={{ animationDelay: `${i * 160}ms` }}
                        className="size-1.5 animate-bounce rounded-full bg-[var(--neutral-500)]"
                    />
                ))}
            </span>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <h1 className="font-heading text-[24px]">No pets yet</h1>
            <p className="max-w-[280px] text-[14.5px] leading-[1.55] text-[var(--neutral-700)]">
                Add a pet and we&apos;ll keep their chats separate from everyone
                else&apos;s.
            </p>
            <Button asChild className="mt-1 min-h-12 px-6">
                <Link href={PRODUCT_ROUTES.NEW_CHAT}>Add a pet</Link>
            </Button>
        </div>
    );
}
