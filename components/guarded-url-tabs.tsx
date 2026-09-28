"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { UrlTabs } from "@/components/ui/url-tabs";
import { useUnsavedChangesOptional } from "@/app/context/unsaved-changes-context";

interface GuardedUrlTabsProps {
  defaultValue: string;
  paramName?: string;
  className?: string;
  shallow?: boolean;
  children: React.ReactNode;
}

export function GuardedUrlTabs({
  defaultValue,
  paramName = "tab",
  className,
  shallow,
  children,
}: GuardedUrlTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const unsaved = useUnsavedChangesOptional();

  const beforeChange = React.useCallback(
    (newValue: string) => {
      if (unsaved?.hasUnsavedChanges) {
        const params = new URLSearchParams(searchParams.toString());
        params.set(paramName, newValue);
        const queryString = params.toString();
        const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
        unsaved.requestLeave(targetUrl);
        return false;
      }
      return true;
    },
    [pathname, paramName, searchParams, unsaved]
  );

  return (
    <UrlTabs
      defaultValue={defaultValue}
      paramName={paramName}
      className={className}
      shallow={shallow}
      beforeChange={beforeChange}
    >
      {children}
    </UrlTabs>
  );
}
