'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Enough detail for a vet to read a label or a wound, without a 4MB still. */
const JPEG_QUALITY = 0.92;

export type CameraPhase = 'starting' | 'live' | 'review' | 'error';

/** Which way the lens points; 'environment' is the rear camera on a phone. */
export type CameraFacing = 'environment' | 'user';

interface UseCameraCaptureArgs {
    onCaptured: (file: File) => void;
    onClose: () => void;
}

interface UseCameraCaptureResult {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    phase: CameraPhase;
    errorMessage: string;
    previewUrl: string | null;
    isCapturing: boolean;
    facing: CameraFacing;
    /** True only once a second camera is known to exist. */
    canSwitchCamera: boolean;
    switchCamera: () => void;
    capture: () => void;
    retake: () => void;
    keepPhoto: () => void;
    close: () => void;
}

function cameraErrorMessage(error: unknown): string {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
        return 'Camera access is blocked. Allow it in your browser, then try again.';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        return 'No camera found on this device.';
    }
    if (name === 'NotReadableError') {
        return 'Another app is using the camera. Close it and try again.';
    }
    return "Couldn't start the camera.";
}

/**
 * The in-app viewfinder behind "Take a picture". The still it produces is a
 * plain JPEG `File`, handed to the same composer the file picker feeds, so a
 * captured photo and an uploaded one travel the identical path to S3.
 */
export function useCameraCapture({
    onCaptured,
    onClose,
}: UseCameraCaptureArgs): UseCameraCaptureResult {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [facing, setFacing] = useState<CameraFacing>('environment');
    const [canSwitchCamera, setCanSwitchCamera] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [captured, setCaptured] = useState<{ file: File; url: string } | null>(
        null,
    );

    // why: the stream starts on mount and every track is stopped on unmount.
    // The panel is only mounted while the viewfinder is on screen, so the
    // camera's hardware light can never outlive the UI that opened it.
    // Flipping the lens re-runs this: a phone will not hand out both cameras
    // at once, so the old stream has to be released before the new one opens.
    useEffect(() => {
        let cancelled = false;

        async function start(): Promise<void> {
            if (!navigator.mediaDevices?.getUserMedia) {
                setErrorMessage('This browser cannot open a camera here.');
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: facing },
                    audio: false,
                });
                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
                setIsStreaming(true);

                // why: device labels and the full camera list stay hidden until
                // permission is granted, so counting them before the stream
                // opens under-reports on mobile and hides the flip button on
                // the very devices that need it. A failed count costs the flip
                // button and nothing else -- it must not take down a
                // viewfinder that is already running.
                const devices = await navigator.mediaDevices
                    .enumerateDevices()
                    .catch(() => [] as MediaDeviceInfo[]);
                if (cancelled) return;
                const cameras = devices.filter(
                    (device) => device.kind === 'videoinput',
                );
                setCanSwitchCamera(cameras.length > 1);
            } catch (error) {
                if (!cancelled) setErrorMessage(cameraErrorMessage(error));
            }
        }

        void start();

        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        };
    }, [facing]);

    // why: an object URL survives its component unless it is handed back. This
    // revokes the previous still on every retake and the last one on unmount.
    useEffect(() => {
        if (!captured) return;
        return () => URL.revokeObjectURL(captured.url);
    }, [captured]);

    const capture = useCallback(() => {
        const video = videoRef.current;
        if (!video?.videoWidth || !video.videoHeight) return;

        setIsCapturing(true);
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) {
            setIsCapturing(false);
            setErrorMessage("Couldn't read the frame from the camera.");
            return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
            (blob) => {
                setIsCapturing(false);
                if (!blob) {
                    setErrorMessage("Couldn't save that frame. Try again.");
                    return;
                }
                const stamp = new Date()
                    .toISOString()
                    .slice(0, 19)
                    .replace(/[:T]/g, '-');
                setCaptured({
                    file: new File([blob], `photo-${stamp}.jpg`, {
                        type: 'image/jpeg',
                    }),
                    url: URL.createObjectURL(blob),
                });
            },
            'image/jpeg',
            JPEG_QUALITY,
        );
    }, []);

    const retake = useCallback(() => setCaptured(null), []);

    const switchCamera = useCallback(() => {
        // why: dropping the flag here rather than in the effect keeps the
        // shutter disabled across the swap without a setState in an effect
        // body, which this repo's lint rules ask new code to avoid.
        setIsStreaming(false);
        setFacing((current) => (current === 'environment' ? 'user' : 'environment'));
    }, []);

    const keepPhoto = useCallback(() => {
        if (!captured) return;
        onCaptured(captured.file);
        onClose();
    }, [captured, onCaptured, onClose]);

    const phase: CameraPhase = errorMessage
        ? 'error'
        : captured
          ? 'review'
          : isStreaming
            ? 'live'
            : 'starting';

    return {
        videoRef,
        phase,
        errorMessage,
        previewUrl: captured?.url ?? null,
        isCapturing,
        facing,
        canSwitchCamera,
        switchCamera,
        capture,
        retake,
        keepPhoto,
        close: onClose,
    };
}
