import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          " rounded-full bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "rounded-full border border-destructive bg-white  hover:bg-destructive/10 text-destructive  focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "rounded-full border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "rounded-full hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        gradient:
          "rounded-full !gap-0.5 min-w-[105px] bg-[linear-gradient(180deg,color-mix(in_srgb,white_0%,transparent)_63.532%,color-mix(in_srgb,white_18%,transparent)_100%),linear-gradient(183.19deg,var(--accent-500)_9.45%,var(--accent-800)_81%)] shadow-[inset_0px_-1px_0px_1px_color-mix(in_srgb,var(--accent-800)_80%,transparent),inset_0px_0px_0px_1px_var(--accent-800),inset_0px_0.5px_0px_1.5px_color-mix(in_srgb,var(--accent-800)_25%,transparent)] text-primary-foreground font-semibold leading-4 hover:opacity-95",
        muted:
          "rounded-full px-3 py-1.5 gap-0.5 h-7 bg-muted text-foreground! font-semibold leading-4 cursor-not-allowed!",
        link: "text-primary underline-offset-4 hover:underline leading-5",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-[calc(var(--radius)-5px)]",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
