export type DatePresetKey =
    | 'this_week'
    | 'last_week'
    | 'this_month'
    | 'last_month'
    | 'this_quarter'
    | 'last_quarter'
    | 'ytd'
    | 'custom';

export interface DateRange {
    from?: string;
    to?: string;
}

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function endOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

function startOfWeek(d: Date): Date {
    const x = startOfDay(d);
    const day = x.getDay();
    const diff = (day + 6) % 7;
    x.setDate(x.getDate() - diff);
    return x;
}

function startOfMonth(d: Date): Date {
    return startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
}

function endOfMonth(d: Date): Date {
    return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function startOfQuarter(d: Date): Date {
    const q = Math.floor(d.getMonth() / 3);
    return startOfDay(new Date(d.getFullYear(), q * 3, 1));
}

function endOfQuarter(d: Date): Date {
    const q = Math.floor(d.getMonth() / 3);
    return endOfDay(new Date(d.getFullYear(), q * 3 + 3, 0));
}

function startOfYear(d: Date): Date {
    return startOfDay(new Date(d.getFullYear(), 0, 1));
}

export function dateRangeForPreset(preset: DatePresetKey): DateRange {
    const now = new Date();
    switch (preset) {
        case 'this_week':
            return {
                from: startOfWeek(now).toISOString(),
                to: endOfDay(now).toISOString(),
            };
        case 'last_week': {
            const thisWeekStart = startOfWeek(now);
            const lastWeekStart = new Date(thisWeekStart);
            lastWeekStart.setDate(lastWeekStart.getDate() - 7);
            const lastWeekEnd = new Date(thisWeekStart);
            lastWeekEnd.setMilliseconds(-1);
            return {
                from: lastWeekStart.toISOString(),
                to: lastWeekEnd.toISOString(),
            };
        }
        case 'this_month':
            return {
                from: startOfMonth(now).toISOString(),
                to: endOfDay(now).toISOString(),
            };
        case 'last_month': {
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return {
                from: startOfMonth(lastMonth).toISOString(),
                to: endOfMonth(lastMonth).toISOString(),
            };
        }
        case 'this_quarter':
            return {
                from: startOfQuarter(now).toISOString(),
                to: endOfDay(now).toISOString(),
            };
        case 'last_quarter': {
            const lastQ = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            return {
                from: startOfQuarter(lastQ).toISOString(),
                to: endOfQuarter(lastQ).toISOString(),
            };
        }
        case 'ytd':
            return {
                from: startOfYear(now).toISOString(),
                to: endOfDay(now).toISOString(),
            };
        case 'custom':
        default:
            return {};
    }
}

function sameInstant(a?: string, b?: string): boolean {
    if (!a || !b) return false;
    const ax = Date.parse(a);
    const bx = Date.parse(b);
    if (Number.isNaN(ax) || Number.isNaN(bx)) return false;
    return Math.abs(ax - bx) < 1500;
}

export const DATE_PRESET_KEYS: DatePresetKey[] = [
    'this_week',
    'last_week',
    'this_month',
    'last_month',
    'this_quarter',
    'last_quarter',
    'ytd',
    'custom',
];

const DETECTABLE_PRESETS: DatePresetKey[] = DATE_PRESET_KEYS.filter(
    (key) => key !== 'custom',
);

export function detectPreset(from?: string, to?: string): DatePresetKey {
    if (!from && !to) return 'this_month';
    for (const preset of DETECTABLE_PRESETS) {
        const range = dateRangeForPreset(preset);
        if (sameInstant(from, range.from) && sameInstant(to, range.to)) {
            return preset;
        }
    }
    return 'custom';
}

/**
 * The active preset is an explicit user choice when present, otherwise inferred
 * from the dates — so a shared URL carrying only from/to still highlights right.
 */
export function resolveActivePreset(
    preset: DatePresetKey | null,
    from?: string,
    to?: string,
): DatePresetKey {
    return preset ?? detectPreset(from, to);
}

export interface PresetSelectionState {
    preset: DatePresetKey | null;
    from: string | null;
    to: string | null;
}

/**
 * Custom is a persisted intent: detection can never yield it, so picking it must
 * write an explicit param and seed the pickers from the active range. Named
 * presets clear the param (detection covers the highlight) but always write
 * from/to, which the report RSC pages read straight off the URL.
 */
export function presetSelectionState(
    next: DatePresetKey,
    current: { from?: string | null; to?: string | null },
): PresetSelectionState {
    if (next === 'custom') {
        const seed =
            current.from || current.to
                ? { from: current.from ?? null, to: current.to ?? null }
                : dateRangeForPreset('this_month');
        return {
            preset: 'custom',
            from: seed.from ?? null,
            to: seed.to ?? null,
        };
    }
    const range = dateRangeForPreset(next);
    return { preset: null, from: range.from ?? null, to: range.to ?? null };
}
