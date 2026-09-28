'use client';

import { Check, RotateCcw, SwitchCamera, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useCameraCapture } from '../hooks/use-camera-capture';

interface CameraCapturePanelProps {
    onCaptured: (files: File[]) => void;
    onClose: () => void;
}

/**
 * The viewfinder, inline above the composer rather than over it -- taking a
 * photo is not a destructive confirmation, so it gets a panel in the page, not
 * a dialog on top of one. The still it produces lands in the composer as a
 * pending file, exactly like one chosen from disk.
 */
export function CameraCapturePanel({
    onCaptured,
    onClose,
}: CameraCapturePanelProps) {
    const {
        videoRef,
        phase,
        errorMessage,
        previewUrl,
        isCapturing,
        facing,
        canSwitchCamera,
        switchCamera,
        capture,
        retake,
        keepPhoto,
        close,
    } = useCameraCapture({
        onCaptured: (file) => onCaptured([file]),
        onClose,
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
            {/* why: fixed + flex centering puts the viewfinder in the middle of
                the viewport both axes. No backdrop -- the card floats over the
                chat without dimming it, consistent with the no-overlay rule.
                max-w-[500px] stops it stretching on wide screens; below that
                it takes the full padded width so a phone gets edge-to-edge. */}
            <div className="w-full max-w-[500px] overflow-hidden rounded-[26px] border border-[var(--neutral-200)] bg-card shadow-xl">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-[13px] font-semibold">
                        {phase === 'review' ? 'Use this photo?' : 'Take a picture'}
                    </span>
                    <button
                        type="button"
                        onClick={close}
                        aria-label="Close the camera"
                        className="flex size-[30px] items-center justify-center rounded-full border border-[var(--neutral-200)] bg-card text-[var(--neutral-700)] transition-colors hover:bg-[var(--neutral-100)] hover:text-foreground"
                    >
                        <X className="size-4" aria-hidden />
                    </button>
                </div>

                {phase === 'error' ? (
                    <div className="px-4 pb-4" role="alert">
                        <p className="rounded-[18px] bg-[var(--status-danger-bg)] px-3.5 py-3 text-[13px] leading-[1.5] text-[var(--status-danger-fg)]">
                            {errorMessage}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* why: 360 keeps the whole panel -- header, frame and
                            controls -- inside the 500px ceiling, and the svh
                            term shrinks it further on a short screen so the
                            shutter and Cancel can never be pushed off. */}
                        <div className="relative aspect-[4/3] max-h-[min(360px,38svh)] w-full bg-[var(--neutral-900)]">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                aria-label="Camera viewfinder"
                                className={cn(
                                    'size-full object-cover',
                                    // why: a front-facing preview that isn't
                                    // mirrored feels backwards to everyone who
                                    // has ever used a phone. The captured frame
                                    // is left unflipped, so anything with text
                                    // on it still reads the right way round.
                                    facing === 'user' && '-scale-x-100',
                                    phase === 'review' && 'invisible',
                                )}
                            />
                            {previewUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- a blob: URL from the canvas, never a remote asset next/image could optimise.
                                <img
                                    src={previewUrl}
                                    alt="The photo you just took"
                                    className="absolute inset-0 size-full object-cover"
                                />
                            ) : null}
                            {phase === 'starting' ? (
                                <span
                                    aria-live="polite"
                                    className="absolute inset-0 flex items-center justify-center text-[13px] text-white/80"
                                >
                                    Starting the camera…
                                </span>
                            ) : null}
                        </div>

                        <div className="relative flex items-center justify-center gap-3 px-4 py-3">
                            {phase === 'review' ? (
                                <>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={retake}
                                        className="min-h-[42px] bg-card text-[13.5px]"
                                    >
                                        <RotateCcw className="size-4" aria-hidden />
                                        Retake
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={keepPhoto}
                                        className="min-h-[42px] text-[13.5px]"
                                    >
                                        <Check className="size-4" aria-hidden />
                                        Use photo
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={close}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-[13px] font-medium text-[var(--neutral-700)] transition-colors hover:bg-[var(--neutral-100)] hover:text-foreground"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={capture}
                                        disabled={phase !== 'live' || isCapturing}
                                        aria-label="Take the picture"
                                        className="size-[54px] rounded-full border-[5px] border-[var(--neutral-300)] bg-[var(--accent-500)] transition-transform disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:scale-105 enabled:active:scale-95"
                                    />
                                    {canSwitchCamera ? (
                                        <button
                                            type="button"
                                            onClick={switchCamera}
                                            disabled={isCapturing}
                                            aria-label={
                                                facing === 'environment'
                                                    ? 'Switch to the front camera'
                                                    : 'Switch to the back camera'
                                            }
                                            className="absolute right-4 top-1/2 flex size-[42px] -translate-y-1/2 items-center justify-center rounded-full border border-[var(--neutral-200)] bg-card text-[var(--neutral-700)] transition-colors hover:bg-[var(--neutral-100)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <SwitchCamera
                                                className="size-[18px]"
                                                aria-hidden
                                            />
                                        </button>
                                    ) : null}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
