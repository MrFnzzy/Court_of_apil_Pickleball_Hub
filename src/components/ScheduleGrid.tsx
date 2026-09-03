"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { labelForSlot } from "@/lib/pricing";

type SlotStatus = "past" | "available" | "pending" | "booked" | "closed";

type SlotBooking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";
  customerName: string;
  contactNumber: string;
  email: string;
  startHours: number[];
  courtTotal: number;
  rentalTotal: number;
  ballCount: number;
  ballTotal: number;
  grandTotal: number;
  paddleCount: number;
  paymentMethod: string;
  referenceNumber: string;
  amountSent: number;
  adminNote: string | null;
  isDownpayment: boolean;
  downpaymentNote: string | null;
  // Present when this booking was made together with other date(s) in the
  // same checkout (see groupId on the Booking model) — every other
  // date + hours it's linked to, so the popover can flag it as a multi-day
  // booking and show where the rest of it lives. Empty/absent for an
  // ordinary single-day booking.
  linkedBookings?: { date: string; startHours: number[] }[];
};

type SlotInfo = { hour: number; status: SlotStatus; price: number; booking?: SlotBooking; isPast?: boolean };

const STATUS_STYLES: Record<SlotStatus, string> = {
  available:
    "border-court-blue-dark/40 bg-white text-court-ink hover:border-court-orange hover:shadow-court cursor-pointer",
  booked: "border-court-ink/10 bg-court-ink/10 text-court-ink/40 cursor-not-allowed",
  pending: "border-amber-300 bg-amber-50 text-amber-700 cursor-not-allowed",
  past: "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed",
  closed: "border-dashed border-court-orange-dark/40 bg-court-orange/5 text-court-orange-dark/80 cursor-not-allowed",
};

const STATUS_LABEL: Record<SlotStatus, string> = {
  available: "Available",
  booked: "Booked",
  pending: "Pending approval",
  past: "Unavailable",
  closed: "Closed by admin",
};

const ADMIN_STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-300",
  CONFIRMED: "bg-green-100 text-green-700 border-green-300",
  REJECTED: "bg-red-100 text-red-700 border-red-300",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-300",
};

