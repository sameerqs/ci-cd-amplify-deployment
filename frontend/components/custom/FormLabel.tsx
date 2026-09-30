'use client'

import * as React from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Props = React.ComponentProps<typeof Label> & {
  required?: boolean
}

export default function FormLabel({ required, children, className, ...props }: Props) {
  return (
    <Label
      className={cn(
        'gap-0! font-medium text-[13px] text-foreground leading-5 capitalize',
        className,
      )}
      {...props}
    >
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </Label>
  )
}
