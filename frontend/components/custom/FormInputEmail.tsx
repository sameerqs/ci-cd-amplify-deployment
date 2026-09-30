"use client";

import * as React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import FormError from "./FormError";
import FormLabel from "./FormLabel";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  control?: import("react-hook-form").Control<import("react-hook-form").FieldValues>;
  label?: React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
  isRequired?: boolean;
  /** Renders in the label row (e.g. “Change email”) — keep actions compact so the row stays one line tall. */
  extra?: React.ReactNode;
  className?: string;
};

export default function FormInputEmail({
  name,
  control: externalControl,
  label,
  placeholder = "email@site.domain",
  defaultValue = "",
  disabled = false,
  isRequired = true,
  extra,
  className,
}: Props) {
  const formContext = useFormContext();
  const control = externalControl || formContext?.control;

  if (!control) {
    throw new Error(
      "FormInputEmail requires either a control prop or must be used within a FormProvider",
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {label && extra ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
          <FormLabel htmlFor={name} required={isRequired} className="min-w-0 truncate">
            {label}
          </FormLabel>
          <div
            className={cn(
              "flex shrink-0 items-center justify-end",
              // Keep actions on one line with the label (matches FormLabel leading-5 / ~20px)
              "[&_button]:h-5! [&_button]:min-h-5! [&_button]:py-0! [&_button]:text-[13px]! [&_button]:leading-5!",
            )}
          >
            {extra}
          </div>
        </div>
      ) : label ? (
        <FormLabel htmlFor={name} required={isRequired}>
          {label}
        </FormLabel>
      ) : extra ? (
        <div className="flex justify-end">{extra}</div>
      ) : null}

      <Controller
        name={name}
        control={control}
        defaultValue={defaultValue}
        render={({ field, fieldState }) => {
          const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e?.target ? e.target.value : e;
            field.onChange(value);
          };

          const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
            const trimmed = e?.target?.value?.trim();
            field.onChange(trimmed);
            field.onBlur();
          };

          return (
            <>
              <Input
                id={name}
                {...field}
                value={field.value ?? ""}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={placeholder}
                disabled={disabled}
                className={disabled ? "disabled:bg-muted" : undefined}
                type="email"
                autoComplete="email"
                inputMode="email"
                aria-required={isRequired}
                aria-invalid={!!fieldState.error}
                aria-describedby={
                  fieldState.error ? `${name}-error` : undefined
                }
              />
              <FormError error={fieldState.error} />
            </>
          );
        }}
      />
    </div>
  );
}
