"use client";

import {
    ThemeProvider as NextThemesProvider,
    type ThemeProviderProps,
} from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Client-side provider stack — themes (next-themes), Radix Tooltip,
 * nuqs URL-state. Data fetching uses Server Components / Server Actions
 * directly, so no React Query is needed.
 *
 * The AuthProvider lives in `app/layout.tsx` so it can hydrate from the
 * SSR-read JWT cookie.
 */
export function Providers({ children, ...props }: ThemeProviderProps) {
    return (
        <NextThemesProvider {...props}>
            <TooltipProvider delayDuration={120}>
                <NuqsAdapter>{children}</NuqsAdapter>
            </TooltipProvider>
        </NextThemesProvider>
    );
}
