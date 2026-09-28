import { LoaderIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

function SpinnerCustom({ 
  className,
  size = "default",
  text,
}: { 
  className?: string;
  size?: "sm" | "default" | "lg";
  text?: string;
}) {
  const sizeClasses = {
    sm: "size-4",
    default: "size-6",
    lg: "size-8",
  }

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Spinner className={sizeClasses[size]} />
      {text && <span className="text-muted-foreground text-sm">{text}</span>}
    </div>
  )
}

function FullPageSpinner({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex min-h-[200px] w-full items-center justify-center">
      <SpinnerCustom size="lg" text={text} />
    </div>
  )
}

export { Spinner, SpinnerCustom, FullPageSpinner }
