"use client";

import * as React from "react";
import { Control, Controller, FieldValues, RegisterOptions, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { formatNumberWithCommas, parseFormattedNumber } from "@/lib/utils/format-number";
import { MAX_INT } from "@/lib/validation/numeric-limits";
import { MAX_MONEY_VALUE } from "@/lib/utils/zod-schema";
import FormError from "./FormError";
import { FormFieldInfoTooltip } from "./form-field-info-tooltip";
import FormLabel from "./FormLabel";

type Props<T extends FieldValues = FieldValues> = {
  name: string;
  control?: Control<T>;
  label?: React.ReactNode;
  rules?: RegisterOptions<T>;
  placeholder?: string;
  defaultValue?: string | number;
  disabled?: boolean;
  /** Non-editable like disabled, but value is still submitted (RHF omits disabled fields). */
  readOnly?: boolean;
  type?: string;
  isRequired?: boolean;
  className?: string;
  helper?: string;
  maxLength?: number;
  maxLengthMessage?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  prefixAlign?: "inline-start" | "block-start";
  suffixAlign?: "inline-end" | "block-end";
  autoFocus?: boolean;
  allowDecimal?: boolean;
  decimalPlaces?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  /** Fires after value updates for non-number inputs (e.g. cross-field `trigger` in react-hook-form). */
  onValueUpdated?: (value: string) => void;
  inputClassName?: string;
  /** Runs after react-hook-form `field.onBlur()` (e.g. table row side effects). */
  onFieldBlur?: () => void;
};

export default function FormInput({
  name,
  control: externalControl,
  label,
  rules = {},
  placeholder = "",
  defaultValue = "",
  disabled = false,
  readOnly = false,
  type = "text",
  isRequired = false,
  className = "",
  helper,
  maxLength,
  maxLengthMessage,
  prefix,
  suffix,
  prefixAlign = "inline-start",
  suffixAlign = "inline-end",
  autoFocus = false,
  allowDecimal = true,
  decimalPlaces = 5,
  min,
  max,
  step,
  inputMode,
  onValueUpdated,
  inputClassName,
  onFieldBlur,
}: Props) {
  const formContext = useFormContext();
  const control = externalControl || formContext?.control;
  const trigger = formContext?.trigger;

  const fieldLabel = typeof label === "string" ? label : "This field";
  const resolvedMaxLengthMessage =
    maxLengthMessage ?? `${fieldLabel} must be ${maxLength} characters or fewer.`;

  const mergedRules = React.useMemo((): RegisterOptions<FieldValues> => {
    if (type === "number") {
      // Numeric inputs render as type="text" (for comma formatting), so the
      // native min/max attributes never fire — promote explicit min/max props to
      // real react-hook-form validation. Keeps PDF-breaking magnitudes out.
      const numberRules: RegisterOptions<FieldValues> = { ...rules };
      const maxNum =
        typeof max === "number" ? max : max != null ? Number(max) : undefined;
      const minNum =
        typeof min === "number" ? min : min != null ? Number(min) : undefined;
      if (maxNum != null && Number.isFinite(maxNum) && numberRules.max == null) {
        numberRules.max = {
          value: maxNum,
          message: `${fieldLabel} must be ${maxNum.toLocaleString()} or less.`,
        };
      }
      if (minNum != null && Number.isFinite(minNum) && numberRules.min == null) {
        numberRules.min = {
          value: minNum,
          message: `${fieldLabel} must be ${minNum.toLocaleString()} or more.`,
        };
      }
      return numberRules;
    }
    if (!maxLength) return rules;
    return {
      ...rules,
      maxLength: {
        value: maxLength,
        message: resolvedMaxLengthMessage,
      },
    };
  }, [rules, maxLength, type, resolvedMaxLengthMessage, max, min, fieldLabel]);

  const numberControlDefaults =
    type === "number"
      ? {
        min: min ?? (allowDecimal ? undefined : 1),
        max: max ?? (allowDecimal ? MAX_MONEY_VALUE : MAX_INT),
        step: step ?? (allowDecimal ? "any" : 1),
        inputMode: inputMode ?? (allowDecimal ? ("decimal" as const) : ("numeric" as const)),
      }
      : null;

  const getNumberPattern = () => {
    if (type !== "number") return null;
    return allowDecimal
      ? new RegExp(`^\\-?\\d*(\\.\\d{0,${decimalPlaces}})?$`)
      : /^\-?\d*$/;
  };

  const isRequiredField = Boolean(rules?.required) || isRequired;

  return (
    <div className={`space-y-1 ${className}`}>
      {label && !helper && (
        <FormLabel htmlFor={name} required={isRequiredField}>
          {label}
        </FormLabel>
      )}
      {label && helper && (
        <div className="inline-flex max-w-full flex-wrap items-baseline gap-1.5">
          <div className="min-w-0">
            <FormLabel htmlFor={name} required={isRequiredField}>
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
          const numberPattern = getNumberPattern();

          const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const rawValue = e?.target ? e.target.value : (typeof e === "string" ? e : "");

            if (type === "number") {
              const cleanValue = parseFormattedNumber(rawValue);

              if (cleanValue === "") {
                field.onChange("");
                return;
              }

              if (cleanValue === "-") {
                field.onChange(cleanValue);
                return;
              }

              if (numberPattern && numberPattern.test(cleanValue)) {
                const resolvedMax = numberControlDefaults?.max;
                if (typeof resolvedMax === "number") {
                  const numericValue = Number(cleanValue);
                  if (
                    Number.isFinite(numericValue) &&
                    numericValue > resolvedMax
                  ) {
                    return;
                  }
                }
                field.onChange(cleanValue);
                onValueUpdated?.(cleanValue);
              }
            } else {
              field.onChange(rawValue);
              const textValue =
                typeof rawValue === "string" ? rawValue : String(rawValue ?? "");
              onValueUpdated?.(textValue);
              if (maxLength != null && textValue.length > maxLength) {
                void trigger?.(name);
              }
            }
          };

          const displayValue =
            type === "number" &&
            field.value !== undefined &&
            field.value !== null &&
            field.value !== "" &&
            field.value !== "-"
              ? formatNumberWithCommas(field.value)
              : (field.value ?? "");

          const numberFieldAttrs =
            type === "number" && numberControlDefaults
              ? numberControlDefaults
              : {};

          const ariaDescribedBy = [
            fieldState.error ? `${name}-error` : null,
            helper ? `${name}-description` : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined;

          const lockedVisual = disabled || readOnly;

          const handleBlur = () => {
            field.onBlur();
            onFieldBlur?.();
          };

          const inputClassNames = cn(
            lockedVisual && "bg-muted cursor-default",
            inputClassName,
          );

          const inputElement = (
            <Input
              id={name}
              {...field}
              value={displayValue}
              autoFocus={autoFocus}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder={placeholder || `Enter ${label ?? name}`}
              disabled={disabled}
              readOnly={readOnly}
              className={inputClassNames}
              type={type === "number" ? "text" : type}
              maxLength={type === "number" ? undefined : maxLength}
              aria-invalid={!!fieldState.error}
              aria-describedby={ariaDescribedBy}
              {...numberFieldAttrs}
            />
          );
          const withAddon = prefix || suffix;

          return (
            <>
              {withAddon ? (
                <InputGroup className={lockedVisual ? "bg-muted" : undefined}>
                  {prefix && (
                    <InputGroupAddon align={prefixAlign}>
                      <InputGroupText>{prefix}</InputGroupText>
                    </InputGroupAddon>
                  )}
                  <InputGroupInput
                    id={name}
                    {...field}
                    value={displayValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={placeholder || `Enter ${label ?? name}`}
                    disabled={disabled}
                    readOnly={readOnly}
                    className={inputClassNames}
                    type={type === "number" ? "text" : type}
                    maxLength={type === "number" ? undefined : maxLength}
                    aria-invalid={!!fieldState.error}
                    aria-describedby={ariaDescribedBy}
                    {...numberFieldAttrs}
                  />
                  {suffix && (
                    <InputGroupAddon align={suffixAlign}>
                      <InputGroupText>{suffix}</InputGroupText>
                    </InputGroupAddon>
                  )}
                </InputGroup>
              ) : (
                inputElement
              )}
              <FormError error={fieldState.error} id={`${name}-error`} />
            </>
          );
        }}
      />
    </div>
  );
}
