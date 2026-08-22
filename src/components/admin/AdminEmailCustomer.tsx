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

function dateLabel(dateStr: string): string {
  return new Date(dateStr.slice(0, 10) + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function slotsLabel(hours: number[]): string {
  return [...hours].sort((a, b) => a - b).map((h) => labelForSlot(h)).join(", ");
}

function isRealEmail(email: string): boolean {
  return !!email && !email.endsWith("@heidespickleballhub.local");
}

export default function AdminEmailCustomer() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentFor, setSentFor] = useState<string | null>(null);

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
        if (q) {
          const haystack = `${b.customerName} ${b.contactNumber} ${b.email} ${b.referenceNumber}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (filter === "past" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  }, [bookings, filter, search, today]);

  const selected = useMemo(() => bookings.find((b) => b.id === selectedId) ?? null, [bookings, selectedId]);

  function selectBooking(b: Booking) {
    setSelectedId(b.id);
    setSendError(null);
    setSentFor(null);
    setSubject(`A message from Heide's Pickleball Hub`);
    setMessage("");
  }

  async function send() {
    if (!selected) return;
    if (!subject.trim() || !message.trim()) {
      setSendError("Please fill in both the subject and the message.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${selected.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error || "Failed to send email.");
        return;
      }
      setSentFor(selected.id);
      setMessage("");
    } catch {
      setSendError("Failed to send email. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4">
      {/* Booking picker */}
      <div className="rounded-court glass-panel p-4 sm:p-5">
        <h3 className="font-display font-700 text-court-ink text-base sm:text-lg mb-3">Find a booking</h3>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, contact, email, or reference #"
          className="focus-ring w-full rounded-full border border-court-ink/15 px-4 py-2 text-sm mb-3"
        />

        <div className="flex gap-1.5 mb-3">
          {(["upcoming", "past", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`focus-ring rounded-full px-3 py-1.5 text-xs font-semibold border ${
                filter === f
                  ? "bg-court-blue-dark text-white border-court-blue-dark"
                  : "bg-white text-court-ink/60 border-court-ink/15 hover:bg-court-ink/5"
              }`}
            >
              {f === "upcoming" ? "Upcoming" : f === "past" ? "Past" : "All"}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-court-ink/50 py-6 text-center">Loading bookings…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-court-ink/50 py-6 text-center">No bookings match.</p>
        ) : (
          <div className="max-h-[520px] overflow-y-auto -mx-1 px-1 space-y-1.5">
            {filtered.map((b) => (
              <button
                key={b.id}
                onClick={() => selectBooking(b)}
                className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-colors ${
                  selectedId === b.id
                    ? "border-court-orange bg-court-orange/5"
                    : "border-court-ink/10 hover:border-court-ink/20 hover:bg-court-ink/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-court-ink truncate">{b.customerName}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[b.status]}`}>
                    {b.status}
                  </span>
                </div>
                <p className="text-xs text-court-ink/60 mt-0.5">
                  {dateLabel(b.date)} · {slotsLabel(b.startHours)}
                </p>
                <p className={`text-xs mt-0.5 ${isRealEmail(b.email) ? "text-court-ink/50" : "text-red-500"}`}>
                  {isRealEmail(b.email) ? b.email : "No email on file"}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Compose panel */}
      <div className="rounded-court glass-panel p-4 sm:p-5">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-center text-sm text-court-ink/50 py-16">
            Pick a booking on the left to email its customer.
          </div>
        ) : (
          <>
            <h3 className="font-display font-700 text-court-ink text-base sm:text-lg mb-1">
              Email {selected.customerName}
            </h3>
            <p className="text-xs text-court-ink/60 mb-4">
              {isRealEmail(selected.email) ? selected.email : "No email on file"} · {dateLabel(selected.date)} ·{" "}
              {slotsLabel(selected.startHours)} · Ref {selected.referenceNumber}
            </p>

            {!isRealEmail(selected.email) ? (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                This booking doesn't have a real email address on file (likely a walk-in added manually), so a message
                can't be sent here.
              </p>
            ) : (
              <>
                <label className="block text-xs font-semibold text-court-ink/60 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="focus-ring w-full rounded-lg border border-court-ink/15 px-3 py-2 text-sm mb-3"
                />

                <label className="block text-xs font-semibold text-court-ink/60 mb-1">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={9}
                  placeholder={`Hi ${selected.customerName.split(" ")[0] || ""}, ...`}
                  className="focus-ring w-full rounded-lg border border-court-ink/15 px-3 py-2 text-sm resize-y"
                />
                <p className="text-[11px] text-court-ink/40 mt-1 mb-3">
                  Sent using the same email design as your booking confirmations, with this booking's date/time
                  included automatically below your message.
                </p>

                {sendError && <p className="text-sm text-red-600 mb-3">{sendError}</p>}
                {sentFor === selected.id && !sendError && (
                  <p className="text-sm text-green-700 mb-3">Email sent.</p>
                )}

                <button
                  onClick={send}
                  disabled={sending}
                  className="focus-ring rounded-full bg-court-orange text-white px-5 py-2.5 text-sm font-semibold hover:bg-court-orange-dark disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Send email"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
