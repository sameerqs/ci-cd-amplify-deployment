"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useUnsavedChangesOptional } from "@/app/context/unsaved-changes-context";

type GuardedLinkProps = ComponentProps<typeof Link>;

export function GuardedLink({ href, onClick, children, ...rest }: GuardedLinkProps) {
  const unsaved = useUnsavedChangesOptional();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (unsaved?.hasUnsavedChanges && typeof href === "string" && href !== "#") {
      e.preventDefault();
      unsaved.requestLeave(href);
      return;
    }
    onClick?.(e);
  };

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
