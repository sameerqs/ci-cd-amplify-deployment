import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Page-content shell — used by every dashboard module's list / detail
 * page so the inner content has consistent vertical rhythm regardless of
 * the surrounding sidebar / header.
 */
const shellVariants = cva(
    "grid grid-cols-1 items-center gap-[var(--density-page-gap)] pt-4 pb-6 2xl:gap-8 2xl:pt-6 2xl:pb-8",
    {
        variants: {
            variant: {
                default: "",
                sidebar: "",
                centered:
                    "flex h-dvh max-w-2xl flex-col justify-center py-16",
                markdown: "max-w-3xl py-8 md:py-10 lg:py-10",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

interface ShellProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof shellVariants> {
    as?: React.ElementType;
}

export function Shell({
    className,
    as: Comp = "section",
    variant,
    ...props
}: ShellProps) {
    return (
        <Comp className={cn(shellVariants({ variant }), className)} {...props} />
    );
}

export { shellVariants };
