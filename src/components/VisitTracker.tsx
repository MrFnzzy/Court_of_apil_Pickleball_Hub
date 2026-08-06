"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Fires a best-effort "someone loaded a public page" ping. Skips /admin
// entirely so the venue owner browsing their own dashboard never counts as
// a site visitor. The actual dedup (one row per visitor per day) happens
// server-side in /api/track-visit, so calling this on every route change is
// harmless — it just won't write anything extra once today's visit for
// this visitor is already logged.
export default function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;
    fetch("/api/track-visit", { method: "POST" }).catch(() => {
      // Analytics is best-effort — never surface this to the visitor.
    });
  }, [pathname]);

  return null;
}
