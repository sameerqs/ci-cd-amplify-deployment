import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CustomCardProps {
  heading?: string;

  description?: string;

  action?: React.ReactNode;

  children: React.ReactNode;

  footer?: React.ReactNode;

  className?: string;

  headerClassName?: string;

  titleClassName?: string;

  contentClassName?: string;

  footerClassName?: string;

  headerBorder?: boolean;

  footerBorder?: boolean;

  icon?: React.ReactNode | LucideIcon;

  step?: string;

  tone?: "default" | "accent";

  style?: React.CSSProperties;
}

function isLucideIcon(value: unknown): value is LucideIcon {
  if (typeof value === "function") return true;
  return (
    typeof value === "object" &&
    value !== null &&
    "$$typeof" in value &&
    "render" in value
  );
}

function renderCardIcon(icon: React.ReactNode | LucideIcon | undefined) {
  if (!icon) return null;
  if (isLucideIcon(icon)) {
    const Icon = icon;
    return <Icon className="size-4" aria-hidden />;
  }
  return icon;
}

export default function CustomCard({
  heading,
  description,
  action,
  children,
  footer,
  className,
  headerClassName,
  titleClassName,
  contentClassName = "flex flex-col gap-4 p-0 2xl:gap-5",
  footerClassName,
  headerBorder = false,
  footerBorder = false,
  icon,
  step,
  tone = "default",
  style,
}: CustomCardProps) {
  const showHeader = heading || description || action || step || icon;
  return (
    <Card
      style={style}
      className={cn(
        "w-full flex flex-col gap-4 p-4 2xl:gap-5 2xl:p-5",
      
       
        tone === "accent" &&
          "relative before:pointer-events-none before:absolute before:left-1.5 before:top-4 before:bottom-4 before:w-2.5 before:rounded-l-xl before:border-2 before:border-r-0 before:border-primary/55 hover:before:border-primary",
        className,
      )}
    >
      {showHeader && (
        <CardHeader
          className={cn(headerBorder && "border-b p-0!", headerClassName)}
        >
          {(heading || step || icon) && (
            <CardTitle
              className={cn(
                "flex min-w-0 items-start gap-3 leading-snug",
                titleClassName,
              )}
            >
              {icon ? (
                <span
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/[0.08] text-primary ring-1 ring-primary/12"
                  aria-hidden
                >
                  {renderCardIcon(icon)}
                </span>
              ) : null}
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                {step ? (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {step}
                  </span>
                ) : null}
                {heading ? (
                  <span className="text-base font-bold tracking-tight">
                    {heading}
                  </span>
                ) : null}
              </span>
            </CardTitle>
          )}
          {description && <CardDescription>{description}</CardDescription>}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}

      <CardContent className={cn("px-0", contentClassName)}>
        {children}
      </CardContent>

      {footer && (
        <CardFooter className={cn(footerBorder && "border-t", footerClassName)}>
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
