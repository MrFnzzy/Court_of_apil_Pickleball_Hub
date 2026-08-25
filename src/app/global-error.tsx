"use client";

import { useEffect } from "react";

// Catches errors thrown in the root layout itself — a case app/error.tsx
// can't cover, since that file lives *inside* the layout it would need to
// replace. Kept deliberately minimal (no imported components, no Tailwind
// dependency on the broken layout) since this is the last line of defense.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fdf9f0", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#173A45", marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: "#173A45aa", marginBottom: 20, lineHeight: 1.6 }}>
              The page hit a snag loading. Give it another try, or head back to the homepage.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={reset}
                style={{
                  borderRadius: 999,
                  background: "#F46036",
                  color: "#fff",
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  borderRadius: 999,
                  background: "#173A4511",
                  color: "#173A45",
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Go to homepage
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
