"use client";

import { useEffect } from "react";

/**
 * Catches errors in the root layout. Replaces the entire document,
 * so we must define <html> and <body> and cannot rely on root layout.
 * Uses minimal inline styles so it works even if layout fails to load.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: "1.5rem",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          background: "var(--background, #fff)",
          color: "var(--foreground, #1a1a1a)",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.5rem",
            maxWidth: "24rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "3.5rem",
              height: "3.5rem",
              borderRadius: "50%",
              background: "rgba(177, 30, 29, 0.1)",
              color: "#B11E1D",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-hidden
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "1.25rem",
                fontWeight: 600,
              }}
            >
              Application error
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "0.875rem",
                color: "var(--muted-foreground, #666)",
              }}
            >
              A critical error occurred. Please try again or refresh the page.
            </p>
            {error.digest && (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.75rem",
                  color: "var(--muted-foreground, #888)",
                }}
              >
                Error ID: {error.digest}
              </p>
            )}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#fff",
                background:
                  "linear-gradient(212.36deg, oklch(0.78 0.14 75) 9.45%, oklch(0.42 0.16 265) 81%)",
                border: "none",
                borderRadius: "9999px",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/dashboard"
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "var(--foreground, #1a1a1a)",
                background: "transparent",
                border: "1px solid var(--border, #e5e5e5)",
                borderRadius: "9999px",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
