'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { IMAGE_ATTACHMENT_ACCEPT_ATTR, PDF_ATTACHMENT_ACCEPT_ATTR } from '@/lib/constants/attachment-types';
import { isValidAttachmentForKind } from '@/lib/utils/file-upload';

export type AttachmentPickMode = 'camera' | 'image' | 'pdf';

interface UseAttachmentPickerArgs {
    open: boolean;
    onPicked: (files: File[]) => void;
    onDone: () => void;
    /** "Take a picture" opens the in-app viewfinder, not a file dialog. */
    onCamera: () => void;
}

interface UseAttachmentPickerResult {
    pick: (mode: AttachmentPickMode) => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
    onFilesChosen: (event: React.ChangeEvent<HTMLInputElement>) => void;
    accept: string;
    cameraAvailable: boolean;
    isCheckingCamera: boolean;
}

/**
 * Choosing a file no longer uploads it. The files go to the composer so they
 * can be sent with whatever the owner types next — a photo with a question
 * attached is one turn, not two.
 */
export function useAttachmentPicker({
    open,
    onPicked,
    onDone,
    onCamera,
}: UseAttachmentPickerArgs): UseAttachmentPickerResult {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [mode, setMode] = useState<AttachmentPickMode>('image');
    const [accept, setAccept] = useState('');
    const [cameraAvailable, setCameraAvailable] = useState(false);
    const [isCheckingCamera, setIsCheckingCamera] = useState(true);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setIsCheckingCamera(true);
        if (!navigator.mediaDevices) {
            setCameraAvailable(false);
            setIsCheckingCamera(false);
            return;
        }
        void navigator.mediaDevices.enumerateDevices()
            .then((devices) => {
                if (!cancelled) {
                    setCameraAvailable(devices.some((device) => device.kind === 'videoinput'));
                    setIsCheckingCamera(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setCameraAvailable(false);
                    setIsCheckingCamera(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [open]);

    const pick = useCallback(
        (nextMode: AttachmentPickMode) => {
            // why: the viewfinder asks for the camera itself. Probing for it
            // here too would cost the owner two permission prompts for one
            // photo.
            if (nextMode === 'camera') {
                onCamera();
                return;
            }
            setMode(nextMode);
            // why: the shared attachment-types list is the single source of
            // truth for what pet2text accepts.
            setAccept(
                nextMode === 'pdf'
                    ? PDF_ATTACHMENT_ACCEPT_ATTR
                    : IMAGE_ATTACHMENT_ACCEPT_ATTR,
            );
            requestAnimationFrame(() => inputRef.current?.click());
        },
        [onCamera],
    );

    const onFilesChosen = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const chosen = Array.from(event.target.files ?? []);
            event.target.value = '';
            const valid = chosen.filter((file) => isValidAttachmentForKind(file, mode));
            if (valid.length === 0) return;
            onPicked(valid);
            onDone();
        },
        [mode, onDone, onPicked],
    );

    return {
        pick,
        inputRef,
        onFilesChosen,
        accept,
        cameraAvailable,
        isCheckingCamera,
    };
}

export const useAttachmentUpload = useAttachmentPicker;
