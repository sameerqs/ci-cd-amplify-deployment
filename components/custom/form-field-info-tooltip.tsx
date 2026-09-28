"use client";

import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { IconInfoCircle } from "@tabler/icons-react";

export function labelToAccessibilityText(label: React.ReactNode): string {
  if (typeof label === "string" || typeof label === "number") {
    return String(label);
  }
  return "this field";
}

const TRIGGER_CLASS =
  "inline-flex shrink-0 rounded-sm text-muted-foreground outline-none ring-offset-background transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

type FormFieldInfoTooltipProps = {
  helper: string;
  /** Matches `More information: …` prefix for the trigger's aria-label (e.g. field or section title). */
  label?: React.ReactNode;
  /** `wide` (~24rem) for longer copy; FormInput/Textarea historically use narrower tooltips. */
  contentMaxWidth?: "narrow" | "wide";
};

export function FormFieldInfoTooltip({
  helper,
  label,
  contentMaxWidth = "narrow",
}: FormFieldInfoTooltipProps) {
  const labelText = label != null ? labelToAccessibilityText(label) : null;
  const ariaLabel = labelText
    ? `More information: ${labelText}`
    : "More information about this field";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={TRIGGER_CLASS} aria-label={ariaLabel}>
          <IconInfoCircle className="size-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        className={cn(
          "text-balance",
          contentMaxWidth === "wide" ? "max-w-sm" : "max-w-xs",
        )}
      >
        {helper}
      </TooltipContent>
    </Tooltip>
  );
}

type FormStaticLabelWithInfoProps = {
  /** Used for visible text and tooltip aria-label (`More information: …`). */
  label: string;
  description: string;
  className?: string;
};

/**
 * Plain `Label` + info icon for read-only stacks (e.g. email) where there is
 * no `FormInput` wrapper.
 */
export function FormStaticLabelWithInfo({
  label,
  description,
  className,
}: FormStaticLabelWithInfoProps) {
  return (
    <>
      <div
        className={cn(
          "inline-flex max-w-full flex-wrap items-baseline gap-1.5",
          className,
        )}
      >
        <Label className="text-sm font-medium">{label}</Label>
        <FormFieldInfoTooltip
          helper={description}
          label={label}
          contentMaxWidth="wide"
        />
      </div>
      <span className="sr-only">{description}</span>
    </>
  );
}
