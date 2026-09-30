'use client'

import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ValidationRule = {
  label: string
  regex: RegExp
}

const PASSWORD_RULES: ValidationRule[] = [
  {
    label: 'At least 8 characters',
    regex: /.{8,}/,
  },
  {
    label: 'Contains uppercase letter',
    regex: /[A-Z]/,
  },
  {
    label: 'Contains lowercase letter',
    regex: /[a-z]/,
  },
  {
    label: 'Contains number',
    regex: /\d/,
  },
  {
    label: 'Contains special character (@$!%*?&)',
    regex: /[@$!%*?&]/,
  },
]

type Props = {
  password: string
  showOnlyOnFocus?: boolean
  hasFocus?: boolean
}

export default function PasswordStrengthIndicator({
  password,
  showOnlyOnFocus = true,
  hasFocus = false,
}: Props) {
  const validationResults = PASSWORD_RULES.map((rule) => ({
    ...rule,
    isValid: rule.regex.test(password),
  }))

  const shouldShow = password.length > 0 || (showOnlyOnFocus && hasFocus)

  if (!shouldShow) {
    return null
  }

  const allValid = validationResults.every((rule) => rule.isValid)

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Password requirements:</div>
      <div className="space-y-1.5">
        {validationResults.map((rule, index) => (
          <div
            key={index}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors',
              rule.isValid ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground'
            )}
          >
            {rule.isValid ? (
              <Check className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            <span>{rule.label}</span>
          </div>
        ))}
      </div>
      {allValid && (
        <div className="text-xs text-green-600 dark:text-green-500 font-medium pt-1">
          ✓ Password is strong!
        </div>
      )}
    </div>
  )
}
