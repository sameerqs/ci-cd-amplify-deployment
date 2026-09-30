"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import {
  UnsavedChangesDialog,
  UnsavedChangesDialogProps,
} from "./unsaved-changes-dialog";
import { useUnsavedChangesOptional } from "@/app/context/unsaved-changes-context";
import type { RequestLeaveTarget } from "@/app/context/unsaved-changes-context";
import { signOut } from "@/lib/auth/sign-out";

export interface FormGuardProps {
  isDirty: boolean;

  children: React.ReactNode;

  enabled?: boolean;

  dialogProps?: Partial<
    Omit<UnsavedChangesDialogProps, "open" | "onConfirm" | "onCancel">
  >;

  onDiscard?: () => void;

  onStay?: () => void;
}

export interface FormGuardContextValue {
  push: (url: string) => boolean;
  back: () => boolean;
  replace: (url: string) => boolean;
  isDirty: boolean;
  isActive: boolean;
  handleNavigation: (url: string) => boolean;
}

const FormGuardContext = React.createContext<FormGuardContextValue | null>(
  null,
);

export function useFormGuard(): FormGuardContextValue {
  const context = React.useContext(FormGuardContext);
  if (!context) {
    throw new Error("useFormGuard must be used within a FormGuard component");
  }
  return context;
}

export function useFormGuardOptional(): FormGuardContextValue | null {
  return React.useContext(FormGuardContext);
}

export function useGuardedRouter() {
  const router = useRouter();
  const formGuard = useFormGuardOptional();

  return React.useMemo(() => {
    if (formGuard) {
      return {
        push: formGuard.push,
        back: formGuard.back,
        replace: formGuard.replace,
        refresh: router.refresh,
        prefetch: router.prefetch,
        forward: router.forward,
      };
    }
    return {
      push: (url: string) => {
        router.push(url);
        return true;
      },
      back: () => {
        router.back();
        return true;
      },
      replace: (url: string) => {
        router.replace(url);
        return true;
      },
      refresh: router.refresh,
      prefetch: router.prefetch,
      forward: router.forward,
    };
  }, [formGuard, router]);
}

export function FormGuard({
  isDirty,
  children,
  enabled = true,
  dialogProps,
  onDiscard,
  onStay,
}: FormGuardProps) {
  const router = useRouter();
  const isActive = enabled && isDirty;
  const pendingActionRef = React.useRef<{
    type: "push" | "back" | "replace" | "logout";
    url?: string;
  } | null>(null);

  const unsavedContext = useUnsavedChangesOptional();

  const {
    showDialog,
    confirmNavigation,
    cancelNavigation,
    setPendingNavigation,
    pendingNavigation,
  } = useUnsavedChangesWarning({
    isDirty,
    enabled,
  });

  const requestLeaveCallback = React.useCallback(
    (url: RequestLeaveTarget) => {
      if (url === "__back__") {
        pendingActionRef.current = { type: "back" };
        setPendingNavigation("__back__");
      } else if (url === "__logout__") {
        pendingActionRef.current = { type: "logout" };
        setPendingNavigation("__logout__");
      } else {
        pendingActionRef.current = { type: "push", url };
        setPendingNavigation(url);
      }
    },
    [setPendingNavigation],
  );

  React.useEffect(() => {
    if (!unsavedContext) return;
    if (isActive) {
      unsavedContext.registerHandlers(requestLeaveCallback);
    }
    return () => {
      unsavedContext.clearHandlers();
    };
  }, [isActive, unsavedContext, requestLeaveCallback]);

  React.useEffect(() => {
    if (!isActive) return;
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      pendingActionRef.current = { type: "back" };
      setPendingNavigation("__back__");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isActive, setPendingNavigation]);

  const handleConfirm = React.useCallback(() => {
    onDiscard?.();
    confirmNavigation();

    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setPendingNavigation(null);

    if (action) {
      switch (action.type) {
        case "push":
          if (action.url) router.push(action.url);
          break;
        case "back":
          router.back();
          break;
        case "replace":
          if (action.url) router.replace(action.url);
          break;
        case "logout":
          void signOut();
          break;
      }
    }
  }, [confirmNavigation, onDiscard, router, setPendingNavigation]);

  const handleCancel = React.useCallback(() => {
    onStay?.();
    cancelNavigation();
    pendingActionRef.current = null;
  }, [cancelNavigation, onStay]);

  const push = React.useCallback(
    (url: string): boolean => {
      if (isActive) {
        pendingActionRef.current = { type: "push", url };
        setPendingNavigation(url);
        return false;
      }
      router.push(url);
      return true;
    },
    [isActive, setPendingNavigation, router],
  );

  const back = React.useCallback((): boolean => {
    if (isActive) {
      pendingActionRef.current = { type: "back" };
      setPendingNavigation("__back__");
      return false;
    }
    router.back();
    return true;
  }, [isActive, setPendingNavigation, router]);

  const replace = React.useCallback(
    (url: string): boolean => {
      if (isActive) {
        pendingActionRef.current = { type: "replace", url };
        setPendingNavigation(url);
        return false;
      }
      router.replace(url);
      return true;
    },
    [isActive, setPendingNavigation, router],
  );

  const contextValue = React.useMemo<FormGuardContextValue>(
    () => ({
      push,
      back,
      replace,
      isDirty,
      isActive,
      handleNavigation: push,
    }),
    [push, back, replace, isDirty, isActive],
  );

  return (
    <FormGuardContext.Provider value={contextValue}>
      {children}
      <UnsavedChangesDialog
        open={showDialog}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        {...dialogProps}
      />
    </FormGuardContext.Provider>
  );
}

export default FormGuard;
