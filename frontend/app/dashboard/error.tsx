"use client";

import { DashboardErrorView } from "@/components/custom/DashboardErrorView";
import { DASHBOARD_ROUTES } from "@/lib/routes";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <DashboardErrorView
      title="Dashboard error"
      digest={error.digest}
      onRetry={reset}
      secondaryAction={{
        type: "link",
        href: DASHBOARD_ROUTES.HOME,
        label: "Reload dashboard",
      }}
      logError={error}
    />
  );
}
