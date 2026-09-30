'use client'

import * as React from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type TooltipSide = React.ComponentProps<typeof TooltipContent>['side']

function hasTooltipContent(content: string | null | undefined): content is string {
  return typeof content === 'string' && content.trim().length > 0
}

type HoverTooltipProps = {
  content: string | null | undefined
  children: React.ReactElement
  side?: TooltipSide
  sideOffset?: number
  contentClassName?: string
}

export function HoverTooltip({
  content,
  children,
  side = 'top',
  sideOffset = 4,
  contentClassName,
}: HoverTooltipProps) {
  if (!hasTooltipContent(content)) {
    return children
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={sideOffset}
        className={cn(
          'max-w-sm whitespace-normal break-words text-left',
          contentClassName,
        )}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

type DisabledHoverTooltipProps = {
  content: string | null | undefined
  children: React.ReactElement
  side?: TooltipSide
  sideOffset?: number
  contentClassName?: string
}

export function DisabledHoverTooltip({
  content,
  children,
  side = 'top',
  sideOffset = 4,
  contentClassName,
}: DisabledHoverTooltipProps) {
  if (!hasTooltipContent(content)) {
    return children
  }

  const child = React.Children.only(children)
  const trigger = React.isValidElement<{ className?: string }>(child)
    ? React.cloneElement(child, {
        className: cn(
          child.props.className,
          'disabled:pointer-events-auto disabled:cursor-not-allowed',
        ),
      })
    : child

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex min-w-0">{trigger}</span>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={sideOffset}
        className={cn(
          'max-w-sm whitespace-normal break-words text-left',
          contentClassName,
        )}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
