import type { Metadata } from "next";
import { Caprasimo, Figtree, Geist_Mono } from "next/font/google";
import "./globals.css";
import "react-phone-input-2/lib/style.css";
import { AuthProvider } from "./context/auth-context";
import { VersionProvider } from "./context/version-context";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";
import { appSettings } from "@/lib/app-settings";

// Figtree for UI/body text, Caprasimo for display headings (the design
// system's brand pair); Geist Mono stays for code/IDs, unrelated to brand.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
});

const caprasimo = Caprasimo({
  variable: "--font-caprasimo",
  subsets: ["latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: appSettings.APP_NAME,
  description: `${appSettings.APP_NAME} platform`,
};

// why: a static export has no server at request time, so there is no
// per-request user or version to prefetch here anymore — AuthProvider and
// VersionProvider each bootstrap themselves client-side on mount instead
// (see app/context/auth-context.tsx and app/context/version-context.tsx).
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${figtree.variable} ${caprasimo.variable} ${geistMono.variable} font-sans antialiased !p-0 !m-0`}
      >
        <Providers
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <VersionProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </VersionProvider>
        </Providers>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
