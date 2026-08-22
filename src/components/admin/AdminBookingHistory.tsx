"use client";

import { useEffect, useMemo, useState } from "react";
import { labelForSlot } from "@/lib/pricing";
import ModalPortal from "@/components/ModalPortal";
import AdminManualBookingForm, { EditableBooking } from "@/components/AdminManualBookingForm";

type Booking = {
  id: string;
  customerName: string;
  contactNumber: string;
  email: string;
  date: string;
  startHours: number[];
  courtTotal: number;
  rentalTotal: number;
  grandTotal: number;
  paddleCount: number;
  ballCount: number;
  ballTotal: number;
  paymentMethod: string;
  referenceNumber: string;
  amountSent: number;
  proofOfPaymentUrl: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";
  adminNote: string | null;
  createdAt: string;
  groupId: string | null;
  isFree: boolean;
  isPaid: boolean;
  isDownpayment: boolean;
  downpaymentNote: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-300",
  CONFIRMED: "bg-green-100 text-green-700 border-green-300",
  REJECTED: "bg-red-100 text-red-700 border-red-300",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-300",
};

const RENTAL_LABEL: Record<number, string> = {
  0: "No rental",
  1: "1 Paddle rental",
  2: "2 Paddles rental",
};

function rentalLabel(paddleCount: number): string {
  return RENTAL_LABEL[paddleCount] ?? `${paddleCount} Paddles rental`;
}

const BALL_LABEL: Record<number, string> = {
  0: "",
  1: "1 Ball rental",
  3: "3 Balls rental",
};

function ballLabel(ballCount: number): string {
  return BALL_LABEL[ballCount] ?? (ballCount > 0 ? `${ballCount} Balls rental` : "");
}

