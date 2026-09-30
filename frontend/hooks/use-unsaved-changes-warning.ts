"use client";

import { useEffect, useCallback, useState } from "react";

export interface UseUnsavedChangesWarningOptions {

    isDirty: boolean;

    message?: string;

    enabled?: boolean;
}

export interface UseUnsavedChangesWarningReturn {

    showDialog: boolean;

    confirmNavigation: () => void;

    cancelNavigation: () => void;

    shouldBlockNavigation: () => boolean;

    setPendingNavigation: (url: string | null) => void;

    pendingNavigation: string | null;
}


export function useUnsavedChangesWarning({
    isDirty,
    message = "You have unsaved changes. Are you sure you want to leave?",
    enabled = true,
}: UseUnsavedChangesWarningOptions): UseUnsavedChangesWarningReturn {
    const [showDialog, setShowDialog] = useState(false);
    const [pendingNavigation, setPendingNavigationState] = useState<string | null>(null);
    const shouldWarn = enabled && isDirty;

    useEffect(() => {
        if (!shouldWarn) return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = message;
            return message;
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [shouldWarn, message]);

    const shouldBlockNavigation = useCallback((): boolean => {
        return shouldWarn;
    }, [shouldWarn]);

    const setPendingNavigation = useCallback((url: string | null) => {
        if (url && shouldWarn) {
            setPendingNavigationState(url);
            setShowDialog(true);
        } else {
            setPendingNavigationState(url);
        }
    }, [shouldWarn]);

    const confirmNavigation = useCallback(() => {
        setShowDialog(false);
    }, []);

    const cancelNavigation = useCallback(() => {
        setShowDialog(false);
        setPendingNavigationState(null);
    }, []);

    return {
        showDialog,
        confirmNavigation,
        cancelNavigation,
        shouldBlockNavigation,
        setPendingNavigation,
        pendingNavigation,
    };
}

export default useUnsavedChangesWarning;
