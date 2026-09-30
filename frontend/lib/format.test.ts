import { describe, expect, it } from 'vitest';

import { formatAppDateTime, formatUtcDate } from './format';

describe('formatAppDateTime', () => {
  // NEXT_PUBLIC_APP_TIMEZONE is unset in the test env, so the app timezone
  // defaults to UTC (mirrors the server's app-datetime.util default).
  it('renders an instant in the app timezone with a zone label', () => {
    expect(formatAppDateTime('2026-06-16T16:00:00Z')).toBe(
      'Jun 16, 2026, 4:00 PM (UTC)',
    );
  });

  it('is stable across DST boundaries in the default zone', () => {
    expect(formatAppDateTime('2026-01-16T17:00:00Z')).toBe(
      'Jan 16, 2026, 5:00 PM (UTC)',
    );
  });

  it('returns empty string for null/invalid input', () => {
    expect(formatAppDateTime(null)).toBe('');
    expect(formatAppDateTime(undefined)).toBe('');
    expect(formatAppDateTime('')).toBe('');
    expect(formatAppDateTime('not-a-date')).toBe('');
  });
});

describe('formatUtcDate (date-only, recipient-local portal unaffected)', () => {
  it('renders a stored UTC-midnight date without shifting it', () => {
    expect(formatUtcDate('2026-12-15T00:00:00Z')).toBe('December 15, 2026');
  });
});
