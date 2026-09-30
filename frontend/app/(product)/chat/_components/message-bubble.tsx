'use client';

import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { MessageAuthor, type ChatMessage } from '../../_lib/types';
import { AttachmentPreview } from './attachment-preview';

export function MessageBubble({ message }: { message: ChatMessage }) {
    const isOwner = message.author === MessageAuthor.Owner;
    const sentAt = formatTime(message.createdAt);

    return (
        <div
            className={cn(
                'flex flex-col gap-1',
                isOwner ? 'items-end self-end' : 'items-start self-start',
                isOwner ? 'max-w-[86%]' : 'max-w-[88%]',
            )}
        >
            <div
                className={cn(
                    'rounded-[24px] px-[17px] py-3.5 text-[15px] leading-[1.55]',
                    isOwner
                        ? 'rounded-br-lg bg-[var(--accent-200)] text-[var(--accent-900)]'
                        : 'rounded-bl-lg bg-surface text-surface-foreground',
                    message.isEmergencyNotice &&
                        'border border-[var(--status-danger-fg)]/30 bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]',
                )}
                role={message.isEmergencyNotice ? 'alert' : undefined}
            >
                {message.body}
                {message.attachments.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-2">
                        {message.attachments.map((attachment) => (
                            <AttachmentPreview
                                key={attachment.id}
                                attachment={attachment}
                            />
                        ))}
                    </div>
                ) : null}
            </div>
            {sentAt ? (
                <time
                    dateTime={message.createdAt}
                    className="px-2 text-[11px] text-[var(--neutral-600)]"
                >
                    {sentAt}
                </time>
            ) : null}
        </div>
    );
}
