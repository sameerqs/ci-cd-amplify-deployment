'use client'

import * as React from 'react'
import { useController } from 'react-hook-form'

type FormFieldProps = {
  name: string
  control: import("react-hook-form").Control<import("react-hook-form").FieldValues>
  rules?: import("react-hook-form").RegisterOptions<import("react-hook-form").FieldValues>
  defaultValue?: unknown
  children: (props: {
    field: ReturnType<typeof useController>['field']
    fieldState: ReturnType<typeof useController>['fieldState']
  }) => React.ReactNode
}

export default function FormField({ name, control, rules, defaultValue, children }: FormFieldProps) {
  const controller = useController({ name, control, rules, defaultValue })

  return <>{children({ field: controller.field, fieldState: controller.fieldState })}</>
}
