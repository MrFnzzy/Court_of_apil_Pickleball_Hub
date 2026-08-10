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
    <div className="rounded-court bg-gradient-to-r from-court-blue-dark to-court-ink text-white shadow-court p-4 sm:p-5 mb-6 flex items-center gap-4 sm:gap-6 flex-wrap">
      <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/15">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>

      <div>
        <p className="text-[11px] uppercase tracking-wide text-white/60 font-semibold">Total site visitors</p>
        <p className="font-display font-700 text-2xl sm:text-3xl leading-tight">
          {stats ? fmt(stats.totalVisitors) : "…"}
        </p>
      </div>

      <div className="h-8 w-px bg-white/15 hidden sm:block" />

      <div>
        <p className="text-[11px] uppercase tracking-wide text-white/60 font-semibold">Today</p>
        <p className="font-display font-600 text-lg leading-tight">{stats ? fmt(stats.todayVisitors) : "…"}</p>
      </div>

      <div className="h-8 w-px bg-white/15 hidden sm:block" />

      <div>
        <p className="text-[11px] uppercase tracking-wide text-white/60 font-semibold">Total visits</p>
        <p className="font-display font-600 text-lg leading-tight">{stats ? fmt(stats.totalVisits) : "…"}</p>
      </div>

      <p className="text-[11px] text-white/40 ml-auto basis-full sm:basis-auto">
        Counts unique browsers, once per day — refreshing the page doesn&apos;t inflate it.
      </p>
    </div>
  );
}
