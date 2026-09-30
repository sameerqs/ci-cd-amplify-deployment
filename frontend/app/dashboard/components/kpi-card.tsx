import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export type KpiAccent = 'neutral' | 'green' | 'amber' | 'red' | 'blue';

interface AccentStyle {
    gradient: string;
    iconChip: string;
    ring: string;
}

const ACCENTS: Record<KpiAccent, AccentStyle> = {
    neutral: {
        gradient: 'from-slate-100/80',
        iconChip: 'bg-slate-100 text-slate-700 ring-slate-200',
        ring: 'focus-visible:ring-slate-400',
    },
    green: {
        gradient: 'from-emerald-100/70',
        iconChip: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
        ring: 'focus-visible:ring-emerald-500',
    },
    amber: {
        gradient: 'from-amber-100/70',
        iconChip: 'bg-amber-100 text-amber-700 ring-amber-200',
        ring: 'focus-visible:ring-amber-500',
    },
    red: {
        gradient: 'from-rose-100/70',
        iconChip: 'bg-rose-100 text-rose-700 ring-rose-200',
        ring: 'focus-visible:ring-rose-500',
    },
    blue: {
        gradient: 'from-sky-100/70',
        iconChip: 'bg-sky-100 text-sky-700 ring-sky-200',
        ring: 'focus-visible:ring-sky-500',
    },
};

interface KpiCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    accent?: KpiAccent;
    sublabel?: string;
    href?: string;
}

export function KpiCard({
    label,
    value,
    icon: Icon,
    accent = 'neutral',
    sublabel,
    href,
}: KpiCardProps) {
    const a = ACCENTS[accent];

    const body = (
        <div
            className={cn(
                'group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-[var(--density-kpi-padding)] shadow-sm transition-all duration-200',
                href && 'hover:-translate-y-0.5 hover:shadow-md',
            )}
        >
            <div
                className={cn(
                    'pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent opacity-80',
                    a.gradient,
                )}
                aria-hidden
            />
            <div className="relative flex items-start justify-between">
                <span
                    className={cn(
                        'inline-flex size-[var(--density-kpi-icon)] items-center justify-center rounded-xl ring-1',
                        a.iconChip,
                    )}
                    aria-hidden
                >
                    <Icon className="size-5" />
                </span>
                {href ? (
                    <ArrowUpRight
                        className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                    />
                ) : null}
            </div>
            <div className="relative flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                </p>
                <p className="text-[length:var(--density-kpi-count)] font-bold leading-none tracking-tight tabular-nums">
                    {value}
                </p>
                {sublabel ? (
                    <p className="text-xs text-muted-foreground">{sublabel}</p>
                ) : null}
            </div>
        </div>
    );

    if (href) {
        return (
            <Link
                href={href}
                aria-label={`${label}: ${value}`}
                className={cn(
                    'block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    a.ring,
                )}
            >
                {body}
            </Link>
        );
    }

    return body;
}
