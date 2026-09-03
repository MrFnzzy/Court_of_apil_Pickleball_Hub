"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Court360Viewer from "./Court360Viewer";
import { labelForSlot } from "@/lib/pricing";

type SlotStatus = "past" | "available" | "pending" | "booked" | "closed";
type SlotInfo = { hour: number; status: SlotStatus; price: number };

function manilaToday(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

// A handful of representative daytime/evening hours to preview here — the
// full grid lives in the "Today's schedule" section further down the page.
const PREVIEW_HOURS = [8, 10, 12, 14, 16, 18, 19, 20];

const STATUS_TAG: Record<SlotStatus, string> = {
  available: "Open",
  booked: "Booked",
  pending: "Pending",
  past: "Past",
  closed: "Closed",
};

export default function ReservationPreview({
  court360Url,
  eyebrow = "Plan your rally",
  heading = "Pick your court time",
  subtext = "Preview the court, then continue to the full reservation flow.",
}: {
  court360Url?: string | null;
  eyebrow?: string;
  heading?: string;
  subtext?: string;
}) {
  const [grid, setGrid] = useState<SlotInfo[] | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const today = manilaToday();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/slots?date=${today}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setBlocked(!!d.blocked);
        setGrid(Array.isArray(d.grid) ? d.grid : []);
        if (!cancelled && Array.isArray(d.grid)) {
          const firstAvailable = d.grid.find((s: SlotInfo) => PREVIEW_HOURS.includes(s.hour) && s.status === "available");
          setSelected(firstAvailable ? firstAvailable.hour : null);
        }
      })
      .catch(() => {
        if (!cancelled) setGrid([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const previewSlots: SlotInfo[] = grid
    ? PREVIEW_HOURS.map((h) => grid.find((s) => s.hour === h)).filter((s): s is SlotInfo => !!s)
    : [];
  const hasAnyOpen = previewSlots.some((s) => s.status === "available") || (grid ?? []).some((s) => s.status === "available");

  let statusBadge: string;
  if (grid === null) statusBadge = "Today";
  else if (blocked) statusBadge = "Today · Not taking bookings";
  else if (hasAnyOpen) statusBadge = "Today · Slots open";
  else statusBadge = "Today · Fully booked";

  return (
    <section className="reservation-preview glass-panel rounded-court p-5 sm:p-8 text-court-ink" aria-labelledby="reservation-preview-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><span className="text-xs font-bold uppercase tracking-[.2em] text-court-orange-dark">{eyebrow}</span><h2 id="reservation-preview-title" className="font-display font-700 text-2xl sm:text-3xl mt-2">{heading}</h2><p className="text-sm text-court-ink/65 mt-2">{subtext}</p></div>
        <div className="reservation-preview__date rounded-full bg-court-blue-light/60 px-3 py-2 text-xs font-bold text-court-blue-dark">{statusBadge}</div>
      </div>
      <div className="mt-7 grid lg:grid-cols-[1.05fr_.95fr] gap-7 items-center">
        <Court360Viewer src={court360Url || "/court-360.jpg"} alt="360° photo of Heide's Pickleball Hub court — drag to look around" />
        <div>
          <div className="flex items-center justify-between mb-3"><p className="text-sm font-bold">Today&apos;s slots</p><p className="text-xs text-court-ink/55">Tap to select</p></div>
          {grid === null ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2" aria-hidden>
              {PREVIEW_HOURS.map((h) => (
                <div key={h} className="h-[58px] rounded-xl bg-court-ink/5 animate-pulse" />
              ))}
            </div>
          ) : blocked ? (
            <p className="text-sm text-court-ink/55 italic py-4">We&apos;re not taking bookings for this period yet — check the full schedule below, or head to booking for the latest.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2" role="listbox" aria-label="Today's reservation slots">
              {previewSlots.map((slot) => {
                const isSelectable = slot.status === "available";
                const isSelected = selected === slot.hour;
                return (
                  <button
                    key={slot.hour}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={!isSelectable}
                    onClick={() => isSelectable && setSelected(slot.hour)}
                    className={`reservation-slot ${isSelected ? "reservation-slot--selected" : ""} ${!isSelectable ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <span>{formatHour(slot.hour)}</span>
                    <small>{STATUS_TAG[slot.status]}</small>
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-court-ink px-4 py-3 text-white">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-white/55">
                {selected !== null ? "Selected time" : "Full schedule"}
              </p>
              <p className="font-display text-xl text-court-blue-light">
                {selected !== null ? labelForSlot(selected) : "See all times"}
              </p>
            </div>
            <Link
              href={selected !== null ? `/book?date=${today}&hour=${selected}` : "/book"}
              className="fx-magnetic rounded-full bg-court-orange px-4 py-2 text-sm font-bold text-white focus-ring"
            >
              Continue
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatHour(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  let displayHour = h % 12;
  if (displayHour === 0) displayHour = 12;
  return `${displayHour}:00 ${period}`;
}
