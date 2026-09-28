"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TwoColumnLayoutProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  leftWidth?:
    | "w-2/3"
    | "w-1/2"
    | "w-3/4"
    | "w-full lg:w-2/3"
    | "w-full lg:w-1/2";
  rightWidth?:
    | "w-1/3"
    | "w-1/2"
    | "w-1/4"
    | "w-full lg:w-1/3"
    | "w-full lg:w-1/2";
  gap?: "gap-3" | "gap-4" | "gap-5" | "gap-6";
  lgGap?: "lg:gap-3" | "lg:gap-4" | "lg:gap-5" | "lg:gap-6";
  itemGap?: "gap-3" | "gap-4" | "gap-5";
  lgItemGap?: "lg:gap-3" | "lg:gap-4" | "lg:gap-5";
  className?: string;
  leftClassName?: string;
  rightClassName?: string;
  containerClassName?: string;
}

export default function TwoColumnLayout({
  leftContent,
  rightContent,
  leftWidth = "w-full lg:w-2/3",
  rightWidth = "w-full lg:w-1/3",
  gap = "gap-4",
  lgGap = "lg:gap-3",
  itemGap = "gap-3",
  lgItemGap = "lg:gap-5",
  className,
  leftClassName,
  rightClassName,
  containerClassName,
}: TwoColumnLayoutProps) {
  return (
    <div
      className={cn(
        "flex flex-col lg:flex-row",
        gap,
        lgGap,
        "mb-6",
        containerClassName,
        className,
      )}
    >
      {/* left content */}
      <div
        className={cn(
          leftWidth,
          itemGap,
          lgItemGap,
          "flex flex-col",
          leftClassName,
        )}
      >
        {leftContent}
      </div>
      {/* right content */}
      <div
        className={cn(
          rightWidth,
          itemGap,
            lgItemGap,
          "flex flex-col",
          rightClassName,
        )}
      >
        {rightContent}
      </div>
    </div>
  );
}
