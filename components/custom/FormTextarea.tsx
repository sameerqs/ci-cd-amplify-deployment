"use client";

import * as React from "react";
import {
  Controller,
  type FieldValues,
  type RegisterOptions,
  useFormContext,
} from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import FormError from "./FormError";
import { FormFieldInfoTooltip } from "./form-field-info-tooltip";
import FormLabel from "./FormLabel";

type Props = {
  name: string;
  control?: import("react-hook-form").Control<import("react-hook-form").FieldValues>;
  label?: React.ReactNode;
  rules?: RegisterOptions<FieldValues>;
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
  rows?: number;
  isRequired?: boolean;
  maxLength?: number;
  maxLengthMessage?: string;
  helper?: string;
  density?: "default" | "compact";
  className?: string;
  fillHeight?: boolean;
};

export default function FormTextarea({
  name,
  control: externalControl,
  label,
  rules = {},
  placeholder = "",
  defaultValue = "",
  disabled = false,
  rows = 3,
  isRequired = false,
  maxLength,
  maxLengthMessage,
  helper,
  density = "default",
  className,
  fillHeight = false,
}: Props) {
  const formContext = useFormContext();
  const control = externalControl || formContext?.control;
  const trigger = formContext?.trigger;

  if (!control) {
    throw new Error(
      "FormTextarea requires either a control prop or must be used within a FormProvider",
    );
  }

  const fieldLabel = typeof label === "string" ? label : "This field";
  const resolvedMaxLengthMessage =
    maxLengthMessage ?? `${fieldLabel} must be ${maxLength} characters or fewer.`;

  const mergedRules = React.useMemo((): RegisterOptions<FieldValues> => {
    if (!maxLength) return rules;
    return {
      ...rules,
      maxLength: {
        value: maxLength,
        message: resolvedMaxLengthMessage,
      },
    };
  }, [rules, maxLength, resolvedMaxLengthMessage]);

  return (
    <div
      className={cn(
        "space-y-1",
        fillHeight && "flex min-h-0 flex-col lg:flex-1",
      )}
    >
      {label && !helper && (
        <FormLabel htmlFor={name} required={Boolean(rules?.required) || isRequired}>
          {label}
        </FormLabel>
      )}
      {label && helper && (
        <div className="inline-flex max-w-full flex-wrap items-baseline gap-1.5">
          <div className="min-w-0">
            <FormLabel htmlFor={name} required={Boolean(rules?.required) || isRequired}>
              {label}
            </FormLabel>
          </div>
          <FormFieldInfoTooltip helper={helper} label={label} />
        </div>
      )}
      {!label && helper && <FormFieldInfoTooltip helper={helper} />}
      {helper ? (
        <span id={`${name}-description`} className="sr-only">
          {helper}
        </span>
      ) : null}

      <Controller
        name={name}
        control={control}
        rules={mergedRules}
        defaultValue={defaultValue}
        render={({ field, fieldState }) => {
          const currentLength = (field.value ?? "").length;
          const isAtOrOverLimit = maxLength != null && currentLength >= maxLength;
          const charCountId = `${name}-charcount`;
          const showCount = maxLength != null;
          const ariaDescribedBy = [
            fieldState.error ? `${name}-error` : null,
            helper ? `${name}-description` : null,
            showCount ? charCountId : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined;

          const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const nextValue = e.target.value;
            field.onChange(nextValue);
            if (maxLength != null && nextValue.length > maxLength) {
              void trigger?.(name);
            }
          };

          return (
            <div
              className={cn(
                fillHeight && "flex min-h-0 flex-col lg:flex-1",
              )}
            >
              <div
                className={cn(
                  "relative",
                  fillHeight && "flex min-h-0 flex-col lg:flex-1",
                )}
              >
                <Textarea
                  id={name}
                  {...field}
                  value={field.value ?? ""}
                  onChange={handleChange}
                  placeholder={placeholder || `Enter ${label ?? name}`}
                  disabled={disabled}
                  maxLength={maxLength}
                  className={cn(
                    density === "compact" && "min-h-18",
                    disabled && "disabled:bg-muted",
                    fillHeight &&
                      "min-h-32 max-h-48 resize-y overflow-y-auto lg:min-h-0 lg:max-h-[min(12rem,40vh)] lg:flex-1 lg:resize-none",
                    className,
                  )}
                  rows={rows}
                  aria-invalid={!!fieldState.error}
                  aria-describedby={ariaDescribedBy}
                />
                {showCount && maxLength != null && (
                  <div
                    id={charCountId}
                    className={`text-xs mt-1 text-right ${
                      isAtOrOverLimit
                        ? "text-destructive font-medium"
                        : "text-muted-foreground"
                    }`}
                    aria-live="polite"
                  >
                    {currentLength} / {maxLength} characters
                  </div>
                )}
              </div>
              <FormError error={fieldState.error} id={`${name}-error`} />
            </div>
          );
        }}
      />
    </div>
  );
}
