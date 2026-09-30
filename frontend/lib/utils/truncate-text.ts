export const DEFAULT_DIALOG_TITLE_MAX_LENGTH = 55

export const DEFAULT_DIALOG_DESCRIPTION_MAX_LENGTH = 200

export interface TruncateTextResult {
  display: string
  full: string
  wasTruncated: boolean
}

export function truncateText(
  text: string,
  maxLength = DEFAULT_DIALOG_TITLE_MAX_LENGTH,
): TruncateTextResult {
  if (text.length <= maxLength) {
    return { display: text, full: text, wasTruncated: false }
  }
  return {
    display: `${text.slice(0, maxLength)}…`,
    full: text,
    wasTruncated: true,
  }
}
