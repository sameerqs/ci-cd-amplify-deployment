
export function formatNumberWithCommas(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  if (typeof value === 'string') {
    const parts = value.split('.')
    const integerPart = parts[0].replace(/,/g, '')
    const decimalPart = parts[1]
    if (!integerPart && decimalPart === undefined) {
      return ''
    }
    const formattedInteger = integerPart
      ? Math.abs(Number(integerPart)).toLocaleString('en-US')
      : '0'
    const sign = integerPart && Number(integerPart) < 0 ? '-' : ''
    return decimalPart !== undefined
      ? `${sign}${formattedInteger}.${decimalPart}`
      : `${sign}${formattedInteger}`
  }
  const num = value as number
  if (!Number.isFinite(num)) {
    return String(value)
  }
  const str = num.toString()
  const [intPart, decPart] = str.split('.')
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted
}

export function parseFormattedNumber(value: string): string {
  return value.replace(/,/g, '')
}
