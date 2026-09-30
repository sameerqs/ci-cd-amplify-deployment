'use client';

import { Camera, FileUp, ImagePlus, Plus } from 'lucide-react';

import { HoverTooltip } from '@/components/custom/hover-tooltip';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { IMAGE_ATTACHMENT_ACCEPT_ATTR } from '@/lib/constants/attachment-types';
import { cn } from '@/lib/utils';

import type { AttachmentPickMode } from '../hooks/use-attachment-upload';
import { useAttachmentUpload } from '../hooks/use-attachment-upload';

interface CaptureSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPicked?: (files: File[]) => void;
    onCamera: () => void;
}

interface CaptureOption {
    label: string;
    mode: AttachmentPickMode;
    tint: string;
    tone: string;
    Icon: typeof Camera;
}

const OPTIONS: CaptureOption[] = [
    {
        label: 'Take a picture',
        mode: 'camera',
        tint: 'bg-[var(--accent-200)]',
        tone: 'text-[var(--accent-800)]',
        Icon: Camera,
    },
    {
        label: 'Choose a photo',
        mode: 'image',
        tint: 'bg-[var(--accent-2-200)]',
        tone: 'text-[var(--accent-2-800)]',
        Icon: ImagePlus,
    },
    {
        label: 'Upload a file',
        mode: 'pdf',
        tint: 'bg-[var(--neutral-200)]',
        tone: 'text-[var(--neutral-800)]',
        Icon: FileUp,
    },
];

/**
 * The three ways to attach something. A popover, not a sheet -- it opens
 * right off the attach button with no backdrop dimming the chat behind it,
 * and closes on an outside click same as any other popover. Icon-only; what
 * each one is for shows on hover, and is always on the button as
 * `aria-label` for anyone not hovering.
 */
export function CaptureSheet({
    open,
    onOpenChange,
    onPicked,
    onCamera,
}: CaptureSheetProps) {
    const {
        pick,
        inputRef,
        onFilesChosen,
        accept,
        cameraAvailable,
        isCheckingCamera,
    } = useAttachmentUpload({
        open,
        onPicked: (files) => {
            onPicked?.(files);
            onOpenChange(false);
        },
        onDone: () => onOpenChange(false),
        onCamera,
    });

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    size="icon"
                    aria-label="Add an attachment"
                    className="size-[46px] shrink-0"
                >
                    <Plus className="size-[22px]" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                align="start"
                sideOffset={10}
                className="flex w-auto gap-3 rounded-[28px] border-[var(--neutral-200)] bg-card p-3 shadow-lg"
            >
                {OPTIONS.map((option) => {
                    const cameraBlocked =
                        option.mode === 'camera' && !isCheckingCamera && !cameraAvailable;
                    const label = cameraBlocked
                        ? 'No camera detected on this device'
                        : option.label;
                    return (
                        <HoverTooltip key={option.mode} content={label}>
                            <button
                                type="button"
                                aria-label={label}
                                disabled={
                                    option.mode === 'camera' &&
                                    (isCheckingCamera || !cameraAvailable)
                                }
                                onClick={() => pick(option.mode)}
                                className={cn(
                                    'flex size-[54px] items-center justify-center rounded-[18px] transition-transform disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:scale-[1.05] enabled:active:scale-95',
                                    option.tint,
                                )}
                            >
                                <option.Icon
                                    className={option.tone}
                                    size={22}
                                    strokeWidth={2.25}
                                    aria-hidden
                                />
                            </button>
                        </HoverTooltip>
                    );
                })}

                <input
                    ref={inputRef}
                    type="file"
                    accept={accept || IMAGE_ATTACHMENT_ACCEPT_ATTR}
                    onChange={onFilesChosen}
                    className="hidden"
                    aria-hidden
                    tabIndex={-1}
                />
            </PopoverContent>
        </Popover>
    );
}
