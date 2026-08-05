"use client";

import { useEffect, useMemo, useState } from "react";
import ScheduleGrid from "./ScheduleGrid";
import DatePicker from "./DatePicker";
import {
  DEFAULT_PRICING,
  PricingSettings,
  labelForSlot,
  priceForSlot,
  rentalPrice,
  ballPrice,
  rentalPackages,
  ballPackages,
} from "@/lib/pricing";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminManualBookingForm({
  date,
  onClose,
  onCreated,
}: {
  /** Date the dashboard was viewing when "Add manual booking" was pressed —
   * used as the modal's starting date, but the admin can change it inside
   * the modal without leaving the dashboard. */
  date: string;
  onClose: () => void;
  /** Fired after a successful save with the date the booking was made for,
   * so the dashboard can jump its own date filter to match. */
  onCreated: (bookingDate: string) => void;
}) {
  const [bookingDate, setBookingDate] = useState(date);
  const [hours, setHours] = useState<number[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [paddleCount, setPaddleCount] = useState<0 | 1 | 2>(0);
  const [ballCount, setBallCount] = useState<0 | 1 | 3>(0);
  const [status, setStatus] = useState<"CONFIRMED" | "PENDING">("CONFIRMED");
  const [adminNote, setAdminNote] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [gridKey, setGridKey] = useState(0);

  const [pricing, setPricing] = useState<PricingSettings>(DEFAULT_PRICING);
  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((d) => d.settings && setPricing(d.settings))
      .catch(() => {});
  }, []);

  // Reset the slot selection whenever the admin switches dates inside the
  // modal — an hour picked for one day shouldn't silently carry to another.
  useEffect(() => {
    setHours([]);
  }, [bookingDate]);

  // Lock page scroll + close on Escape while the modal is open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  function toggleHour(hour: number) {
    setHours((prev) => (prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour].sort((a, b) => a - b)));
  }

  const emailIsValid = EMAIL_RE.test(email.trim());

  const summary = useMemo(() => {
    const d = new Date(bookingDate + "T00:00:00.000Z");
    const courtTotal = hours.reduce((sum, h) => sum + priceForSlot(d, h, pricing), 0);
    const rentalTotal = rentalPrice(paddleCount, pricing);
    const ballTotal = ballPrice(ballCount, pricing);
    return { courtTotal, rentalTotal, ballTotal, grandTotal: courtTotal + rentalTotal + ballTotal };
  }, [bookingDate, hours, paddleCount, ballCount, pricing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customerName.trim()) {
      setError("Please enter a customer name.");
      return;
    }
    if (hours.length === 0) {
      setError("Select at least one time slot on the schedule.");
      return;
    }
    if (notifyCustomer && !emailIsValid) {
      setError("Enter a valid email to notify the customer, or turn that off.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          contactNumber,
          email,
          date: bookingDate,
          hours,
          paddleCount,
          ballCount,
          status,
          adminNote: adminNote.trim() || undefined,
          notifyCustomer: notifyCustomer && emailIsValid,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create booking.");
      setDone(true);
      onCreated(bookingDate);
    } catch (err: any) {
      setError(err.message);
      setGridKey((k) => k + 1); // slot may now be taken — refresh grid
    } finally {
      setSubmitting(false);
    }
  }

  const rentals = rentalPackages(pricing);
  const balls = ballPackages(pricing);

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close manual booking form"
        onClick={onClose}
        className="fixed inset-0 bg-court-ink/60 backdrop-blur-sm"
      />

      {/* Pinned directly to the viewport edges via `fixed` + `inset-*` —
          NOT centered with flex, and NOT sized with vh units. Height/width
          come purely from the top/right/bottom/left offsets below, so the
          panel always exactly fits the visible screen no matter the device
          or embedding context, and this element is itself the one and only
          scroll container for its contents. */}
      <div className="fixed inset-3 sm:inset-6 md:inset-10 lg:inset-x-[max(1rem,calc(50%-36rem))] lg:inset-y-10 overflow-y-auto overscroll-contain rounded-court bg-white shadow-court-lg border-2 border-court-orange/20">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-white/95 backdrop-blur border-b border-court-ink/10 px-5 sm:px-6 py-4 rounded-t-court">
          <div>
            <h3 className="font-display font-700 text-lg text-court-ink">Add manual booking</h3>
            <p className="text-xs text-court-ink/50">Walk-in or phone-in reservation, added straight to the schedule.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full text-court-ink/50 hover:text-court-ink hover:bg-court-ink/5"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="p-10 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 mb-4">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="font-display font-700 text-lg text-court-ink mb-1">Booking added</p>
            <p className="text-sm text-court-ink/60 mb-6">{customerName} is on the schedule for {bookingDate}.</p>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6 p-5 sm:p-6">
            {/* Left: date + slot picker */}
            <div>
              <div className="mb-3">
                <DatePicker value={bookingDate} onChange={setBookingDate} />
              </div>
              <div key={gridKey}>
                <ScheduleGrid date={bookingDate} mode="select" selected={hours} onToggle={toggleHour} autoRefresh={false} admin />
              </div>
              {hours.length > 0 && (
                <p className="mt-3 text-xs font-medium text-court-ink/60">
                  Selected: {hours.map((h) => labelForSlot(h)).join(", ")}
                </p>
              )}
            </div>

            {/* Right: customer + rentals + summary */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm col-span-2">
                  <span className="block mb-1 font-medium text-court-ink/80">Customer name</span>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 focus-ring"
                    required
                  />
                </label>
                <label className="text-sm">
                  <span className="block mb-1 font-medium text-court-ink/80">Contact number</span>
                  <input
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    inputMode="numeric"
                    className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 focus-ring"
                  />
                </label>
                <label className="text-sm">
                  <span className="block mb-1 font-medium text-court-ink/80">Email (optional)</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 focus-ring"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block mb-1 font-medium text-court-ink/80">Paddle rental</span>
                  <select
                    value={paddleCount}
                    onChange={(e) => setPaddleCount(Number(e.target.value) as 0 | 1 | 2)}
                    className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 focus-ring"
                  >
                    {Object.entries(rentals).map(([count, r]) => (
                      <option key={count} value={count}>
                        {r.label}
                        {r.price > 0 ? ` (₱${r.price})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block mb-1 font-medium text-court-ink/80">Ball rental</span>
                  <select
                    value={ballCount}
                    onChange={(e) => setBallCount(Number(e.target.value) as 0 | 1 | 3)}
                    className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 focus-ring"
                  >
                    {Object.entries(balls).map(([count, b]) => (
                      <option key={count} value={count}>
                        {b.label}
                        {b.price > 0 ? ` (₱${b.price})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <span className="block mb-1.5 text-sm font-medium text-court-ink/80">Status</span>
                <div className="flex gap-2">
                  {(["CONFIRMED", "PENDING"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`focus-ring flex-1 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                        status === s
                          ? "border-court-orange bg-court-orange/10 text-court-orange-dark"
                          : "border-court-ink/15 text-court-ink/60 hover:border-court-orange/40"
                      }`}
                    >
                      {s === "CONFIRMED" ? "Confirmed" : "Pending approval"}
                    </button>
                  ))}
                </div>
              </div>

              <label className="text-sm block">
                <span className="block mb-1 font-medium text-court-ink/80">Admin note (optional)</span>
                <input
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Manually added by admin"
                  className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 focus-ring"
                />
              </label>

              <label
                className={`flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-sm transition-colors ${
                  email.trim() ? "border-court-blue-dark/25 bg-court-blue-light/10" : "border-court-ink/10 bg-court-ink/5 opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={notifyCustomer}
                  disabled={!email.trim()}
                  onChange={(e) => setNotifyCustomer(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-court-ink/30 accent-court-orange"
                />
                <span>
                  <span className="block font-medium text-court-ink/80">Email the customer a confirmation</span>
                  <span className="block text-xs text-court-ink/50">
                    {email.trim() ? "Sent right after this booking is saved." : "Add an email above to enable this."}
                  </span>
                </span>
              </label>

              {/* Order summary */}
              <div className="rounded-xl border-2 border-court-ink/10 bg-court-cream/60 px-4 py-3 text-sm">
                <p className="font-display font-600 text-court-ink mb-2">Order summary</p>
                <div className="space-y-1 text-court-ink/70">
                  <div className="flex justify-between">
                    <span>Court ({hours.length} slot{hours.length === 1 ? "" : "s"})</span>
                    <span>₱{summary.courtTotal}</span>
                  </div>
                  {summary.rentalTotal > 0 && (
                    <div className="flex justify-between">
                      <span>Paddle rental</span>
                      <span>₱{summary.rentalTotal}</span>
                    </div>
                  )}
                  {summary.ballTotal > 0 && (
                    <div className="flex justify-between">
                      <span>Ball rental</span>
                      <span>₱{summary.ballTotal}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 mt-1 border-t border-court-ink/10 font-display font-700 text-court-ink">
                    <span>Total</span>
                    <span className="text-court-orange-dark">₱{summary.grandTotal}</span>
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="focus-ring flex-1 rounded-full border-2 border-court-ink/15 text-court-ink/70 px-6 py-2.5 font-semibold hover:bg-court-ink/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="focus-ring flex-[2] rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Add booking"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
