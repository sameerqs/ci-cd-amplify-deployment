"use client";

import * as React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import FormError from "./FormError";
import FormLabel from "./FormLabel";
import PasswordStrengthIndicator from "./PasswordStrengthIndicator";

type Props = {
  name: string;
  control?: import("react-hook-form").Control<import("react-hook-form").FieldValues>;
  label?: React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  isLoginComponent?: boolean;
  extraComponent?: React.ReactNode;
};

export default function FormInputPassword({
  name,
  control: externalControl,
  label,
  placeholder = "",
  defaultValue = "",
  disabled = false,
  required = true,
  isLoginComponent = false,
  extraComponent,
}: Props) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);

  const formContext = useFormContext();
  const control = externalControl || formContext?.control;

  if (!control) {
    throw new Error(
      "FormInputPassword requires either a control prop or must be used within a FormProvider",
    );
  }

  return (
    <div className="space-y-1">
      {label && (
        <FormLabel htmlFor={name} required={required}>
          {label}{" "}
        </FormLabel>
      )}

      <Controller
        name={name}
        control={control}
        defaultValue={defaultValue}
        render={({ field, fieldState }) => {
          const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e?.target ? e.target.value : e;
            field.onChange(value);
          };

          const handleFocus = () => {
            setIsFocused(true);
            field.onBlur();
          };

          const handleBlur = () => {
            setIsFocused(false);
            field.onBlur();
          };

          return (
            <>
              <div className="relative">
                <Input
                  id={name}
                  {...field}
                  value={field.value ?? ""}
                  onChange={handleChange}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder={placeholder || `Enter ${label ?? name}`}
                  disabled={disabled}
                  type={showPassword ? "text" : "password"}
                  autoComplete="off"
                  className={cn(
                    "no-native-password-reveal",
                    disabled ? "pr-10 disabled:bg-muted" : "pr-10",
                  )}
                  aria-invalid={!!fieldState.error}
                  aria-describedby={
                    fieldState.error ? `${name}-error` : undefined
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <Eye className="h-4 w-4 cursor-pointer" aria-label="Show password" />
                  ) : (
                    <EyeOff className="h-4 w-4 cursor-pointer" aria-label="Hide password" />
                  )}
                </button>
              </div>
              {name === "password" && !isLoginComponent ? (
                <PasswordStrengthIndicator
                  password={field.value ?? ""}
                  hasFocus={isFocused}
                  showOnlyOnFocus={true}
                />
              ) : (
                <FormError error={fieldState.error} />
              )}
            </>
          );
        }}
      />
    </div>
  );
}
