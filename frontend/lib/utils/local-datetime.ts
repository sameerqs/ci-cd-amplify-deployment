export function parseInstant(
  value: string | Date | null | undefined,
): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function instantToLocalDate(
  value: string | Date | null | undefined,
): Date | undefined {
  const d = parseInstant(value);
  if (!d) return undefined;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function instantToLocalTime(
  value: string | Date | null | undefined,
): string {
  const d = parseInstant(value);
  if (!d) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

export function localDateAndTimeToIso(calendarDate: Date, hhmm: string): string {
  const [hours, minutes] = hhmm.split(":").map((n) => Number(n));
  return new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth(),
    calendarDate.getDate(),
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  ).toISOString();
}

export function localTodayDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
