"use client";
import * as React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import FormError from "./FormError";
import { FormFieldInfoTooltip } from "./form-field-info-tooltip";

type Props = {
  name: string;
  control?: import("react-hook-form").Control<import("react-hook-form").FieldValues>;
  label?: React.ReactNode;
  rules?: import("react-hook-form").RegisterOptions<import("react-hook-form").FieldValues>;
  defaultValue?: boolean;
  disabled?: boolean;
  isRequired?: boolean;
  /** Long-form hint: info icon + tooltip beside the label; full text in sr-only for a11y. */
  helper?: string;
};

export default function FormCheckbox({
  name,
  control: externalControl,
  label,
  rules = {},
  defaultValue = false,
  disabled = false,
  isRequired = false,
  helper,
}: Props) {
  const formContext = useFormContext();
  const control = externalControl || formContext?.control;

  if (!control) {
    throw new Error(
      "FormCheckbox requires either a control prop or must be used within a FormProvider",
    );
  }

  return (
    <div className="space-y-1">
      {helper ? (
        <span id={`${name}-description`} className="sr-only">
          {helper}
        </span>
      ) : null}
      <Controller
        name={name}
        control={control}
        rules={rules}
        defaultValue={defaultValue}
        render={({ field, fieldState }) => (
          <>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Checkbox
                ref={field.ref}
                id={name}
                name={name}
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
                aria-invalid={!!fieldState.error}
                aria-describedby={
                  [
                    fieldState.error ? `${name}-error` : null,
                    helper ? `${name}-description` : null,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
              />
              {label && (
                <Label htmlFor={name} className="cursor-pointer">
                  {label}
                </Label>
              )}
              {helper && (
                <FormFieldInfoTooltip
                  helper={helper}
                  label={label}
                  contentMaxWidth="wide"
                />
              )}
            </div>
            <FormError error={fieldState.error} id={`${name}-error`} />
          </>
        )}
      />
    </div>
  );
}
