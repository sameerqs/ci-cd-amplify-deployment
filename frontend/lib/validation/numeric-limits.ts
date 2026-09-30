import z from "zod";

export const MAX_INT = 1_000_000_000;

export const MAX_FLOAT = 1_000_000_000;

export function clientItemIntRangeMessage(max: number): string {
  return `Must be between 1 and ${max.toLocaleString("en-US")}`;
}

export const TEMPERATURE_CELSIUS_MIN = -273.15;

export const TEMPERATURE_CELSIUS_MAX = 1000;

export const TEMPERATURE_FAHRENHEIT_MIN = -459.67;

export const TEMPERATURE_FAHRENHEIT_MAX = 1832;

export function temperatureCelsiusRangeMessage(): string {
  return `Must be between ${TEMPERATURE_CELSIUS_MIN} and ${TEMPERATURE_CELSIUS_MAX.toLocaleString("en-US")} °C`;
}

export function temperatureFahrenheitRangeMessage(): string {
  return `Must be between ${TEMPERATURE_FAHRENHEIT_MIN} and ${TEMPERATURE_FAHRENHEIT_MAX.toLocaleString("en-US")} °F`;
}

export function clientItemFloatRangeMessage(max: number): string {
  return `Must be between 0 and ${max.toLocaleString("en-US")}`;
}

function emptyToUndefinedSchema<T extends z.ZodTypeAny>(schema: T) {
  return z.union([
    z.literal("").transform(() => undefined),
    z.undefined(),
    z.null().transform(() => undefined),
    schema,
  ]);
}

export function optionalTemperatureCelsius() {
  const msg = temperatureCelsiusRangeMessage();
  return emptyToUndefinedSchema(z.coerce.number()).superRefine((val, ctx) => {
    if (val === undefined) return;
    if (!Number.isFinite(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
    if (val < TEMPERATURE_CELSIUS_MIN || val > TEMPERATURE_CELSIUS_MAX) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
    }
  });
}

export function optionalTemperatureFahrenheit() {
  const msg = temperatureFahrenheitRangeMessage();
  return emptyToUndefinedSchema(z.coerce.number()).superRefine((val, ctx) => {
    if (val === undefined) return;
    if (!Number.isFinite(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
    if (
      val < TEMPERATURE_FAHRENHEIT_MIN ||
      val > TEMPERATURE_FAHRENHEIT_MAX
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
    }
  });
}

export function optionalNonnegativeAmountMax(max: number = MAX_INT) {
  const msg = clientItemFloatRangeMessage(max);
  return z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.union([
      z.undefined(),
      z.coerce.number().superRefine((val, ctx) => {
        if (!Number.isFinite(val)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
          return;
        }
        if (val < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Must be 0 or greater",
          });
          return;
        }
        if (val > max) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
        }
      }),
    ]),
  );
}

export function optionalClientItemInt(max: number = MAX_INT) {
  const msg = clientItemIntRangeMessage(max);
  return emptyToUndefinedSchema(z.coerce.number()).superRefine((val, ctx) => {
    if (val === undefined) return;
    if (!Number.isFinite(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
    if (val > Number.MAX_SAFE_INTEGER) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
    if (val < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a positive number",
      });
      return;
    }
    if (val > max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
    if (!Number.isInteger(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
  });
}

export function optionalClientItemFloat(max: number = MAX_FLOAT) {
  const msg = clientItemFloatRangeMessage(max);
  return emptyToUndefinedSchema(z.coerce.number()).superRefine((val, ctx) => {
    if (val === undefined) return;
    if (!Number.isFinite(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
    if (val <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a positive number",
      });
      return;
    }
    if (val > max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
  });
}

const requiredFieldMessage = "This field is required";

export function requiredClientItemInt(max: number = MAX_INT) {
  const msg = clientItemIntRangeMessage(max);
  return emptyToUndefinedSchema(z.coerce.number()).superRefine((val, ctx) => {
    if (val === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: requiredFieldMessage });
      return;
    }
    if (!Number.isFinite(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
    if (val > Number.MAX_SAFE_INTEGER) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
    if (val < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a positive number",
      });
      return;
    }
    if (val > max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
    if (!Number.isInteger(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
  });
}

export function requiredClientItemFloat(max: number = MAX_FLOAT) {
  const msg = clientItemFloatRangeMessage(max);
  return emptyToUndefinedSchema(z.coerce.number()).superRefine((val, ctx) => {
    if (val === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: requiredFieldMessage });
      return;
    }
    if (!Number.isFinite(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
    if (val < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a positive number",
      });
      return;
    }
    if (val > max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
  });
}

export function requiredClientItemFloatWhenPresent(max: number = MAX_FLOAT) {
  const msg = clientItemFloatRangeMessage(max);
  return z.coerce.number().superRefine((val, ctx) => {
    if (!Number.isFinite(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
    if (val < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be 0 or greater",
      });
      return;
    }
    if (val > max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      return;
    }
  });
}
