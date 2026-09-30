import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { appSettings } from "@/lib/app-settings";

dayjs.extend(utc);

export function formatUtc(
  value: Date | string | number | null | undefined,
  template: string,
): string {
  if (value === null || value === undefined || value === "") return "";
  const d = dayjs.utc(value);
  return d.isValid() ? d.format(template) : "";
}

export function formatLocal(
  value: Date | string | number | null | undefined,
  template: string,
): string {
  if (value === null || value === undefined || value === "") return "";
  const d = dayjs(value);
  return d.isValid() ? d.format(template) : "";
}

function monthToken(month: Intl.DateTimeFormatOptions["month"]): string {
  switch (month) {
    case "short":
      return "MMM";
    case "2-digit":
      return "MM";
    case "numeric":
      return "M";
    case "long":
    default:
      return "MMMM";
  }
}

function templateFromOpts(
  opts: Intl.DateTimeFormatOptions,
  kind: "date" | "time" | "datetime",
): string {
  const parts: string[] = [];
  if (kind !== "time") {
    const datePieces: string[] = [];
    if (opts.weekday) {
      datePieces.push(opts.weekday === "long" ? "dddd" : "ddd");
    }
    const day = opts.day === "2-digit" ? "DD" : "D";
    const year = opts.year === "2-digit" ? "YY" : "YYYY";
    datePieces.push(`${monthToken(opts.month)} ${day}, ${year}`);
    parts.push(datePieces.join(", "));
  }
  if (kind !== "date") {
    const hour = opts.hour === "2-digit" ? "hh" : "h";
    parts.push(`${hour}:mm A`);
  }
  return parts.join(" ");
}

export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  if (!date) return "";
  return formatLocal(
    date,
    templateFromOpts(
      { month: "long", day: "numeric", year: "numeric", ...opts },
      "date",
    ),
  );
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (!Number.isFinite(value)) return "—";
  return usdFormatter.format(value);
}

export function formatUsd(value: number | null | undefined): string {
  return formatCurrency(value);
}

export function formatTime(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  if (!date) return "";
  return formatLocal(
    date,
    templateFromOpts({ hour: "numeric", minute: "2-digit", ...opts }, "time"),
  );
}

export function formatDateTime(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  if (!date) return "";
  return formatLocal(
    date,
    templateFromOpts(
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        ...opts,
      },
      "datetime",
    ),
  );
}

function appZoneAbbrev(d: Date, timeZone: string): string {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

/**
 * Instant → the app's business timezone (NEXT_PUBLIC_APP_TIMEZONE) with a
 * DST-aware zone label, e.g. "Jun 16, 2026, 9:00 AM (PDT)". Portal display is
 * recipient-local; this is only for values persisted as display strings that
 * must match the server's app-datetime.util rendering byte-for-byte.
 */
export function formatAppDateTime(
  date: Date | string | number | null | undefined,
): string {
  if (date === null || date === undefined || date === "") return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const timeZone = appSettings.APP_TIMEZONE;
  const base = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(d);
  return `${base} (${appZoneAbbrev(d, timeZone)})`;
}

export function formatUtcDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  if (!date) return "";
  return formatUtc(
    date,
    templateFromOpts(
      { month: "long", day: "numeric", year: "numeric", ...opts },
      "date",
    ),
  );
}

export function formatUtcTime(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  if (!date) return "";
  return formatUtc(
    date,
    templateFromOpts({ hour: "numeric", minute: "2-digit", ...opts }, "time"),
  );
}

export function formatUtcDateTime(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  if (!date) return "";
  return formatUtc(
    date,
    templateFromOpts(
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        ...opts,
      },
      "datetime",
    ),
  );
}

const RELATIVE_UNITS: Array<{
  unit: Intl.RelativeTimeFormatUnit;
  seconds: number;
}> = [
  { unit: "year", seconds: 365 * 24 * 60 * 60 },
  { unit: "month", seconds: 30 * 24 * 60 * 60 },
  { unit: "week", seconds: 7 * 24 * 60 * 60 },
  { unit: "day", seconds: 24 * 60 * 60 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

export function formatRelativeTime(
  date: Date | string | number | undefined,
  now: Date = new Date(),
): string {
  if (!date) return "";
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return "";
  const diffSeconds = Math.round((target.getTime() - now.getTime()) / 1000);
  const absDiff = Math.abs(diffSeconds);
  if (absDiff < 5) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  for (const { unit, seconds } of RELATIVE_UNITS) {
    if (absDiff >= seconds) {
      const value = Math.round(diffSeconds / seconds);
      return rtf.format(value, unit);
    }
  }
  return "just now";
}

const SHORT_RELATIVE_UNITS: Array<{ label: string; seconds: number }> = [
  { label: "day", seconds: 24 * 60 * 60 },
  { label: "hr", seconds: 60 * 60 },
  { label: "min", seconds: 60 },
  { label: "sec", seconds: 1 },
];

export function formatShortRelativeTime(
  date: Date | string | number | undefined,
  now: Date = new Date(),
): string {
  if (!date) return "";
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return "";
  const diffSeconds = Math.floor((now.getTime() - target.getTime()) / 1000);
  if (diffSeconds < 5) return "just now";
  for (const { label, seconds } of SHORT_RELATIVE_UNITS) {
    if (diffSeconds >= seconds) {
      const value = Math.floor(diffSeconds / seconds);
      const plural = value === 1 ? "" : label === "day" ? "s" : "";
      return `${value} ${label}${plural} ago`;
    }
  }
  return "just now";
}
