import { type StatusTagColor } from '@/lib/status-tag-colors';
import { cn } from '@/lib/utils';

interface StatusTagBadgeProps {
    label: string;
    colors: StatusTagColor;
    className?: string;
}

export function StatusTagBadge({
    label,
    colors,
    className,
}: StatusTagBadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex h-6 items-center justify-center rounded-full px-2',
                'text-xs font-medium leading-[14px] tracking-[0.02em] capitalize',
                className,
            )}
            style={{
                backgroundColor: colors.background,
                color: colors.color,
            }}
        >
            {label}
        </span>
    );
}
