"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { labelForSlot } from "@/lib/pricing";
import { ACTIVE_BOOKING_REF_KEY } from "@/lib/activeBookingRef";

type Day = {
  id: string;
  date: string;
  startHours: number[];
  courtTotal: number;
  rentalTotal: number;
  ballTotal: number;
  grandTotal: number;
  paddleCount: number;
  ballCount: number;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";
  adminNote: string | null;
};

type TrackResult = {
  bookingRef: string;
  customerName: string;
  contactNumber: string;
  email: string;
  paymentMethod: string;
  amountSent: number;
  createdAt: string;
  overallStatus: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "MIXED";
  grandTotal: number;
  days: Day[];
};

const STATUS_STYLE: Record<Day["status"], string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-300",
  CONFIRMED: "bg-green-100 text-green-700 border-green-300",
  REJECTED: "bg-red-100 text-red-700 border-red-300",
  CANCELLED: "bg-court-ink/10 text-court-ink/60 border-court-ink/20",
};

const STATUS_LABEL: Record<Day["status"], string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}

export default function TrackBookingPage({ params }: { params: { ref: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [lookupInput, setLookupInput] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/track/${encodeURIComponent(params.ref)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "We couldn't find that booking.");
          // A stored "active" ref that no longer resolves (e.g. typo'd URL,
          // or the booking was somehow removed) shouldn't keep bouncing the
          // visitor back here forever — clear the lock.
          try {
            const stored = localStorage.getItem(ACTIVE_BOOKING_REF_KEY);
            if (stored && stored.toUpperCase() === params.ref.toUpperCase()) {
              localStorage.removeItem(ACTIVE_BOOKING_REF_KEY);
            }
          } catch {}
          return;
        }
        setResult(data);
        // Once every day on this booking has a final answer, this is no
        // longer the "active pending booking" holding the site locked —
        // clear it so the customer is free to browse and book again.
        if (data.overallStatus !== "PENDING") {
          try {
            const stored = localStorage.getItem(ACTIVE_BOOKING_REF_KEY);
            if (stored && stored.toUpperCase() === params.ref.toUpperCase()) {
              localStorage.removeItem(ACTIVE_BOOKING_REF_KEY);
            }
          } catch {}
        }
      })
      .catch(() => {
        if (!cancelled) setError("Something went wrong. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.ref]);

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const code = lookupInput.trim();
    if (!code) return;
    router.push(`/track/${encodeURIComponent(code.toUpperCase())}`);
  }

  return (
    <div className="min-h-screen bg-court-cream flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-12">
        {loading ? (
          <div className="rounded-court glass-panel p-8 text-center text-court-ink/60">Looking up your booking…</div>
        ) : error ? (
          <div className="rounded-court glass-panel p-8 text-center">
            <h1 className="font-display font-700 text-xl text-court-ink mb-2">Booking not found</h1>
            <p className="text-court-ink/60 mb-6">{error}</p>
            <LookupForm value={lookupInput} onChange={setLookupInput} onSubmit={handleLookup} />
          </div>
        ) : result ? (
          <>
            <StatusBanner result={result} />

            <div className="rounded-court glass-panel p-6 sm:p-8 mt-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
                <h2 className="font-display font-700 text-lg text-court-ink">Booking details</h2>
                <span className="rounded-full bg-court-ink/5 px-3 py-1 text-xs font-mono font-bold text-court-ink/70 tracking-wide">
                  {result.bookingRef}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-6">
                <div>
                  <dt className="text-court-ink/50">Name</dt>
                  <dd className="font-semibold text-court-ink">{result.customerName}</dd>
                </div>
                <div>
                  <dt className="text-court-ink/50">Contact number</dt>
                  <dd className="font-semibold text-court-ink">{result.contactNumber}</dd>
                </div>
                <div>
                  <dt className="text-court-ink/50">Submitted</dt>
                  <dd className="font-semibold text-court-ink">{formatDate(result.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-court-ink/50">Total paid</dt>
                  <dd className="font-semibold text-court-ink">₱{result.grandTotal.toLocaleString("en-PH")}</dd>
                </div>
              </dl>

              <div className="space-y-3">
                {result.days.map((day) => (
                  <div key={day.id} className="rounded-xl border-2 border-court-ink/10 p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <p className="font-semibold text-court-ink">{formatDate(day.date)}</p>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[day.status]}`}
                      >
                        {STATUS_LABEL[day.status]}
                      </span>
                    </div>
                    <p className="text-sm text-court-ink/70">
                      {[...day.startHours]
                        .sort((a, b) => a - b)
                        .map((h) => labelForSlot(h))
                        .join(", ")}
                    </p>
                    {(day.paddleCount > 0 || day.ballCount > 0) && (
                      <p className="text-xs text-court-ink/50 mt-1">
                        {day.paddleCount > 0 && `${day.paddleCount} paddle${day.paddleCount > 1 ? "s" : ""}`}
                        {day.paddleCount > 0 && day.ballCount > 0 && " · "}
                        {day.ballCount > 0 && `${day.ballCount} ball${day.ballCount > 1 ? "s" : ""}`}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-court-ink mt-2">
                      ₱{day.grandTotal.toLocaleString("en-PH")}
                    </p>
                    {day.status === "REJECTED" && day.adminNote && (
                      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                        <strong>Reason:</strong> {day.adminNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-court glass-panel p-6 mt-4">
              <h3 className="font-display font-700 text-sm text-court-ink mb-3">Look up a different booking</h3>
              <LookupForm value={lookupInput} onChange={setLookupInput} onSubmit={handleLookup} />
            </div>
          </>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}

function StatusBanner({ result }: { result: TrackResult }) {
  const { overallStatus } = result;
  const copy: Record<TrackResult["overallStatus"], { title: string; body: string; tone: string }> = {
    PENDING: {
      title: "Pending approval",
      body: "We're still verifying your proof of payment. This page updates automatically — check back soon, or watch your email for the confirmation.",
      tone: "bg-amber-50 border-amber-300 text-amber-800",
    },
    CONFIRMED: {
      title: "Booking confirmed 🏓",
      body: "You're all set — see you on the court! A confirmation email was also sent to you.",
      tone: "bg-green-50 border-green-300 text-green-800",
    },
    REJECTED: {
      title: "Booking rejected",
      body: "This booking wasn't approved. See the reason below, or reach out if you think this is a mistake.",
      tone: "bg-red-50 border-red-300 text-red-800",
    },
    CANCELLED: {
      title: "Booking cancelled",
      body: "This booking was cancelled.",
      tone: "bg-court-ink/5 border-court-ink/20 text-court-ink/70",
    },
    MIXED: {
      title: "Partially approved",
      body: "Some days on this booking were approved and others weren't — see the breakdown below for each date.",
      tone: "bg-court-blue-light/40 border-court-blue/40 text-court-blue-dark",
    },
  };
  const c = copy[overallStatus];
  return (
    <div className={`rounded-court border-2 p-6 text-center ${c.tone}`}>
      <h1 className="font-display font-700 text-2xl mb-2">{c.title}</h1>
      <p className="text-sm opacity-90">{c.body}</p>
    </div>
  );
}

function LookupForm({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. HPH-7K9X2M"
        className="focus-ring flex-1 min-w-[180px] rounded-full border-2 border-court-ink/15 px-4 py-2.5 text-sm font-mono uppercase"
      />
      <button
        type="submit"
        className="focus-ring rounded-full bg-court-orange text-white px-5 py-2.5 text-sm font-semibold hover:bg-court-orange-dark"
      >
        Find booking
      </button>
    </form>
  );
}
