'use client'

import * as React from 'react'
import { Label } from '@/components/ui/label'

type Props = React.ComponentProps<typeof Label> & {
  required?: boolean
}

export default function FormRadioLabel({ required, children, ...props }: Props) {
  return (
    <label
      className="gap-0! leading-snug mb-2"
      {...props}
   
    >
      <span className="min-w-0 break-words font-bold! text-[14px] text-foreground leading-snug mb-2 capitalize">{children}</span>
      {required && <span className="text-destructive ml-1 shrink-0">*</span>}
    </label>
  );
}