export default function ScheduleGrid({
  date,
  mode = "view",
  selected = [],
  onToggle,
  autoRefresh = true,
  admin = false,
  onAvailabilityChange,
  excludeBookingId,
}: {
  date: string;
  mode?: "view" | "select";
  selected?: number[];
  onToggle?: (hour: number) => void;
  autoRefresh?: boolean;
  /** When true (admin dashboard only), fetches booking details for occupied
   * slots and lets the admin click a booked/pending slot to see who booked
   * it in a small popover, right there in the grid. */
  admin?: boolean;
  /** Fired every time a fresh grid finishes loading for `date`, reporting
   * whether at least one slot is still "available". Lets a parent (e.g. the
   * booking wizard) react when a given day turns out to be fully booked. */
  onAvailabilityChange?: (hasAvailable: boolean, date: string) => void;
  /** Admin editing an existing booking: that booking's own slots report as
   * "available" instead of booked/pending, so they stay pickable. Accepts
   * one id, or (for a multi-day booking's linked rows) several. */
  excludeBookingId?: string | string[];
}) {
  const [grid, setGrid] = useState<SlotInfo[] | null>(null);
  const [blocked, setBlocked] = useState<{ message: string } | null>(null);
  const [liveHour, setLiveHour] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [openHour, setOpenHour] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  // The popover is centered under whatever slot was tapped, but a slot in
  // the last column has nowhere to expand — left uncorrected it runs off
  // the right edge of the viewport and hangs over whatever content sits
  // below the grid. Once open, measure it and nudge it back on-screen.
  const [popoverShift, setPopoverShift] = useState(0);
  const onAvailabilityChangeRef = useRef(onAvailabilityChange);
  onAvailabilityChangeRef.current = onAvailabilityChange;
  // Purely visual: flashes a small "Updated" pulse when a background
  // refresh actually changes slot data (not on every 20s poll — only when
  // something's different), so admins can tell the grid just moved without
  // re-scanning every cell. Never affects the fetched data or its display.
  const prevGridSignatureRef = useRef<string | null>(null);
  const [refreshPulse, setRefreshPulse] = useState(0);

  const excludeParam = Array.isArray(excludeBookingId) ? excludeBookingId.filter(Boolean).join(",") : excludeBookingId || "";

  const fetchGrid = useCallback(async () => {
    try {
      const url = admin
        ? `/api/slots?date=${date}&admin=1${excludeParam ? `&excludeBookingId=${excludeParam}` : ""}`
        : `/api/slots?date=${date}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      setGrid(data.grid);
      setBlocked(data.blocked ? { message: data.blockedMessage } : null);
      if (Array.isArray(data.grid)) {
        const signature = data.grid.map((s: SlotInfo) => `${s.hour}:${s.status}:${s.booking?.id ?? ""}`).join("|");
        if (prevGridSignatureRef.current !== null && prevGridSignatureRef.current !== signature) {
          setRefreshPulse((n) => n + 1);
        }
        prevGridSignatureRef.current = signature;
      }
      // Skip the availability callback entirely when the month's blocked —
      // there's no real "day is fully booked" situation here, and letting
      // it fire with hasAvailable=false would risk a parent (e.g. the
      // booking wizard's "today's fully booked, try another day" notice)
      // layering a second, misleading message on top of the blocked-month
      // card already shown below.
      if (!data.blocked) {
        const hasAvailable: boolean = Array.isArray(data.grid) && data.grid.some((s: SlotInfo) => s.status === "available");
        onAvailabilityChangeRef.current?.(hasAvailable, date);
      }
    } catch {
      // silent fail — keep last known grid, will retry on next interval
    } finally {
      setLoading(false);
    }
  }, [date, admin, excludeParam]);

  useEffect(() => {
    setLoading(true);
    setOpenHour(null);
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

  // Close the admin popover on outside click / Escape
  useEffect(() => {
    if (openHour === null) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenHour(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenHour(null);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openHour]);

  // Keep the popover on-screen: reset, let it render at its natural
  // centered position, then measure and clamp within the viewport.
  useEffect(() => {
    setPopoverShift(0);
    if (openHour === null) return;
    const raf = requestAnimationFrame(() => {
      const el = popoverRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 12;
      let shift = 0;
      if (rect.right > window.innerWidth - margin) {
        shift = window.innerWidth - margin - rect.right;
      } else if (rect.left < margin) {
        shift = margin - rect.left;
      }
      if (shift !== 0) setPopoverShift(shift);
    });
    return () => cancelAnimationFrame(raf);
  }, [openHour]);

  // Auto-dismiss the "Updated" pulse a couple seconds after it appears.
  useEffect(() => {
    if (refreshPulse === 0) return;
    const t = setTimeout(() => setRefreshPulse(0), 2000);
    return () => clearTimeout(t);
  }, [refreshPulse]);

  if (loading && !grid) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-court-ink/5 animate-pulse" style={{ animationDelay: `${i * 40}ms` }} />
        ))}
      </div>
    );
  }

  if (!grid) return null;

  if (blocked) {
    return (
      <div className="rounded-court border-2 border-dashed border-court-orange-dark/30 bg-court-orange/5 p-8 sm:p-10 text-center">
        <span className="text-4xl block mb-3" aria-hidden>
          🔭
        </span>
        <p className="font-display font-600 text-court-ink text-base sm:text-lg max-w-sm mx-auto">{blocked.message}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs font-medium text-court-ink/70">
        <LegendDot className="bg-white border-2 border-court-blue-dark/40" label="Available" />
        <LegendDot className="bg-amber-50 border-2 border-amber-300" label="Pending approval" />
        <LegendDot className="bg-court-ink/10" label="Booked" />
        <LegendDot className="bg-gray-100" label="Past / unavailable" />
        {admin && grid.some((s) => s.status === "closed") && (
          <LegendDot className="border-2 border-dashed border-court-orange-dark/40 bg-court-orange/5" label="Closed by admin" />
        )}
        {admin && (
          <span className="ml-auto text-[11px] font-semibold text-court-blue-dark/70 italic">
            Tip: tap a booked or pending slot to see who reserved it
          </span>
        )}
      </div>

      {/* Live-refresh pulse: appears briefly whenever a background poll
          actually changes the grid, then fades — purely decorative. */}
      <AnimatePresence>
        {refreshPulse > 0 && (
          <motion.span
            key={refreshPulse}
            initial={{ opacity: 0, y: -6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.9 }}
            transition={{ duration: 0.25 }}
            className="absolute -top-1 right-0 z-10 inline-flex items-center gap-1.5 rounded-full bg-court-blue-dark text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 shadow-court"
          >
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.6, ease: "linear" }}
              className="inline-block h-2.5 w-2.5 rounded-full border-2 border-white/40 border-t-white"
            />
            Updated
          </motion.span>
        )}
      </AnimatePresence>

      <div key={date} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {grid.map((slot, i) => {
          const isSelected = selected.includes(slot.hour);
          const isLive = liveHour === slot.hour && slot.status === "booked";
          const clickable = mode === "select" && slot.status === "available";
          const isPastAdminAvailable = admin && slot.status === "available" && !!slot.isPast;
          const adminClickable = admin && (slot.status === "booked" || slot.status === "pending") && !!slot.booking;
          const isOpen = openHour === slot.hour;

          function handleClick() {
            if (clickable) {
              onToggle?.(slot.hour);
            } else if (adminClickable) {
              setOpenHour(isOpen ? null : slot.hour);
            }
          }

          return (
            <motion.div
              key={slot.hour}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.28, delay: Math.min(i, 12) * 0.02, ease: [0.22, 1, 0.36, 1] }}
              whileHover={clickable || adminClickable ? { y: -2 } : undefined}
              whileTap={clickable || adminClickable ? { scale: 0.97 } : undefined}
              className={`relative ${isOpen ? "z-40" : ""}`}
            >
              <button
                type="button"
                disabled={!clickable && !adminClickable}
                onClick={handleClick}
                title={admin && slot.status === "closed" ? "Closed by admin — reopen it from the Availability & alerts tab" : isPastAdminAvailable ? "This hour has already passed, but you can still log a manual booking into it." : undefined}
                className={`relative w-full rounded-xl border-2 px-3 py-3 text-left transition-all focus-ring ${
                  isSelected
                    ? "border-court-orange bg-court-orange/10 shadow-court ring-2 ring-court-orange/40 slot-selected-pop"
                    : isPastAdminAvailable
                    ? `${STATUS_STYLES.past.replace("cursor-not-allowed", "cursor-pointer")}`
                    : STATUS_STYLES[slot.status]
                } ${adminClickable ? "cursor-pointer hover:shadow-court hover:brightness-95" : ""} ${
                  isOpen ? "ring-2 ring-court-blue-dark/50" : ""
                }`}
              >
                {isLive && (
                  <span className="absolute -top-2 -right-2 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-court-orange opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-court-orange border-2 border-white" title="In play right now" />
                  </span>
                )}
                {isSelected && (
                  <span className="slot-check-in absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-court-orange text-white shadow-court">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
                <p className="font-display font-600 text-sm leading-tight flex items-center gap-1">
                  {labelForSlot(slot.hour)}
                  {slot.status === "closed" && (
                    <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="4" y="11" width="16" height="9" rx="2" />
                      <path d="M8 11V7a4 4 0 018 0v4" strokeLinecap="round" />
                    </svg>
                  )}
                </p>
                <p className="text-[11px] uppercase tracking-wide mt-1 opacity-80">
                  {isSelected ? "Selected" : isPastAdminAvailable ? STATUS_LABEL.past : STATUS_LABEL[slot.status]}
                </p>
                <p className="text-xs font-semibold mt-1">₱{slot.price}/hr</p>
                {adminClickable && slot.booking && (
                  <p className="text-[11px] mt-1 font-medium truncate opacity-90 flex items-center gap-1">
                    {slot.booking.customerName}
                    {!!slot.booking.linkedBookings?.length && (
                      <span
                        title="Multi-day booking"
                        className="flex-shrink-0 inline-flex items-center rounded-full bg-court-blue-dark/15 text-court-blue-dark px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      >
                        {slot.booking.linkedBookings.length + 1}-day
                      </span>
                    )}
                  </p>
                )}
              </button>

              <AnimatePresence>
                {isOpen && slot.booking && (
                  <div
                    ref={popoverRef}
                    className="admin-popover absolute z-30 top-full left-1/2 mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-court bg-white border-2 border-court-ink/10 shadow-court-lg p-4"
                    style={{ transform: `translateX(calc(-50% + ${popoverShift}px))` }}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    >
                  <span
                    className="absolute -top-1.5 left-1/2 h-3 w-3 rotate-45 bg-white border-t-2 border-l-2 border-court-ink/10"
                    style={{ transform: `translateX(calc(-50% - ${popoverShift}px))` }}
                  />
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-display font-700 text-court-ink leading-tight">{slot.booking.customerName}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 flex-shrink-0 ${ADMIN_STATUS_BADGE[slot.booking.status]}`}>
                      {slot.booking.status}
                    </span>
                  </div>
                  {!!slot.booking.linkedBookings?.length && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-court-blue-dark/10 text-court-blue-dark px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide mb-2">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="3" y="5" width="18" height="16" rx="2" />
                        <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
                      </svg>
                      Multi-day booking
                    </span>
                  )}
                  <p className="text-xs text-court-ink/60 mb-2">
                    {slot.booking.contactNumber || "—"} {slot.booking.email ? `· ${slot.booking.email}` : ""}
                  </p>
                  <div className="text-xs text-court-ink/70 space-y-1 border-t border-court-ink/10 pt-2">
                    <div className="flex justify-between">
                      <span>Hours booked</span>
                      <span className="font-medium text-right">
                        {slot.booking.startHours.slice().sort((a, b) => a - b).map((h) => labelForSlot(h)).join(", ")}
                      </span>
                    </div>
                    {!!slot.booking.linkedBookings?.length && (
                      <div>
                        <span>Also booked</span>
                        <div className="mt-0.5 space-y-0.5">
                          {slot.booking.linkedBookings.map((leg) => (
                            <div key={leg.date} className="flex justify-between font-medium text-right">
                              <span className="text-court-ink/50 font-normal">{formatShortDate(leg.date)}</span>
                              <span>{leg.startHours.slice().sort((a, b) => a - b).map((h) => labelForSlot(h)).join(", ")}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Payment</span>
                      <span className="font-medium">{slot.booking.paymentMethod} · Ref {slot.booking.referenceNumber || "—"}</span>
                    </div>
                    <div className="flex justify-between font-display font-700 text-court-ink text-sm pt-1">
                      <span>Total</span>
                      <span className="text-court-orange-dark">₱{slot.booking.grandTotal}</span>
                    </div>
                  </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
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

// "2026-08-19" -> "Aug 19" — used for the linked date in a multi-day
// booking's popover, where the year is redundant clutter (the booking is
// always shown right next to its own date, close enough in time).
function formatShortDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}
