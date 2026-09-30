import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { DetailHeaderSync } from '@/components/detail-header-sync';
import { StatusTagBadge } from '@/components/custom/StatusTagBadge';
import { TruncatedTextWithTooltip } from '@/components/custom/truncated-text-with-tooltip';
import {
    StatusBadgeCustom,
    type StatusVariant,
} from '@/components/custom/StatusBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { StatusTagColor } from '@/lib/status-tag-colors';
import { cn } from '@/lib/utils';

export interface DetailHeroMetaItem {
    label?: string;
    value: React.ReactNode;
    icon?: LucideIcon;
}

export interface DetailHeroProps {
    monogram?: string;
    avatarUrl?: string | null;
    leadingSlot?: React.ReactNode;
    /** Module / record-type glyph in the gradient tile when there is no custom slot or photo */
    leadingTileIcon?: LucideIcon;
    /** When false, the large heading line is omitted (e.g. query chip carries the id). */
    showHeading?: boolean;
    subtitle?: string;
    meta?: DetailHeroMetaItem[];
    status?: {
        label: string;
        colors?: StatusTagColor;
        tone?:
            | 'success'
            | 'warn'
            | 'muted'
            | 'info'
            | 'active'
            | 'inactive';
    };
    actions?: React.ReactNode;
}

type DetailHeroStatusTone = NonNullable<DetailHeroProps['status']>['tone'];

function heroToneToVariant(
    tone: DetailHeroStatusTone,
): StatusVariant {
    switch (tone) {
        case 'success':
            return 'success';
        case 'active':
            return 'active';
        case 'inactive':
            return 'inactive';
        case 'warn':
            return 'warning';
        case 'muted':
            return 'info';
        default:
            return 'info';
    }
}

function resolveHeroStatusVariant(
    label: string,
    tone?: DetailHeroStatusTone,
): StatusVariant {
    const normalized = label.trim().toLowerCase();
    if (normalized === 'inactive') return 'inactive';
    if (normalized === 'active') return 'active';
    return heroToneToVariant(tone ?? 'info');
}

function renderHeroMetaValue(value: React.ReactNode): React.ReactNode {
    if (typeof value === 'string' || typeof value === 'number') {
        return (
            <TruncatedTextWithTooltip
                text={String(value)}
                className="inline"
            />
        );
    }
    return value;
}

function DetailHero({
    title,
    monogram,
    avatarUrl,
    leadingSlot,
    leadingTileIcon,
    showHeading = true,
    subtitle,
    meta,
    status,
    actions,
}: DetailHeroProps & { title: string }) {
    const initials =
        monogram?.slice(0, 4).toUpperCase() ||
        title
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase() ?? '')
            .join('');
    const LeadingTileIc = leadingTileIcon;
    const showAvatar = Boolean(avatarUrl?.trim());

    return (
        <div
            className={cn(
                'rounded-xl border bg-card px-4 py-5 shadow-sm sm:px-6',
                'border-t-2 border-t-primary/15',
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 gap-4">
                    {leadingSlot ? (
                        <div className="shrink-0">{leadingSlot}</div>
                    ) : showAvatar ? (
                        <Avatar className="size-16 shrink-0 rounded-xl ring-2 ring-primary/15">
                            <AvatarImage
                                src={avatarUrl ?? undefined}
                                alt=""
                                className="rounded-xl object-cover"
                            />
                            <AvatarFallback
                                className={cn(
                                    'rounded-xl text-lg font-semibold text-primary-foreground',
                                    'bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_60%,var(--accent))]',
                                )}
                            >
                                {initials || '?'}
                            </AvatarFallback>
                        </Avatar>
                    ) : (
                        <div
                            className={cn(
                                'flex size-16 shrink-0 items-center justify-center rounded-xl text-lg font-semibold tracking-tight text-primary-foreground ring-2 ring-primary/15',
                                'bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_60%,var(--accent))]',
                            )}
                            aria-hidden={LeadingTileIc ? undefined : !initials}
                        >
                            {LeadingTileIc ? (
                                <LeadingTileIc
                                    className="size-7 shrink-0 stroke-[1.5]"
                                    aria-hidden
                                />
                            ) : initials ? (
                                <span className="leading-none">{initials}</span>
                            ) : null}
                        </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                        {showHeading ? (
                            <h2 className="min-w-0 text-2xl font-semibold tracking-tight text-foreground">
                                <TruncatedTextWithTooltip text={title} />
                            </h2>
                        ) : null}
                        {subtitle ? (
                            <TruncatedTextWithTooltip
                                text={subtitle}
                                className="text-sm text-muted-foreground"
                            />
                        ) : null}
                        {meta && meta.length > 0 ? (
                            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                                {meta.map((item, i) => {
                                    const Icon = item.icon;
                                    const key =
                                        typeof item.value === 'string' ||
                                        typeof item.value === 'number'
                                            ? `${item.label ?? 'meta'}-${item.value}-${i}`
                                            : `${item.label ?? 'meta'}-${i}`;
                                    return (
                                        <li
                                            key={key}
                                            className="flex max-w-full items-center gap-1.5"
                                        >
                                            {Icon ? (
                                                <Icon
                                                    className="size-3.5 shrink-0 text-primary/70"
                                                    aria-hidden
                                                />
                                            ) : null}
                                            <span className="flex min-w-0 max-w-full items-center gap-0">
                                                {item.label ? (
                                                    <>
                                                        <span className="shrink-0 font-medium text-foreground/80">
                                                            {item.label}:{' '}
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            {renderHeroMetaValue(
                                                                item.value,
                                                            )}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="min-w-0 flex-1">
                                                        {renderHeroMetaValue(
                                                            item.value,
                                                        )}
                                                    </span>
                                                )}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : null}
                    </div>
                </div>
                <div className="flex w-full min-w-0 basis-full flex-wrap items-center justify-start gap-2 sm:basis-auto sm:w-auto sm:justify-end">
                    {status ? (
                        status.colors ? (
                            <StatusTagBadge
                                label={status.label}
                                colors={status.colors}
                                className="h-7 px-3 capitalize"
                            />
                        ) : (
                            <StatusBadgeCustom
                                label={status.label}
                                variant={resolveHeroStatusVariant(
                                    status.label,
                                    status.tone,
                                )}
                                className="h-7 px-3 capitalize"
                            />
                        )
                    ) : null}
                    {actions}
                </div>
            </div>
        </div>
    );
}

interface DetailPageHeaderProps {
    name: string;
    backTo: string;
    parentName?: string;
    parentBack?: string;
    rightSlot?: React.ReactNode;
    hero?: DetailHeroProps;
    children: React.ReactNode;
}

export function DetailPageHeader({
    name,
    backTo,
    parentName,
    parentBack,
    rightSlot,
    hero,
    children,
}: DetailPageHeaderProps) {
    return (
        <DetailHeaderSync
            name={name}
            backTo={backTo}
            parentName={parentName}
            parentBack={parentBack}
        >
            <div className="space-y-4">
                {hero ? (
                    <DetailHero {...hero} title={name} />
                ) : null}
                {rightSlot && hero?.actions == null ? (
                    <div className="flex justify-end">{rightSlot}</div>
                ) : null}
                {children}
            </div>
        </DetailHeaderSync>
    );
}
