"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { labelForSlot } from "@/lib/pricing";

type SlotStatus = "past" | "available" | "pending" | "booked";
type SlotInfo = { hour: number; status: SlotStatus; price: number };

const STATUS_STYLES: Record<SlotStatus, string> = {
  available:
    "border-court-blue-dark/40 bg-white text-court-ink hover:border-court-orange hover:shadow-court cursor-pointer",
  booked: "border-court-ink/10 bg-court-ink/10 text-court-ink/40 cursor-not-allowed",
  pending: "border-amber-300 bg-amber-50 text-amber-700 cursor-not-allowed",
  past: "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed",
};

const STATUS_LABEL: Record<SlotStatus, string> = {
  available: "Available",
  booked: "Booked",
  pending: "Pending approval",
  past: "Unavailable",
};

export default function ScheduleGrid({
  date,
  mode = "view",
  selected = [],
  onToggle,
  autoRefresh = true,
}: {
  date: string;
  mode?: "view" | "select";
  selected?: number[];
  onToggle?: (hour: number) => void;
  autoRefresh?: boolean;
}) {
  const [grid, setGrid] = useState<SlotInfo[] | null>(null);
  const [liveHour, setLiveHour] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchGrid = useCallback(async () => {
    try {
      const res = await fetch(`/api/slots?date=${date}`, { cache: "no-store" });
      const data = await res.json();
      setGrid(data.grid);
    } catch {
      // silent fail — keep last known grid, will retry on next interval
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);
    fetchGrid();

    // "someone is using the court right now" indicator (Manila time)
    const now = new Date();
    const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayStr = manila.toISOString().slice(0, 10);
    setLiveHour(todayStr === date ? manila.getUTCHours() : null);

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchGrid, 20000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [date, fetchGrid, autoRefresh]);

  if (loading && !grid) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-court-ink/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!grid) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs font-medium text-court-ink/70">
        <LegendDot className="bg-white border-2 border-court-blue-dark/40" label="Available" />
        <LegendDot className="bg-amber-50 border-2 border-amber-300" label="Pending approval" />
        <LegendDot className="bg-court-ink/10" label="Booked" />
        <LegendDot className="bg-gray-100" label="Past / unavailable" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {grid.map((slot) => {
          const isSelected = selected.includes(slot.hour);
          const isLive = liveHour === slot.hour && slot.status === "booked";
          const clickable = mode === "select" && slot.status === "available";

          return (
            <button
              key={slot.hour}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onToggle?.(slot.hour)}
              className={`relative rounded-xl border-2 px-3 py-3 text-left transition-all focus-ring ${
                isSelected
                  ? "border-court-orange bg-court-orange/10 shadow-court ring-2 ring-court-orange/40"
                  : STATUS_STYLES[slot.status]
              }`}
            >
              {isLive && (
                <span className="absolute -top-2 -right-2 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-court-orange opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-court-orange border-2 border-white" title="In play right now" />
                </span>
              )}
              <p className="font-display font-600 text-sm leading-tight">{labelForSlot(slot.hour)}</p>
              <p className="text-[11px] uppercase tracking-wide mt-1 opacity-80">
                {isSelected ? "Selected" : STATUS_LABEL[slot.status]}
              </p>
              <p className="text-xs font-semibold mt-1">₱{slot.price}/hr</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-full inline-block ${className}`} />
      {label}
    </span>
  );
}
