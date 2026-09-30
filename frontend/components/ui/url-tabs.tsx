"use client";

import * as React from "react";
import { parseAsString, useQueryState } from "nuqs";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TabBadge,
} from "@/components/ui/tabs";

interface UrlTabsProps {
  defaultValue: string;
  paramName?: string;
  className?: string;
  children: React.ReactNode;
  beforeChange?: (newValue: string) => boolean;
  shallow?: boolean;
}

function UrlTabs({
  defaultValue,
  paramName = "tab",
  className,
  children,
  beforeChange,
  shallow = true,
}: UrlTabsProps) {
  const [activeTab, setActiveTab] = useQueryState(
    paramName,
    parseAsString.withDefault(defaultValue).withOptions({
      shallow,
      history: "replace",
      clearOnDefault: true,
    })
  );

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (beforeChange && !beforeChange(newValue)) {
        return;
      }
      void setActiveTab(newValue === defaultValue ? null : newValue);
    },
    [beforeChange, defaultValue, setActiveTab]
  );

  return (
    <Tabs value={activeTab} onValueChange={handleValueChange} className={className}>
      {children}
    </Tabs>
  );
}

export { UrlTabs, TabsContent, TabsList, TabsTrigger, TabBadge };
