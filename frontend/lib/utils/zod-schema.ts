import { z } from "zod";
import { emailRegex } from "@/app/(auth)/regex-utils";
import { Gender } from "@/lib/enum";

import { isValidPhoneNumber } from "./regex-utils";

// Catches the four blank sentinels including Next.js's "$undefined"
// wire-format marker (which leaks through some Server-Action flows).
export function isBlankFormValue(val: unknown): boolean {
  return (
    val === '' ||
    val === null ||
    val === undefined ||
    val === '$undefined'
  );
}

// Coerce blank sentinels to "" so .min(1) fires "required" instead of "expected string".
export function nullToEmpty<T extends z.ZodTypeAny>(schema: T): T {
  return z.preprocess(
    (val) => (isBlankFormValue(val) ? '' : val),
    schema,
  ) as unknown as T;
}

// Coerce blank sentinels to undefined so .optional() accepts them.
export function nullToUndefined<T extends z.ZodTypeAny>(schema: T): T {
  return z.preprocess(
    (val) => (isBlankFormValue(val) ? undefined : val),
    schema,
  ) as unknown as T;
}

// Source of truth — CLAUDE.md Architectural decision. Backend DTOs mirror
// via @IsNumber({ maxDecimalPlaces }).
export const MAX_DECIMAL_PLACES = 2;

// Unit-level cap (catalog rates, QTY, charged rate, per-line fees). Backend
// mirrors via numeric.constants.ts.
export const MAX_MONEY_VALUE = 9_999_999.99;

export const MAX_QTY_VALUE = 9_999_999;

export const MAX_LINE_TOTAL = MAX_QTY_VALUE * MAX_QTY_VALUE;

export const MAX_DOCUMENT_TOTAL = Number.MAX_SAFE_INTEGER;

export function exceedsMaxDecimalPlaces(val: number): boolean {
  if (!Number.isFinite(val)) return false;
  const [, frac = ''] = String(val).split('.');
  return frac.length > MAX_DECIMAL_PLACES;
}

// Output: number | undefined. Used everywhere — module schemas import
// this rather than re-deriving the blank-sentinel handling.
export const optionalNonNegativeNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((val) => {
    if (isBlankFormValue(val)) return undefined;
    const n = typeof val === 'number' ? val : Number(val);
    return Number.isFinite(n) ? n : NaN;
  })
  .refine((val) => val === undefined || (val >= 0 && Number.isFinite(val)), {
    message: 'Must be 0 or greater.',
  })
  .refine((val) => val === undefined || val <= MAX_MONEY_VALUE, {
    message: `Must be ${MAX_MONEY_VALUE.toLocaleString()} or less.`,
  })
  .refine((val) => val === undefined || !exceedsMaxDecimalPlaces(val), {
    message: `Use at most ${MAX_DECIMAL_PLACES} decimal places.`,
  })
  // Object keys omitted by RHF / Server Actions must be optional, not
  // "required undefined" — Zod 4 surfaces an error otherwise.
  .optional();

export const requiredNonNegativeNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .refine((val) => !isBlankFormValue(val), { message: 'Rate is required.' })
  .transform((val) => (typeof val === 'number' ? val : Number(val)))
  .refine((val) => Number.isFinite(val) && val >= 0, {
    message: 'Must be 0 or greater.',
  })
  .refine((val) => val <= MAX_MONEY_VALUE, {
    message: `Must be ${MAX_MONEY_VALUE.toLocaleString()} or less.`,
  })
  .refine((val) => !exceedsMaxDecimalPlaces(val), {
    message: `Use at most ${MAX_DECIMAL_PLACES} decimal places.`,
  });

function buildOptionalNonNegativeNumber(max: number) {
  return z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((val) => {
      if (isBlankFormValue(val)) return undefined;
      const n = typeof val === 'number' ? val : Number(val);
      return Number.isFinite(n) ? n : NaN;
    })
    .refine((val) => val === undefined || (val >= 0 && Number.isFinite(val)), {
      message: 'Must be 0 or greater.',
    })
    .refine((val) => val === undefined || val <= max, {
      message: `Must be ${max.toLocaleString()} or less.`,
    })
    .refine((val) => val === undefined || !exceedsMaxDecimalPlaces(val), {
      message: `Use at most ${MAX_DECIMAL_PLACES} decimal places.`,
    })
    .optional();
}

