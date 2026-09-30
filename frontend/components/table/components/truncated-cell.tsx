'use client'

import { TruncatedTextWithTooltip } from '@/components/custom/truncated-text-with-tooltip'
import { cn } from '@/lib/utils'

interface TruncatedCellProps {
  value?: string | null
  className?: string
}

export function TruncatedCell({ value, className }: TruncatedCellProps) {
  return (
    <TruncatedTextWithTooltip
      text={value?.trim() ?? ''}
      fallback="—"
      className={cn('max-w-[16rem]', className)}
    />
  )
}
