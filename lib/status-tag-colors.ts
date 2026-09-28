import type { CSSProperties } from 'react';

export interface StatusTagColor {
    background: string;
    color: string;
}

/**
 * Generic status-tag palette. Map your feature's status enums onto these in a
 * module-level helper (e.g. `getOrderStatusTagColor`) rather than hardcoding
 * colors at call sites.
 */
export const TAG_COLORS = {
    pending: {
        background: 'var(--status-pending-bg)',
        color: 'var(--status-pending-fg)',
    },
    warning: {
        background: 'var(--status-warning-bg)',
        color: 'var(--status-warning-fg)',
    },
    success: {
        background: 'var(--status-success-bg)',
        color: 'var(--status-success-fg)',
    },
    info: {
        background: 'var(--status-info-bg)',
        color: 'var(--status-info-fg)',
    },
    accent: {
        background: 'var(--status-accent-bg)',
        color: 'var(--status-accent-fg)',
    },
    danger: {
        background: 'var(--status-danger-bg)',
        color: 'var(--status-danger-fg)',
    },
} as const satisfies Record<string, StatusTagColor>;

export interface StatusTagKpiTheme {
    gradientStyle: CSSProperties;
    iconChipStyle: CSSProperties;
    focusRingColor: string;
}

export function statusTagToKpiTheme(colors: StatusTagColor): StatusTagKpiTheme {
    return {
        gradientStyle: {
            backgroundImage: `linear-gradient(to bottom, ${colors.background}, transparent)`,
        },
        iconChipStyle: {
            backgroundColor: colors.background,
            color: colors.color,
        },
        focusRingColor: colors.color,
    };
}

export function statusTagToCalendarPalette(colors: StatusTagColor): {
    bg: string;
    border: string;
    text: string;
    dot: string;
} {
    return {
        bg: colors.background,
        border: colors.color,
        text: colors.color,
        dot: colors.color,
    };
}
