"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-11 min-h-11 w-fit overflow-hidden rounded-lg border border-border bg-secondary/80 p-0 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "group relative inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-[color,background-color] hover:bg-muted/70 hover:text-foreground focus-visible:z-10 focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-primary dark:data-[state=active]:bg-card dark:data-[state=active]:text-primary dark:data-[state=active]:hover:bg-card data-[state=active]:hover:bg-background [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "after:pointer-events-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform after:duration-300 data-[state=active]:after:scale-x-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

function TabBadge({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tab-badge"
      className={cn(
        "inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-muted px-1.5 py-0 text-[10px] font-medium tabular-nums text-muted-foreground transition-colors group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabBadge }
