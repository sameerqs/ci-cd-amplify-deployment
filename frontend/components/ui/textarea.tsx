import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 min-h-[100px] w-full rounded-3xl border-border border-[0.6px] bg-card pl-[12px] pr-[10px] py-[6px] text-[14px] leading-[20px] tracking-[-0.006em] shadow-xs transition-[color,box-shadow,border-color] outline-none hover:border-ring/50 disabled:hover:border-inherit focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
