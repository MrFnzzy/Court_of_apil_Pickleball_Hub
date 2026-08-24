"use client";

import { useEffect, useState } from "react";

type Stats = { totalVisitors: number; totalVisits: number; todayVisitors: number };

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export default function AdminVisitorStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/stats/visitors", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        // Best-effort — leave the last known numbers on screen.
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="rounded-court bg-gradient-to-r from-court-blue-dark to-court-ink text-white shadow-court px-4 py-2.5 mb-4 flex items-center gap-4 flex-wrap">
      <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/15">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>

      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-white/60 font-semibold">Visitors</span>
        <span className="font-display font-700 text-lg leading-none">{stats ? fmt(stats.totalVisitors) : "…"}</span>
      </div>

      <div className="h-5 w-px bg-white/15" />

      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-white/60 font-semibold">Today</span>
        <span className="font-display font-600 text-sm leading-none">{stats ? fmt(stats.todayVisitors) : "…"}</span>
      </div>

      <div className="h-5 w-px bg-white/15" />

      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-white/60 font-semibold">Total visits</span>
        <span className="font-display font-600 text-sm leading-none">{stats ? fmt(stats.totalVisits) : "…"}</span>
      </div>
    </div>
  );
}
