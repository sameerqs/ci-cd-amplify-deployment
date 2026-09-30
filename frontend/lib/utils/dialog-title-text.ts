import type { ReactNode } from 'react'

import {
  DEFAULT_DIALOG_TITLE_MAX_LENGTH,
  truncateText,
  type TruncateTextResult,
} from './truncate-text'

export function resolveDialogTitleText(
  children: ReactNode,
  maxLength: number | false | undefined,
  defaultMaxLength = DEFAULT_DIALOG_TITLE_MAX_LENGTH,
): {
  children: ReactNode
  titleAttr?: string
} {
  if (typeof children !== 'string') {
    return { children }
  }

  const effectiveMax =
    maxLength === false ? false : (maxLength ?? defaultMaxLength)

  if (effectiveMax === false) {
    return { children }
  }

  const truncated: TruncateTextResult = truncateText(children, effectiveMax)
  return {
    children: truncated.display,
    titleAttr: truncated.wasTruncated ? truncated.full : undefined,
  }
}