function bookedAtLabel(createdAt: string): string {
  return new Date(createdAt).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dateLabel(dateStr: string): string {
  return new Date(dateStr.slice(0, 10) + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortDateLabel(dateStr: string): string {
  return new Date(dateStr.slice(0, 10) + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function manilaToday(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

// Shift a yyyy-mm-dd string by N days without timezone drift.
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function peso(n: number): string {
  return `₱${n.toLocaleString("en-PH")}`;
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function AdminBookingHistory() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED">("ALL");
  const [search, setSearch] = useState("");
  // A specific calendar date the admin wants to jump to — set from the
  // "Jump to date" picker below. When present, this takes over from the
  // Upcoming/Past/All toggle (which only understands relative time) so the
  // admin can look up bookings on any single day, past or future, without
  // scrolling through the whole list.
  const [dateFilter, setDateFilter] = useState("");

  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Bulk selection — lets the admin clean up a whole batch of past records
  // (e.g. everything from a stale test week) in one go instead of one at a
  // time. Only past bookings are ever selectable, same rule as single delete.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadOnce() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/bookings", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load bookings.");
        const data = await res.json();
        if (!cancelled) setBookings(Array.isArray(data?.bookings) ? data.bookings : []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadOnce();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = manilaToday();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings
      .filter((b) => {
        const bookingDate = b.date.slice(0, 10);
        if (dateFilter) {
          if (bookingDate !== dateFilter) return false;
        } else {
          if (filter === "upcoming" && bookingDate < today) return false;
          if (filter === "past" && bookingDate >= today) return false;
        }
        if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
        if (q) {
          const haystack = `${b.customerName} ${b.contactNumber} ${b.email} ${b.referenceNumber}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Upcoming: soonest first. Past: most recent first.
        if (!dateFilter && filter === "upcoming") return a.date.localeCompare(b.date);
        return b.date.localeCompare(a.date);
      });
  }, [bookings, filter, statusFilter, search, today, dateFilter]);

  const counts = useMemo(() => {
    const upcoming = bookings.filter((b) => b.date.slice(0, 10) >= today).length;
    const past = bookings.filter((b) => b.date.slice(0, 10) < today).length;
    return { upcoming, past, all: bookings.length };
  }, [bookings, today]);

  // Summary stats for whatever is currently in view — updates live as the
  // admin types a search, flips a status filter, or jumps to a date.
  const stats = useMemo(() => {
    let confirmedRevenue = 0;
    let pending = 0;
    let confirmed = 0;
    let inactive = 0;
    let freeOrUnpaid = 0;
    for (const b of filtered) {
      if (b.status === "CONFIRMED") {
        if (!b.isFree && b.isPaid) confirmedRevenue += b.grandTotal;
        else freeOrUnpaid++;
        confirmed++;
      } else if (b.status === "PENDING") {
        pending++;
      } else {
        inactive++;
      }
    }
    return { confirmedRevenue, pending, confirmed, inactive, freeOrUnpaid, total: filtered.length };
  }, [filtered]);

  // Group the (already-sorted) filtered list into consecutive same-day
  // chunks so long views can show a date header with a per-day subtotal
  // instead of one undifferentiated wall of cards.
  const groups = useMemo(() => {
    const out: { date: string; items: Booking[] }[] = [];
    for (const b of filtered) {
      const d = b.date.slice(0, 10);
      const last = out[out.length - 1];
      if (last && last.date === d) {
        last.items.push(b);
      } else {
        out.push({ date: d, items: [b] });
      }
    }
    return out;
  }, [filtered]);

  const deletingBooking = deletingId ? bookings.find((b) => b.id === deletingId) ?? null : null;

  async function confirmDelete() {
    if (!deletingId) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${deletingId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete booking.");
      }
      setBookings((prev) => prev.filter((b) => b.id !== deletingId));
      setDeletingId(null);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete booking.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectablePastIds = useMemo(
    () => filtered.filter((b) => b.date.slice(0, 10) < today).map((b) => b.id),
    [filtered, today]
  );

  function selectAllPast() {
    setSelected(new Set(selectablePastIds));
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function confirmBulkDelete() {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setBulkError(null);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) => fetch(`/api/admin/bookings/${id}`, { method: "DELETE" }).then((res) => {
        if (!res.ok) throw new Error(id);
        return id;
      }))
    );
    const succeeded = new Set<string>();
    let failCount = 0;
    for (const r of results) {
      if (r.status === "fulfilled") succeeded.add(r.value);
      else failCount++;
    }
    setBookings((prev) => prev.filter((b) => !succeeded.has(b.id)));
    setBulkBusy(false);
    setBulkDeleteOpen(false);
    if (failCount > 0) {
      setBulkError(`${failCount} record${failCount === 1 ? "" : "s"} couldn't be deleted. Try again.`);
      setSelected((prev) => {
        const next = new Set(prev);
        succeeded.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectMode(false);
      setSelected(new Set());
    }
  }

  function exportCsv() {
    const header = [
      "Customer", "Contact", "Email", "Date", "Time slots", "Status",
      "Paddle rental", "Ball rental", "Payment method", "Reference", "Total (PHP)", "Booked at",
    ];
    const rows = filtered.map((b) => [
      b.customerName,
      b.contactNumber,
      b.email,
      b.date.slice(0, 10),
      b.startHours.slice().sort((a, c) => a - c).map((h) => labelForSlot(h)).join(" / "),
      b.status,
      b.paddleCount,
      b.ballCount,
      b.paymentMethod,
      b.referenceNumber,
      b.grandTotal,
      bookedAtLabel(b.createdAt),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const suffix = dateFilter || filter;
    a.href = url;
    a.download = `booking-history-${suffix}-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="rounded-court glass-panel p-5 sm:p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display font-700 text-xl text-court-ink">Booking history</h2>
            <p className="text-sm text-court-ink/60">Every reservation ever made, searchable in one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <HistoryToggle active={!dateFilter && filter === "upcoming"} onClick={() => { setDateFilter(""); setFilter("upcoming"); }}>
              Upcoming
              <Count n={counts.upcoming} active={!dateFilter && filter === "upcoming"} />
            </HistoryToggle>
            <HistoryToggle active={!dateFilter && filter === "past"} onClick={() => { setDateFilter(""); setFilter("past"); }}>
              Past
              <Count n={counts.past} active={!dateFilter && filter === "past"} />
            </HistoryToggle>
            <HistoryToggle active={!dateFilter && filter === "all"} onClick={() => { setDateFilter(""); setFilter("all"); }}>
              All
              <Count n={counts.all} active={!dateFilter && filter === "all"} />
            </HistoryToggle>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-court-ink/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, contact, email, or reference…"
              className="input-field pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="input-field w-auto"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Jump-to-date: look up bookings on one specific calendar day,
              whether it's in the past or future — independent of the
              Upcoming/Past/All toggle above. Prev/next/Today buttons let
              the admin step through days without opening the picker. */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDateFilter(shiftDate(dateFilter || today, -1))}
              className="focus-ring inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-court-ink/10 text-court-ink/60 hover:text-court-ink hover:bg-court-ink/5"
              aria-label="Previous day"
              title="Previous day"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Jump to a specific date"
              className="input-field w-auto [color-scheme:light]"
            />
            <button
              type="button"
              onClick={() => setDateFilter(shiftDate(dateFilter || today, 1))}
              className="focus-ring inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-court-ink/10 text-court-ink/60 hover:text-court-ink hover:bg-court-ink/5"
              aria-label="Next day"
              title="Next day"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {dateFilter && dateFilter !== today && (
              <button
                type="button"
                onClick={() => setDateFilter(today)}
                className="focus-ring rounded-full border border-court-ink/10 px-3 h-9 text-xs font-semibold text-court-ink/60 hover:text-court-ink hover:bg-court-ink/5"
              >
                Today
              </button>
            )}
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter("")}
                className="focus-ring inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-court-ink/50 hover:text-court-ink hover:bg-court-ink/5"
                aria-label="Clear date filter"
                title="Clear date filter"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-court-ink/10 px-3.5 h-9 text-sm font-semibold text-court-ink/70 hover:text-court-ink hover:bg-court-ink/5 disabled:opacity-40"
              title="Export the current view as a CSV file"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export
            </button>
            {selectMode ? (
              <button
                type="button"
                onClick={exitSelectMode}
                className="focus-ring rounded-full border border-court-ink/10 px-3.5 h-9 text-sm font-semibold text-court-ink/70 hover:bg-court-ink/5"
              >
                Cancel select
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                disabled={selectablePastIds.length === 0}
                className="focus-ring rounded-full border border-court-ink/10 px-3.5 h-9 text-sm font-semibold text-court-ink/70 hover:text-court-ink hover:bg-court-ink/5 disabled:opacity-40"
                title="Select multiple past bookings to delete at once"
              >
                Select
              </button>
            )}
          </div>
        </div>

        {dateFilter && (
          <p className="mt-3 text-xs font-medium text-court-blue-dark">
            Showing bookings for {dateLabel(dateFilter)} only — {filtered.length} match{filtered.length === 1 ? "" : "es"}.
          </p>
        )}

        {/* Live summary of whatever's currently in view. */}
        {!loading && bookings.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <StatPill label="In view" value={String(stats.total)} />
            <StatPill label="Confirmed revenue" value={peso(stats.confirmedRevenue)} accent />
            <StatPill label="Pending" value={String(stats.pending)} warn={stats.pending > 0} />
            <StatPill label="Free / unpaid" value={String(stats.freeOrUnpaid)} warn={stats.freeOrUnpaid > 0} />
            <StatPill label="Rejected/cancelled" value={String(stats.inactive)} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-court bg-court-ink/5 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <svg className="mx-auto h-10 w-10 text-court-ink/20 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
          </svg>
          <p className="text-court-ink/50 italic">No bookings match this view.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const groupIsPast = group.date < today;
            const groupRevenue = group.items
              .filter((b) => b.status === "CONFIRMED" && !b.isFree && b.isPaid)
              .reduce((sum, b) => sum + b.grandTotal, 0);
            return (
              <div key={group.date}>
                <div className="flex items-center justify-between px-1 mb-2">
                  <h3 className="font-display font-700 text-sm text-court-ink/70">
                    {shortDateLabel(group.date)}
                    {group.date === today && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-court-orange-dark">Today</span>
                    )}
                  </h3>
                  <p className="text-xs text-court-ink/40">
                    {group.items.length} booking{group.items.length === 1 ? "" : "s"}
                    {groupRevenue > 0 && ` · ${peso(groupRevenue)} confirmed`}
                  </p>
                </div>
                <div className="space-y-3">
                  {group.items.map((b, i) => {
                    const isPast = b.date.slice(0, 10) < today;
                    const linkedSiblings = b.groupId
                      ? bookings.filter((other) => other.groupId === b.groupId && other.id !== b.id)
                      : [];
                    const isSelected = selected.has(b.id);
                    return (
                      <div
                        key={b.id}
                        className={`wizard-step rounded-court glass-panel p-4 sm:p-5 transition-colors ${
                          isSelected ? "ring-2 ring-court-orange/50" : ""
                        }`}
                        style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            {selectMode && (
                              <button
                                type="button"
                                onClick={() => isPast && toggleSelected(b.id)}
                                disabled={!isPast}
                                aria-label={isSelected ? "Deselect booking" : "Select booking"}
                                className={`focus-ring mt-1 flex-shrink-0 h-5 w-5 rounded-md border-2 flex items-center justify-center ${
                                  !isPast
                                    ? "border-court-ink/10 bg-court-ink/5 cursor-not-allowed"
                                    : isSelected
                                    ? "bg-court-orange border-court-orange"
                                    : "border-court-ink/25 hover:border-court-orange/50"
                                }`}
                                title={!isPast ? "Only past bookings can be selected" : undefined}
                              >
                                {isSelected && (
                                  <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </button>
                            )}
                            <div>
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="font-display font-600 text-court-ink">{b.customerName}</p>
                                <span className={`text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${STATUS_BADGE[b.status]}`}>
                                  {b.status}
                                </span>
                                {b.isFree && (
                                  <span className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-court-blue-light text-court-blue-dark border-court-blue/30">
                                    Free
                                  </span>
                                )}
                                {!b.isFree && !b.isPaid && (
                                  <span className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-amber-100 text-amber-700 border-amber-300">
                                    Unpaid
                                  </span>
                                )}
                                {b.isDownpayment && (
                                  <span
                                    className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-orange-100 text-orange-700 border-orange-300 max-w-[220px] truncate normal-case"
                                    title={b.downpaymentNote ? `Downpayment: ${b.downpaymentNote}` : "Downpayment only"}
                                  >
                                    Downpayment{b.downpaymentNote ? `: ${b.downpaymentNote}` : ""}
                                  </span>
                                )}
                                {isPast ? (
                                  <span className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-court-ink/5 text-court-ink/50 border-court-ink/10">
                                    Past
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-court-blue-light text-court-blue-dark border-court-blue/30">
                                    Upcoming
                                  </span>
                                )}
                                {linkedSiblings.length > 0 && (
                                  <span className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-court-orange/10 text-court-orange-dark border-court-orange/30">
                                    Multi-day booking
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-court-ink/60">{b.contactNumber} · {b.email}</p>
                              <p className="text-sm text-court-ink/70 mt-1">
                                {dateLabel(b.date)}
                                {" · "}
                                {b.startHours.slice().sort((a, c) => a - c).map((h) => labelForSlot(h)).join(", ")}
                              </p>
                              {linkedSiblings.length > 0 && (
                                <p className="text-xs text-court-orange-dark mt-1">
                                  Also booked{" "}
                                  {linkedSiblings
                                    .map((s) =>
                                      new Date(s.date.slice(0, 10) + "T00:00:00").toLocaleDateString("en-PH", {
                                        month: "short",
                                        day: "numeric",
                                      })
                                    )
                                    .join(", ")}{" "}
                                  as part of the same reservation — same payment covers both.
                                </p>
                              )}
                              <p className="text-sm text-court-ink/70">
                                {rentalLabel(b.paddleCount)}
                                {b.paddleCount > 0 && ` (₱${b.rentalTotal})`}
                              </p>
                              {b.ballCount > 0 && (
                                <p className="text-sm text-court-ink/70">
                                  {ballLabel(b.ballCount)} (₱{b.ballTotal})
                                </p>
                              )}
                              <p className="text-xs text-court-ink/40 mt-1">Booked {bookedAtLabel(b.createdAt)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-display font-700 text-lg text-court-orange-dark">₱{b.grandTotal}</p>
                            <p className="text-xs text-court-ink/50">
                              {b.paymentMethod} · Ref {b.referenceNumber}
                            </p>
                          </div>
                        </div>

                        {b.status === "REJECTED" && b.adminNote && (
                          <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            Reason sent to customer: {b.adminNote}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {b.proofOfPaymentUrl && (
                            <a
                              href={b.proofOfPaymentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-semibold text-court-blue-dark hover:underline focus-ring"
                            >
                              View proof of payment →
                            </a>
                          )}
                          {/* Deleting is only offered for bookings whose date has
                              already passed — it permanently removes the record
                              (unlike Reject/Cancel elsewhere, which keep it around
                              with a status). Upcoming bookings are still live
                              reservations, so they're managed from the Schedule /
                              Pending tabs instead, not deleted from here. */}
                          {!selectMode && (
                            <button
                              type="button"
                              onClick={() => setEditingBooking(b)}
                              className="focus-ring text-sm font-semibold text-court-blue-dark hover:text-court-blue-dark/80 hover:underline"
                            >
                              Edit
                            </button>
                          )}
                          {isPast && !selectMode && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError(null);
                                setDeletingId(b.id);
                              }}
                              className="focus-ring ml-auto text-sm font-semibold text-red-600 hover:text-red-700 hover:underline"
                            >
                              Delete record
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk action bar — appears once select mode is on, sticky to the
          bottom of the viewport so it's reachable no matter how far the
          admin has scrolled down the list. */}
      {selectMode && (
        <ModalPortal lockScroll={false}>
          <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-4 pointer-events-none">
            <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-full bg-court-ink text-white shadow-court-lg px-5 py-3">
              <span className="text-sm font-semibold">
                {selected.size} selected
              </span>
              <button
                type="button"
                onClick={selectAllPast}
                className="focus-ring text-sm font-semibold text-white/70 hover:text-white underline"
              >
                Select all past ({selectablePastIds.length})
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                disabled={selected.size === 0}
                className="focus-ring text-sm font-semibold text-white/70 hover:text-white underline disabled:opacity-40 disabled:no-underline"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => { setBulkError(null); setBulkDeleteOpen(true); }}
                disabled={selected.size === 0}
                className="focus-ring rounded-full bg-red-600 hover:bg-red-700 px-4 py-1.5 text-sm font-semibold disabled:opacity-40"
              >
                Delete selected
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {bulkError && (
        <ModalPortal lockScroll={false}>
          <div className="fixed bottom-20 inset-x-0 flex justify-center px-4 z-[100]">
            <p className="rounded-full bg-red-600 text-white text-sm font-semibold px-4 py-2 shadow-court-lg">{bulkError}</p>
          </div>
        </ModalPortal>
      )}

      {editingBooking && (
        <AdminManualBookingForm
          date={editingBooking.date.slice(0, 10)}
          editBooking={editingBooking as EditableBooking}
          onClose={() => setEditingBooking(null)}
          onCreated={() => {}}
          onSaved={async () => {
            setEditingBooking(null);
            const res = await fetch("/api/admin/bookings", { cache: "no-store" });
            const data = await res.json();
            setBookings(data.bookings || []);
          }}
        />
      )}

      {deletingBooking && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto overscroll-contain p-4" role="dialog" aria-modal="true">
            <button
              type="button"
              aria-label="Cancel delete"
              onClick={() => !deleteBusy && setDeletingId(null)}
              className="fixed inset-0 bg-court-ink/60 backdrop-blur-sm"
            />
            <div className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-court bg-white shadow-court-lg border-2 border-red-200 p-5 sm:p-6">
              <h3 className="font-display font-700 text-lg text-court-ink mb-1">Delete this booking record?</h3>
              <p className="text-sm text-court-ink/60 mb-4">
                {deletingBooking.customerName} · {dateLabel(deletingBooking.date)} ·{" "}
                {deletingBooking.startHours.slice().sort((a, c) => a - c).map((h) => labelForSlot(h)).join(", ")}
                <br />
                This permanently removes it from booking history. This can't be undone.
              </p>
              {deleteError && <p className="text-sm text-red-600 mb-3">{deleteError}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  disabled={deleteBusy}
                  className="focus-ring flex-1 rounded-full border-2 border-court-ink/15 text-court-ink/70 px-4 py-2 text-sm font-semibold hover:bg-court-ink/5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleteBusy}
                  className="focus-ring flex-1 rounded-full bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteBusy ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {bulkDeleteOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto overscroll-contain p-4" role="dialog" aria-modal="true">
            <button
              type="button"
              aria-label="Cancel bulk delete"
              onClick={() => !bulkBusy && setBulkDeleteOpen(false)}
              className="fixed inset-0 bg-court-ink/60 backdrop-blur-sm"
            />
            <div className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-court bg-white shadow-court-lg border-2 border-red-200 p-5 sm:p-6">
              <h3 className="font-display font-700 text-lg text-court-ink mb-1">
                Delete {selected.size} booking record{selected.size === 1 ? "" : "s"}?
              </h3>
              <p className="text-sm text-court-ink/60 mb-4">
                This permanently removes {selected.size === 1 ? "it" : "them"} from booking history. This can't be undone.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setBulkDeleteOpen(false)}
                  disabled={bulkBusy}
                  className="focus-ring flex-1 rounded-full border-2 border-court-ink/15 text-court-ink/70 px-4 py-2 text-sm font-semibold hover:bg-court-ink/5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmBulkDelete}
                  disabled={bulkBusy}
                  className="focus-ring flex-1 rounded-full bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {bulkBusy ? "Deleting…" : "Delete all"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

function HistoryToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
        active ? "bg-court-orange text-white shadow-court" : "bg-white text-court-ink/70 border border-court-ink/10 hover:border-court-orange/40"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
        active ? "bg-white/25 text-white" : "bg-court-ink/10 text-court-ink/60"
      }`}
    >
      {n}
    </span>
  );
}

function StatPill({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        warn
          ? "bg-amber-50 border-amber-200"
          : accent
          ? "bg-court-orange/5 border-court-orange/20"
          : "bg-court-ink/[0.03] border-court-ink/10"
      }`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${warn ? "text-amber-700/70" : "text-court-ink/40"}`}>
        {label}
      </p>
      <p className={`font-display font-700 text-base ${warn ? "text-amber-700" : accent ? "text-court-orange-dark" : "text-court-ink"}`}>
        {value}
      </p>
    </div>
  );
}
