'use client';

import { UploadCloud } from 'lucide-react';
import {
    forwardRef,
    useImperativeHandle,
    useRef,
    useState,
    type DragEvent,
    type ForwardedRef,
} from 'react';
import { toast } from "@/lib/toast";

import {
    UPLOAD_ACCEPT_EXTENSIONS,
    UPLOAD_MAX_SIZE_BYTES,
    extensionOf,
    formatUploadSize,
} from '@/lib/constants/upload-file-types';
import { cn } from '@/lib/utils';

export type FileDropZoneHandle = { open: () => void };

type FileDropZoneProps = {
    onFilesAdded: (files: File[]) => void;
    /** Lowercased, leading-dot extensions. */
    accept?: readonly string[];
    maxSizeBytes?: number;
    supportedFormatsLabel?: string;
    /** Hidden when maxSizeBytes is undefined. */
    maxSizeLabel?: string;
    disabled?: boolean;
    className?: string;
};

function FileDropZoneInner(
    {
        onFilesAdded,
        accept = UPLOAD_ACCEPT_EXTENSIONS,
        maxSizeBytes = UPLOAD_MAX_SIZE_BYTES,
        supportedFormatsLabel,
        maxSizeLabel,
        disabled = false,
        className,
    }: FileDropZoneProps,
    ref: ForwardedRef<FileDropZoneHandle>,
) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    useImperativeHandle(ref, () => ({
        open: () => {
            if (!disabled) inputRef.current?.click();
        },
    }));

    const acceptAttr = accept.join(',');
    const formatsLine =
        supportedFormatsLabel ??
        `Supported formats: ${accept.map((e) => e.replace('.', '').toUpperCase()).join(', ')}`;
    const sizeLine =
        maxSizeBytes !== undefined
            ? (maxSizeLabel ?? `Max size: ${formatUploadSize(maxSizeBytes)}`)
            : undefined;

    const acceptedLookup = new Set(accept.map((e) => e.toLowerCase()));

    const filterFiles = (files: File[]): File[] => {
        const valid: File[] = [];
        for (const file of files) {
            const ext = extensionOf(file.name);
            if (accept.length > 0 && !acceptedLookup.has(ext)) {
                toast.error(`"${file.name}" — unsupported file type.`);
                continue;
            }
            if (maxSizeBytes !== undefined && file.size > maxSizeBytes) {
                toast.error(
                    `"${file.name}" exceeds the ${formatUploadSize(maxSizeBytes)} limit.`,
                );
                continue;
            }
            valid.push(file);
        }
        return valid;
    };

    const onPicked = (list: FileList | null) => {
        if (!list || list.length === 0) return;
        const valid = filterFiles(Array.from(list));
        if (valid.length > 0) onFilesAdded(valid);
    };

    const onDragOver = (e: DragEvent<HTMLDivElement>) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragOver(true);
    };
    const onDragLeave = () => setIsDragOver(false);
    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragOver(false);
        onPicked(e.dataTransfer.files);
    };

    return (
        <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            onClick={() => !disabled && inputRef.current?.click()}
            onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputRef.current?.click();
                }
            }}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors',
                'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isDragOver
                    ? 'border-primary bg-accent'
                    : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-accent/40',
                disabled && 'pointer-events-none opacity-60',
                className,
            )}
        >
            <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">
                Click or drag files to this area to upload
            </p>
            <p className="text-xs text-muted-foreground">{formatsLine}</p>
            {sizeLine && (
                <p className="text-xs text-muted-foreground">{sizeLine}</p>
            )}
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={acceptAttr}
                hidden
                onChange={(e) => {
                    onPicked(e.target.files);
                    e.target.value = '';
                }}
            />
        </div>
    );
}

const FileDropZone = forwardRef(FileDropZoneInner);
FileDropZone.displayName = 'FileDropZone';
export default FileDropZone;
