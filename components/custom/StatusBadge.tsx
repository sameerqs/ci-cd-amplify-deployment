import { cn } from "@/lib/utils";

export type StatusVariant =
  | "active"
  | "inactive"
  | "pending"
  | "success"
  | "error"
  | "warning"
  | "info";

interface StatusBadgeProps {
  status: boolean | string;
  activeLabel?: string;
  inactiveLabel?: string;
  variant?: "default" | "custom";
  className?: string;
}

const statusStyles: Record<string, string> = {
  active: "bg-[var(--status-success-bg)] text-[var(--status-success-fg)] border border-[var(--status-success-fg)]/[0.32]",
  inactive: "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] border border-[var(--status-danger-fg)]/[0.32]",
  pending: "bg-[var(--status-pending-bg)] text-[var(--status-pending-fg)] border border-[var(--status-pending-fg)]/[0.32]",
  success: "bg-[var(--status-success-bg)] text-[var(--status-success-fg)] border border-[var(--status-success-fg)]/[0.32]",
  error: "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] border border-[var(--status-danger-fg)]/[0.32]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] border border-[var(--status-warning-fg)]/[0.32]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info-fg)] border border-[var(--status-info-fg)]/[0.32]",
};

export function StatusBadge({
  status,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
  variant = "default",
  className,
}: StatusBadgeProps) {
  const isActive =
    typeof status === "boolean"
      ? status
      : status === "true" || status === "active";

  const statusType = isActive ? "active" : "inactive";

  const displayLabel =
    typeof status === "string" &&
    !["true", "false", "active", "inactive"].includes(status.toLowerCase())
      ? status.charAt(0).toUpperCase() + status.slice(1)
      : isActive
        ? activeLabel
        : inactiveLabel;

  const statusStyle = statusStyles[statusType] || statusStyles.inactive;

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2 py-2 gap-0.5 h-6 w-20.5",
        "text-xs font-medium leading-[14px] tracking-[0.02em] capitalize",
        statusStyle,
        className,
      )}
    >
      {displayLabel}
    </div>
  );
}

interface StatusBadgeCustomProps {
  label: string;
  variant?:
    | "active"
    | "inactive"
    | "pending"
    | "success"
    | "error"
    | "warning"
    | "info";
  className?: string;
}

export function StatusBadgeCustom({
  label,
  variant = "info",
  className,
}: StatusBadgeCustomProps) {
  const statusStyle = statusStyles[variant] || statusStyles.info;

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2 py-2 gap-0.5 h-6",
        "text-xs font-medium leading-[14px] tracking-[0.02em] capitalize",
        statusStyle,
        className,
      )}
    >
      {label}
    </div>
  );
}

export function activeInactiveHeroStatus(isActive: boolean): {
  label: "Active" | "Inactive";
  tone: "success" | "inactive";
} {
  return isActive
    ? { label: "Active", tone: "success" }
    : { label: "Inactive", tone: "inactive" };
}
