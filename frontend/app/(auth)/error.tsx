"use client";

import { DashboardErrorView } from "@/components/custom/DashboardErrorView";
import { AUTH_ROUTES } from "@/lib/routes";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <DashboardErrorView
      title="Authentication error"
      digest={error.digest}
      onRetry={reset}
      secondaryAction={{
        type: "link",
        href: AUTH_ROUTES.LOGIN,
        label: "Back to login",
      }}
      logError={error}
    />
  );
}
