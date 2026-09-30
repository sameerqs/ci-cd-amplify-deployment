"use client";

import * as React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import FormError from "./FormError";

type Props = {
  name: string;
  control?: import("react-hook-form").Control<import("react-hook-form").FieldValues>;
  label?: React.ReactNode;
  defaultValue?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  rules?: import("react-hook-form").RegisterOptions<import("react-hook-form").FieldValues>;
};

export default function FormSwitch({
  name,
  control: externalControl,
  label,
  defaultValue = false,
  disabled = false,
  rules = {},
  onCheckedChange,
}: Props) {
  const formContext = useFormContext();
  const control = externalControl || formContext?.control;

  if (!control) {
    throw new Error(
      "FormSwitch requires either a control prop or must be used within a FormProvider",
    );
  }

  return (
    <div className="space-y-2">
      <Controller
        name={name}
        control={control}
        rules={rules}
        defaultValue={defaultValue}
        render={({ field, fieldState }) => (
          <div className="flex items-center space-x-2">
            <Switch
              ref={field.ref}
              id={name}
              name={name}
              checked={field.value ?? false}
              onCheckedChange={(checked) => {
                if (onCheckedChange) {
                  onCheckedChange(checked);
                }
                field.onChange(checked)

              }}
              disabled={disabled}
            />
            {label && <Label htmlFor={name}>{label}</Label>}
            <FormError error={fieldState.error} />
          </div>
        )}
      />
    </div>
  );
}
