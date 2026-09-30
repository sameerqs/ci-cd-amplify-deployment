"use client";

import { DashboardErrorView } from "@/components/custom/DashboardErrorView";
import { DASHBOARD_ROUTES } from "@/lib/routes";

export default function ModulesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <DashboardErrorView
      title="Something went wrong"
      digest={error.digest}
      onRetry={reset}
      secondaryAction={{
        type: "link",
        href: DASHBOARD_ROUTES.HOME,
        label: "Back to dashboard",
      }}
      logError={error}
    />
  );
}
