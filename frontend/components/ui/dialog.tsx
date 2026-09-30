"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { resolveDialogTitleText } from "@/lib/utils/dialog-title-text"
import { PortalContainerProvider } from "@/lib/portal-container-context"
import { Z_INDEX } from "@/lib/z-index"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      `fixed inset-0 ${Z_INDEX.modal} bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`,
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const [contentNode, setContentNode] = React.useState<HTMLDivElement | null>(
    null
  )
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      setContentNode(node)
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={setRefs}
        className={cn(
          `fixed left-[50%] top-[50%] ${Z_INDEX.modal} grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-hidden border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg`,
          className
        )}
        {...props}
      >
        <PortalContainerProvider container={contentNode}>
          {children}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </PortalContainerProvider>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex min-w-0 w-full flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex min-w-0 w-full flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

type DialogTitleProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Title
> & {
  maxLength?: number | false
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  DialogTitleProps
>(({ className, children, maxLength, title, ...props }, ref) => {
  const resolved = resolveDialogTitleText(children, maxLength)
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "min-w-0 max-w-full overflow-hidden text-lg font-semibold leading-none tracking-tight text-pretty wrap-break-word hyphens-auto",
        className
      )}
      title={title ?? resolved.titleAttr}
      {...props}
    >
      {resolved.children}
    </DialogPrimitive.Title>
  )
})
DialogTitle.displayName = DialogPrimitive.Title.displayName

type DialogDescriptionProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Description
> & {
  maxLength?: number | false
}

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  DialogDescriptionProps
>(({ className, children, maxLength, title, ...props }, ref) => {
  const resolved =
    maxLength === false || maxLength === undefined
      ? { children, titleAttr: undefined as string | undefined }
      : resolveDialogTitleText(children, maxLength)

  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn(
        "min-w-0 max-w-full overflow-hidden text-sm text-muted-foreground text-pretty wrap-break-word hyphens-auto",
        className
      )}
      title={title ?? resolved.titleAttr}
      {...props}
    >
      {resolved.children}
    </DialogPrimitive.Description>
  )
})
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
