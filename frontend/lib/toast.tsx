"use client";

/**
 * Toast facade over react-hot-toast.
 *
 * Call sites use `toast(msg)` for a neutral toast and `toast.success(msg, {
 * description })` / `toast.error(...)` etc. react-hot-toast has no
 * `description` option and no bare-call / info / warning variants, so this
 * module renders the second line itself, supplies the missing icons, and
 * makes `toast` itself callable — import from here, not react-hot-toast
 * directly, or both are lost.
 */

import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import hotToast, { type ToastOptions } from "react-hot-toast";
import type { ReactElement, ReactNode } from "react";

// react-hot-toast's own Message type: React.ReactElement | string | null — never
// `undefined` or an arbitrary ReactNode. `description` may still be any ReactNode
// since it's rendered here, not handed to react-hot-toast directly.
type ToastMessage = ReactElement | string | null;

export type ToastData = ToastOptions & { description?: ReactNode };

function body(message: ToastMessage, data?: ToastData): ToastMessage {
  if (!data?.description) return message;
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-medium">{message}</span>
      <span className="text-muted-foreground text-sm">{data.description}</span>
    </span>
  );
}

function options(data?: ToastData): ToastOptions | undefined {
  if (!data) return undefined;
  const rest: ToastData = { ...data };
  delete rest.description;
  return rest;
}

function neutral(message: ToastMessage, data?: ToastData) {
  return hotToast(body(message, data), options(data));
}

export const toast = Object.assign(neutral, {
  success: (message: ToastMessage, data?: ToastData) =>
    hotToast.success(body(message, data), options(data)),

  error: (message: ToastMessage, data?: ToastData) =>
    hotToast.error(body(message, data), options(data)),

  info: (message: ToastMessage, data?: ToastData) =>
    hotToast(body(message, data), {
      ...options(data),
      icon: <InfoIcon className="size-4 shrink-0" />,
    }),

  warning: (message: ToastMessage, data?: ToastData) =>
    hotToast(body(message, data), {
      ...options(data),
      icon: <TriangleAlertIcon className="size-4 shrink-0 text-amber-500" />,
    }),

  loading: (message: ToastMessage, data?: ToastData) =>
    hotToast.loading(body(message, data), options(data)),

  dismiss: hotToast.dismiss,
  remove: hotToast.remove,
});
