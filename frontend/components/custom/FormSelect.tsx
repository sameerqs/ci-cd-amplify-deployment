"use client";

import * as React from "react";
import { Controller, useFormContext } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import FormError from "./FormError";
import { FormFieldInfoTooltip } from "./form-field-info-tooltip";
import FormLabel from "./FormLabel";

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  name: string;
  control?: import("react-hook-form").Control<import("react-hook-form").FieldValues>;
  label?: React.ReactNode;
  placeholder?: string;
  options: Option[];
  deletedOptions?: Option | Option[];
  defaultValue?: string;
  disabled?: boolean;
  isRequired?: boolean;
  rules?: import("react-hook-form").RegisterOptions<import("react-hook-form").FieldValues>;
  emptyMessage?: string;
  className?: string;
  autoFocus?: boolean;
  /** Long-form hint shown in an info tooltip next to the label (matches `FormInput` helper). */
  helper?: string;
  /** Called after the field value is updated (receives the option `value` string). */
  onValueChange?: (value: string) => void;
};

/** Use in `options` when a field needs an explicit empty/clear row (e.g. filter "Any"). */
export const FORM_SELECT_EMPTY_VALUE = '__none__';

const CLEAR_SENTINEL = FORM_SELECT_EMPTY_VALUE;

export default function FormSelect({
  name,
  control: externalControl,
  label,
  placeholder = "Select an option",
  options,
  deletedOptions,
  defaultValue = "",
  disabled = false,
  isRequired = false,
  rules = {},
  emptyMessage = "No results found.",
  className,
  autoFocus = false,
  helper,
  onValueChange,
}: Props) {
  const formContext = useFormContext();
  const control = externalControl || formContext?.control;

  if (!control) {
    throw new Error(
      "FormSelect requires either a control prop or must be used within a FormProvider",
    );
  }

  const safeDeletedOptions = React.useMemo(() => {
    if (!deletedOptions) return [] as Option[];
    return Array.isArray(deletedOptions) ? deletedOptions : [deletedOptions];
  }, [deletedOptions]);

  const isRequiredField = Boolean(rules?.required) || isRequired;

  return (
    <div className={cn('space-y-1 w-full', className)}>
      {label && !helper && (
        <FormLabel htmlFor={name} required={isRequiredField}>
          {label}
        </FormLabel>
      )}
      {label && helper && (
        <div
          data-form-label-row
          className="flex min-h-5 items-center gap-1.5"
        >
          <FormLabel htmlFor={name} required={isRequiredField} className="min-w-0">
            {label}
          </FormLabel>
          <FormFieldInfoTooltip helper={helper} label={label} contentMaxWidth="wide" />
          <span id={`${name}-description`} className="sr-only">
            {helper}
          </span>
        </div>
      )}
      {!label && helper && (
        <>
          <FormFieldInfoTooltip helper={helper} contentMaxWidth="wide" />
          <span id={`${name}-description`} className="sr-only">
            {helper}
          </span>
        </>
      )}

      <Controller
        name={name}
        control={control}
        rules={rules}
        defaultValue={defaultValue}
        render={({ field, fieldState }) => {
          const selectedValue =
            field.value === null ||
            field.value === undefined ||
            field.value === ''
              ? ''
              : String(field.value);

          const missingDeleted = safeDeletedOptions.filter(
            (d) =>
              selectedValue &&
              d.value === selectedValue &&
              !options.some((o) => o.value === d.value),
          );

          const missingOptions: Option[] = missingDeleted.map((opt) => ({
            value: opt.value,
            label: opt.label || "(Deleted Option)",
            disabled: true,
          }));

          const mergedOptions = [...options, ...missingOptions];

          const handleValueChange = (val: string) => {
            const next = val === CLEAR_SENTINEL ? "" : val;
            field.onChange(next);
            onValueChange?.(next);
          };

          const selectValue = selectedValue === '' ? undefined : selectedValue;

          return (
            <>
              <Select
                value={selectValue}
                onValueChange={handleValueChange}
                disabled={disabled}
              >
                <SelectTrigger
                  id={name}
                  ref={field.ref}
                  size="sm"
                  className="w-full"
                  aria-invalid={!!fieldState.error}
                  aria-describedby={
                    [
                      helper ? `${name}-description` : null,
                      fieldState.error ? `${name}-error` : null,
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  autoFocus={autoFocus}
                >
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="min-w-[var(--radix-select-trigger-width)]"
                >
                  {mergedOptions.length === 0 ? (
                    <div className="py-2 px-2 text-center text-sm text-muted-foreground">
                      {emptyMessage}
                    </div>
                  ) : (
                    mergedOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                      >
                        {option.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormError error={fieldState.error} id={`${name}-error`} />
            </>
          );
        }}
      />
    </div>
  );
}
