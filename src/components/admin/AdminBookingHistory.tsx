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
  courtTotal: number;
  rentalTotal: number;
  grandTotal: number;
  paddleCount: number;
  paymentMethod: string;
  referenceNumber: string;
  amountSent: number;
  proofOfPaymentUrl: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";
  adminNote: string | null;
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

export default function AdminBookingHistory() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED">("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // No `date` param — returns every booking, newest first.
        const res = await fetch("/api/admin/bookings", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setBookings(data.bookings || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
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
        if (filter === "upcoming" && bookingDate < today) return false;
        if (filter === "past" && bookingDate >= today) return false;
        if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
        if (q) {
          const haystack = `${b.customerName} ${b.contactNumber} ${b.email} ${b.referenceNumber}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Upcoming: soonest first. Past: most recent first.
        if (filter === "upcoming") return a.date.localeCompare(b.date);
        return b.date.localeCompare(a.date);
      });
  }, [bookings, filter, statusFilter, search, today]);

  const counts = useMemo(() => {
    const upcoming = bookings.filter((b) => b.date.slice(0, 10) >= today).length;
    const past = bookings.filter((b) => b.date.slice(0, 10) < today).length;
    return { upcoming, past, all: bookings.length };
  }, [bookings, today]);

  return (
    <div>
      <div className="rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display font-700 text-xl text-court-ink">Booking history</h2>
            <p className="text-sm text-court-ink/60">Every reservation ever made, searchable in one place.</p>
          </div>
          <div className="flex gap-2">
            <HistoryToggle active={filter === "upcoming"} onClick={() => setFilter("upcoming")}>
              Upcoming
              <Count n={counts.upcoming} active={filter === "upcoming"} />
            </HistoryToggle>
            <HistoryToggle active={filter === "past"} onClick={() => setFilter("past")}>
              Past
              <Count n={counts.past} active={filter === "past"} />
            </HistoryToggle>
            <HistoryToggle active={filter === "all"} onClick={() => setFilter("all")}>
              All
              <Count n={counts.all} active={filter === "all"} />
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
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-court bg-court-ink/5 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-court-ink/50 italic text-center py-12">No bookings match this view.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((b, i) => {
            const isPast = b.date.slice(0, 10) < today;
            return (
              <div
                key={b.id}
                className="wizard-step rounded-court bg-white border-2 border-court-ink/10 shadow-court p-4 sm:p-5"
                style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-display font-600 text-court-ink">{b.customerName}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${STATUS_BADGE[b.status]}`}>
                        {b.status}
                      </span>
                      {isPast ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-court-ink/5 text-court-ink/50 border-court-ink/10">
                          Past
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-court-blue-light text-court-blue-dark border-court-blue/30">
                          Upcoming
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-court-ink/60">{b.contactNumber} · {b.email}</p>
                    <p className="text-sm text-court-ink/70 mt-1">
                      {new Date(b.date.slice(0, 10) + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      {" · "}
                      {b.startHours.slice().sort((a, c) => a - c).map((h) => labelForSlot(h)).join(", ")}
                    </p>
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

                {b.proofOfPaymentUrl && (
                  <a
                    href={b.proofOfPaymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-3 text-sm font-semibold text-court-blue-dark hover:underline focus-ring"
                  >
                    View proof of payment →
                  </a>
                )}
              </div>
            );
          })}
        </div>
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
