"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { fetchApiVersion, type VersionInfo } from "@/lib/utils/version-service";

export interface VersionContextType {
  apiVersion: VersionInfo | null;
  isLoading: boolean;
  error: string | null;
  refreshVersion: () => Promise<void>;
}

interface VersionProviderProps {
  children: ReactNode;
  initialVersion?: VersionInfo | null;
}

const VersionContext = createContext<VersionContextType | undefined>(undefined);

export const VersionProvider = ({
  children,
  initialVersion = null,
}: VersionProviderProps) => {
  const [apiVersion, setApiVersion] = useState<VersionInfo | null>(
    initialVersion,
  );
  const [isLoading, setIsLoading] = useState(initialVersion == null);
  const [error, setError] = useState<string | null>(null);

  const refreshVersion = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const versionInfo = await fetchApiVersion();
      if (versionInfo) {
        setApiVersion(versionInfo);
      } else {
        setError("Failed to fetch API version");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Server seed missing (version endpoint down at SSR time) — recover
    // on the client so the value isn't permanently absent.
    if (initialVersion == null) {
      refreshVersion();
    }
  }, [initialVersion, refreshVersion]);

  return (
    <VersionContext.Provider
      value={{
        apiVersion,
        isLoading,
        error,
        refreshVersion,
      }}
    >
      {children}
    </VersionContext.Provider>
  );
};

export const useVersion = (): VersionContextType => {
  const context = useContext(VersionContext);
  if (!context) {
    throw new Error("useVersion must be used within a VersionProvider");
  }
  return context;
};
