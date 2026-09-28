"use client";

import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { UnsavedChangesProvider } from "@/app/context/unsaved-changes-context";
import { useRequireSuperAdmin } from "@/lib/auth/use-auth-guard";

/**
 * why: this gate used to be the server's, deciding before a byte was ever
 * sent so no unauthorized shell could flash on screen. A static export has no
 * server left at request time (see the S3/CloudFront migration), so every
 * navigation now pays a brief client-side check instead — `loading` below is
 * that trade: nothing renders until the guard has an answer.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading } = useRequireSuperAdmin();
  if (loading) return null;

  return (
    <UnsavedChangesProvider>
      <SidebarProvider
        style={
          {
            margin: 0,
            padding: 0,
            "--sidebar-width": "calc(var(--spacing) * 58)",
            "--header-height": "calc(var(--spacing) * 14)",
            "--header-height-mobile": "calc(var(--spacing) * 26)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />

        <SidebarInset className="bg-muted">
          <Suspense fallback={null}>
            <SiteHeader />
          </Suspense>
          <div className="flex flex-1 flex-col w-full pt-[var(--header-height-mobile)] md:pt-[var(--header-height)]">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-3 px-4 lg:px-6 2xl:gap-6 2xl:px-8 w-full">
                {children}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </UnsavedChangesProvider>
  );
}
