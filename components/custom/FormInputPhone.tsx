"use client";
import * as React from "react";
import PhoneInput from "react-phone-input-2";
import { Controller, useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";
import FormError from "./FormError";
import FormLabel from "./FormLabel";

export type PhoneInputProps = {
  name: string;
  control?: import("react-hook-form").Control<import("react-hook-form").FieldValues>;
  label?: React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
  isRequired?: boolean;
  rules?: import("react-hook-form").RegisterOptions<import("react-hook-form").FieldValues>;
  defaultCountry?: string;
  preferredCountries?: string[];
  enableSearch?: boolean;
};

export default function FormInputPhone({
  name,
  control: externalControl,
  label,
  placeholder = "Enter phone number",
  defaultValue = "",
  disabled = false,
  isRequired = false,
  rules = {},
  defaultCountry = "us",
  preferredCountries,
  enableSearch = true,
}: PhoneInputProps) {
  const formContext = useFormContext();
  const control = externalControl || formContext?.control;

  if (!control) {
    throw new Error(
      "FormInputPhone requires either a control prop or must be used within a FormProvider",
    );
  }

  const allowedCountries = ["us"];

  return (
    <div className="space-y-1">
      {label && (
        <FormLabel htmlFor={name} required={Boolean(rules?.required) || isRequired}>
          {label}
        </FormLabel>
      )}

      <Controller
        name={name}
        control={control}
        rules={rules}
        defaultValue={defaultValue}
        render={({ field, fieldState }) => {
          const digitsFromField = String(field.value ?? "").replace(/\D/g, "");
          const displayValue = digitsFromField.length > 1 ? digitsFromField : "1";

          return (
            <>
              <PhoneInput
                country={defaultCountry}
                onlyCountries={allowedCountries}
                preferredCountries={allowedCountries}
                value={displayValue}
                onChange={(value) => {
                  const digits = String(value ?? "").replace(/\D/g, "");

                  if (!digits || digits === "1") {
                    field.onChange("");
                  } else {
                    field.onChange(`+${digits}`);
                  }
                }}
                onBlur={field.onBlur}
                disabled={disabled}
                enableSearch={enableSearch}
                placeholder={placeholder}
                specialLabel=""
                inputClass={cn(
                  "!w-full !h-8 !rounded-full !border-[0.6px] !border-input !text-[14px] !leading-[20px] !tracking-[-0.006em] !shadow-xs",
                  !disabled && "hover:!border-ring/50",
                  disabled && "!bg-muted",
                )}
                buttonClass={cn(
                  "!rounded-l-[8px] !border-[0.6px] !border-input !bg-white",
                  !disabled && "hover:!border-ring/50",
                  disabled && "!bg-muted",
                )}
                inputProps={{
                  id: name,
                  name,
                  ref: (el: HTMLInputElement | null) => {
                    if (el) field.ref(el);
                  },
                  required: rules?.required ?? isRequired,
                  autoComplete: "tel",
                  "aria-invalid": Boolean(fieldState.error) || undefined,
                }}
                containerClass="w-full"
                dropdownClass="!shadow-lg !border !border-input !rounded-md !bg-popover !text-foreground"
                searchClass="!text-sm !px-2 !py-1"
                searchPlaceholder="Search country"
                countryCodeEditable={false}
              />
              <FormError error={fieldState.error} />
            </>
          );
        }}
      />
    </div>
  );
}
