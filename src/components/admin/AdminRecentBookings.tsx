"use client";

import { useEffect, useMemo, useState } from "react";
import { labelForSlot } from "@/lib/pricing";

type Booking = {
  id: string;
  customerName: string;
  contactNumber: string;
  email: string;
  date: string;
  startHours: number[];
  grandTotal: number;
  referenceNumber: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";
  createdAt: string;
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-300",
  CONFIRMED: "bg-green-100 text-green-700 border-green-300",
  REJECTED: "bg-red-100 text-red-700 border-red-300",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-300",
};

function manilaToday(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function groupHeaderLabel(dateStr: string, today: string): string {
  const full = new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  if (dateStr === today) return `Today — ${full}`;
  if (dateStr === shiftDate(today, 1)) return `Tomorrow — ${full}`;
  if (dateStr === shiftDate(today, -1)) return `Yesterday — ${full}`;
  return full;
}

function peso(n: number): string {
  return `₱${n.toLocaleString("en-PH")}`;
}

// e.g. [17, 18] -> "5:00 PM - 7:00 PM" (start of first slot through end of
// last), rather than listing every individual hour range.
function timeRangeLabel(hours: number[]): string {
  const sorted = [...hours].sort((a, b) => a - b);
  const first = labelForSlot(sorted[0]).split(" - ")[0];
  const last = labelForSlot(sorted[sorted.length - 1]).split(" - ")[1];
  return `${first} - ${last}`;
}

export default function AdminRecentBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"upcoming" | "past" | "all">("upcoming");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/bookings", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setBookings(data.bookings || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const today = manilaToday();

  // Group by calendar date, then sort each day's bookings chronologically
  // by their earliest time slot — so "Today" always shows exactly today's
  // bookings, in the order they'll actually happen, not the order they
  // were created in.
  const groups = useMemo(() => {
    const byDate = new Map<string, Booking[]>();
    for (const b of bookings) {
      const d = b.date.slice(0, 10);
      if (range === "upcoming" && d < today) continue;
      if (range === "past" && d >= today) continue;
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(b);
    }
    const entries = Array.from(byDate.entries()).map(([date, items]) => ({
      date,
      items: [...items].sort((a, b) => Math.min(...a.startHours) - Math.min(...b.startHours)),
    }));
    // Upcoming (incl. today): soonest date first. Past: most recent first.
    entries.sort((a, b) => (range === "past" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
    return entries;
  }, [bookings, range, today]);

  return (
    <div className="rounded-court bg-white border-2 border-court-blue/20 shadow-court p-4 sm:p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="font-display font-700 text-court-ink text-base sm:text-lg">Recent bookings</h3>
        <div className="flex gap-1.5">
          {(["upcoming", "past", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`focus-ring rounded-full px-3 py-1.5 text-xs font-semibold border ${
                range === r
                  ? "bg-court-blue-dark text-white border-court-blue-dark"
                  : "bg-white text-court-ink/60 border-court-ink/15 hover:bg-court-ink/5"
              }`}
            >
              {r === "upcoming" ? "Upcoming" : r === "past" ? "Past" : "All"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-court-ink/50 py-10 text-center">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-court-ink/50 py-10 text-center">No bookings in this range.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.date}>
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <h4 className="font-display font-700 text-sm sm:text-base text-court-blue-dark">
                  {groupHeaderLabel(g.date, today)}
                </h4>
                <span className="text-xs text-court-ink/50 font-semibold shrink-0">
                  {g.items.length} booking{g.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-1.5">
                {g.items.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-court-ink/10 px-3 py-2.5"
                  >
                    <span className="text-sm font-semibold text-court-ink w-36 shrink-0">
                      {timeRangeLabel(b.startHours)}
                    </span>
                    <span className="text-sm text-court-ink truncate flex-1 min-w-[120px]">{b.customerName}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[b.status]}`}>
                      {b.status}
                    </span>
                    <span className="text-xs text-court-ink/60 shrink-0">{peso(b.grandTotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
