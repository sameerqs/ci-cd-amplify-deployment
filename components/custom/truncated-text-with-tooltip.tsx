'use client'

import type { ReactElement } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'

import { HoverTooltip } from '@/components/custom/hover-tooltip'
import { cn } from '@/lib/utils'

/** Matches TR-64 guidance for language pair labels in combobox lists. */
export const TRUNCATED_LABEL_TOOLTIP_MIN_LENGTH = 40

export function useIsTextTruncated(
  getElement: () => HTMLElement | null,
  deps: unknown[] = [],
): boolean {
  const [isTruncated, setIsTruncated] = useState(false)

  useLayoutEffect(() => {
    const initial = getElement()
    if (!initial) {
      setIsTruncated(false)
      return
    }

    let observed: HTMLElement = initial
    let rafId = 0

    const observer = new ResizeObserver(() => check())

    const subscribe = (node: HTMLElement) => {
      observer.disconnect()
      observer.observe(node)
      if (node.parentElement) {
        observer.observe(node.parentElement)
      }
      observed = node
    }

    const check = () => {
      // Re-resolve on every check: wrapping the text in the tooltip trigger
      // remounts it, and a detached node reads scrollWidth/clientWidth as 0.
      const node = getElement()
      if (!node || !node.isConnected) {
        return
      }
      if (node !== observed) {
        subscribe(node)
      }
      setIsTruncated(node.scrollWidth > node.clientWidth)
    }

    subscribe(initial)
    check()
    rafId = requestAnimationFrame(check)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, deps)

  return isTruncated
}

interface TruncatedTextWithTooltipProps {
  text: string
  className?: string
  fallback?: string
  /** When set, also show tooltip if text exceeds this length (combobox list fallback). */
  tooltipMinLength?: number
  side?: React.ComponentProps<typeof HoverTooltip>['side']
}

export function TruncatedTextWithTooltip({
  text,
  className,
  fallback = '—',
  tooltipMinLength,
  side = 'top',
}: TruncatedTextWithTooltipProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isTruncated = useIsTextTruncated(() => ref.current, [text])
  const tooltipContent = text.trim() ? text : null
  const display = tooltipContent ?? fallback

  const shouldShowTooltip =
    Boolean(tooltipContent) &&
    (isTruncated ||
      (tooltipMinLength != null &&
        tooltipContent != null &&
        tooltipContent.length > tooltipMinLength))

  const span = (
    <span
      ref={ref}
      className={cn('block min-w-0 w-full max-w-full truncate', className)}
    >
      {display}
    </span>
  )

  if (!shouldShowTooltip) {
    return span
  }

  return (
    <HoverTooltip content={tooltipContent} side={side}>
      {span}
    </HoverTooltip>
  )
}

interface TruncatedControlTooltipProps {
  content: string | null | undefined
  enabled?: boolean
  children: ReactElement
}

export function TruncatedControlTooltip({
  content,
  enabled = true,
  children,
}: TruncatedControlTooltipProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipContent = content?.trim() ? content : null
  const isTruncated = useIsTextTruncated(
    () =>
      containerRef.current?.querySelector<HTMLElement>(
        '[data-slot=input-group-control]',
      ) ?? null,
    [enabled, tooltipContent],
  )

  const shouldShowTooltip =
    enabled &&
    Boolean(tooltipContent) &&
    (isTruncated ||
      (tooltipContent != null &&
        tooltipContent.length > TRUNCATED_LABEL_TOOLTIP_MIN_LENGTH))

  if (!shouldShowTooltip) {
    return (
      <div ref={containerRef} className="min-w-0 w-full">
        {children}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-w-0 w-full">
      <HoverTooltip content={tooltipContent}>{children}</HoverTooltip>
    </div>
  )
}
