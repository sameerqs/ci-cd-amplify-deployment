"use client";

import {
  createContext,
  useCallback,
  ReactNode,
  useContext,
  useRef,
  useState,
} from "react";

export type RequestLeaveTarget = string | "__back__" | "__logout__";

export interface UnsavedChangesContextValue {
  hasUnsavedChanges: boolean;
  requestLeave: (url: RequestLeaveTarget) => void;
  registerHandlers: (requestLeave: (url: RequestLeaveTarget) => void) => void;
  clearHandlers: () => void;
}

const defaultRequestLeave = () => {};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue>({
  hasUnsavedChanges: false,
  requestLeave: defaultRequestLeave,
  registerHandlers: () => {},
  clearHandlers: () => {},
});

export function useUnsavedChanges(): UnsavedChangesContextValue {
  return useContext(UnsavedChangesContext);
}

export function useUnsavedChangesOptional(): UnsavedChangesContextValue | null {
  const value = useContext(UnsavedChangesContext);
  return value;
}

interface UnsavedChangesProviderProps {
  children: ReactNode;
}

export function UnsavedChangesProvider({ children }: UnsavedChangesProviderProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const requestLeaveRef = useRef<(url: RequestLeaveTarget) => void>(defaultRequestLeave);

  const registerHandlers = useCallback((requestLeave: (url: RequestLeaveTarget) => void) => {
    requestLeaveRef.current = requestLeave;
    setHasUnsavedChanges(true);
  }, []);

  const clearHandlers = useCallback(() => {
    requestLeaveRef.current = defaultRequestLeave;
    setHasUnsavedChanges(false);
  }, []);

  const requestLeave = useCallback((url: RequestLeaveTarget) => {
    requestLeaveRef.current(url);
  }, []);

  const value: UnsavedChangesContextValue = {
    hasUnsavedChanges,
    requestLeave,
    registerHandlers,
    clearHandlers,
  };

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}
