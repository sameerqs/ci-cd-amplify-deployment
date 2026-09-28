"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SecondaryAction =
  | {
      type: "link";
      href: string;
      label: string;
    }
  | {
      type: "button";
      label: string;
      onClick: () => void;
    };

export interface DashboardErrorViewProps {
  title?: string;
  /** User-friendly message from backend, or a general fallback when backend provides none. Do not pass stack or technical details here. */
  primaryMessage?: string;
  description?: string;
  /** Optional technical details (not shown in UI; stack is never displayed). Kept for future use only. */
  technicalDetails?: string | null;
  /** Error ID (digest) – always shown when provided. */
  digest?: string | null;
  onRetry?: () => void;
  primaryActionLabel?: string;
  secondaryAction?: SecondaryAction;
  logError?: Error | unknown;
  className?: string;
}

export function DashboardErrorView({
  title = "Something went wrong",
  primaryMessage = "An unexpected error occurred. Please try again.",
  description,
  digest,
  onRetry,
  primaryActionLabel = "Try again",
  secondaryAction,
  logError,
  className,
}: DashboardErrorViewProps) {
  useEffect(() => {
    if (logError) {
      // Centralised logging hook for segment-level errors
      // eslint-disable-next-line no-console
      console.error("Dashboard error:", logError);
    }
  }, [logError]);

  return (
    <div
      className={cn(
        "flex min-h-[min(60vh,24rem)] flex-col items-center justify-center px-6 py-8",
        className,
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex max-w-[24rem] flex-col items-center gap-6 text-center">
        <div
          className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"
          aria-hidden
        >
          <svg
            className="size-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-xl font-semibold text-foreground">{title}</h1>
          <p className="m-0 text-sm text-muted-foreground">
          Something went wrong. Please refresh the page or try again later.
            {/* {primaryMessage} */}
          </p>
          {description && (
            <p className="m-0 mt-1 text-xs text-muted-foreground/90">
              {description}
            </p>
          )}
          {digest && (
            <p className="m-0 mt-1 text-xs text-muted-foreground/80 break-all">
              Error ID: {digest}
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {onRetry && (
            <Button
              type="button"
              variant="gradient"
              size="default"
              onClick={onRetry}
            >
              {primaryActionLabel}
            </Button>
          )}

          {secondaryAction &&
            (secondaryAction.type === "link" ? (
              <Button
                asChild
                type="button"
                variant="outline"
                size="default"
              >
                <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            ))}
        </div>
      </div>
    </div>
  );
}