export const optionalLineTotalNumber = buildOptionalNonNegativeNumber(
  MAX_LINE_TOTAL,
);

export const optionalDocumentTotalNumber = buildOptionalNonNegativeNumber(
  MAX_DOCUMENT_TOTAL,
);

export const optionalTrimmedString = (max: number, label: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (isBlankFormValue(val)) return undefined;
      const trimmed = (val as string).trim();
      return trimmed === '' ? undefined : trimmed;
    })
    .refine((val) => val === undefined || val.length <= max, {
      message: `${label} must be ${max} characters or fewer.`,
    })
    .optional();

export const requiredTrimmedString = (max: number, label: string) =>
  nullToEmpty(
    z
      .string()
      .trim()
      .min(1, `${label} is required.`)
      .max(max, `${label} must be ${max} characters or fewer.`),
  );

export const phoneSchema = nullToEmpty(
  z
    .string()
    .min(1, "Phone number is required")
    .refine(isValidPhoneNumber, {
      message: "Please enter a valid US phone number (e.g., (555) 555-1212 or +1 555 555 1212)",
    })
);

export const optionalPhoneSchema = z
  .union([z.string(), z.literal(''), z.undefined()])
  .transform((val) => {
    if (isBlankFormValue(val)) return undefined;
    const trimmed = String(val).trim();
    if (trimmed === '' || trimmed === '+1') return undefined;
    return trimmed;
  })
  .refine(
    (val) => val === undefined || isValidPhoneNumber(val),
    {
      message:
        'Please enter a valid US phone number (e.g., (555) 555-1212 or +1 555 555 1212)',
    },
  )
  .optional();

export const phoneExtSchema = nullToUndefined(
  z
    .string()
    .trim()
    .max(15, "Extension must be 15 digits or fewer")
    .regex(/^\d*$/, "Extension must be digits only")
    .optional(),
);

export const zipCodeSchema = nullToEmpty(
  z
    .string()
    .trim()
    .min(1, "Zip code is required")
    .max(10, "Zip code must be 10 characters or fewer")
    .regex(/^\d{5}(-\d{4})?$/, {
      message: "Please enter a valid US zip code (e.g., 12345 or 12345-6789)",
    })
);

export const optionalZipCodeSchema = nullToUndefined(
  z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || val.length <= 10, {
      message: "Zip code must be 10 characters or fewer",
    })
    .refine((val) => !val || /^\d{5}(-\d{4})?$/.test(val), {
      message: "Please enter a valid US zip code (e.g., 12345 or 12345-6789)",
    })
);

export const zodEmailSchema = nullToEmpty(
  z.string()
    .min(1, "Email is required")
    .email("Enter a valid email address (e.g., example@domain.com)")
    .max(100, "Email must be at most 100 characters")
    .regex(emailRegex, 'Enter a valid email address (e.g., example@domain.com)')
);

export const optionalZodEmailSchema = nullToUndefined(
  z.string().email("Enter a valid email address (e.g., example@domain.com)").optional()
);

export const optionalGenderFromFormSchema = z
  .union([z.string(), z.number(), z.literal(''), z.null(), z.undefined()])
  .transform((v) => {
    if (isBlankFormValue(v) || v === '') return undefined;
    const n = typeof v === 'number' ? v : Number(v);
    if (
      n === Gender.Male ||
      n === Gender.Female ||
      n === Gender.NoPreference
    ) {
      return n as Gender;
    }
    return undefined;
  })
  .optional();

export const requiredGenderFromFormSchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return Number.NaN;
    return typeof v === 'number' ? v : Number(v);
  })
  .refine(
    (val) =>
      val === Gender.Male ||
      val === Gender.Female ||
      val === Gender.NoPreference,
    { message: 'Select a gender.' },
  );