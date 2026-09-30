"use client";

import { Toaster as HotToaster, type ToasterProps } from "react-hot-toast";

/**
 * App-wide toast host. Themed off the same CSS variables as the popover
 * surface so toasts follow light/dark without a theme hook.
 */
const Toaster = ({ toastOptions, ...props }: ToasterProps) => (
  <HotToaster
    toastOptions={{
      duration: 4000,
      ...toastOptions,
      style: {
        background: "var(--popover)",
        color: "var(--popover-foreground)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        ...toastOptions?.style,
      },
      success: {
        iconTheme: { primary: "var(--color-green-500)", secondary: "var(--popover)" },
        ...toastOptions?.success,
      },
      error: {
        iconTheme: { primary: "var(--color-red-500)", secondary: "var(--popover)" },
        ...toastOptions?.error,
      },
    }}
    {...props}
  />
);

export { Toaster };
