"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ScheduleGrid from "./ScheduleGrid";
import DatePicker from "./DatePicker";
import ModalPortal from "./ModalPortal";
import {
  DEFAULT_PRICING,
  PricingSettings,
  RentalProduct,
  labelForSlot,
  priceForSlot,
  rentalPrice,
  ballPrice,
  rentalPackages,
  ballPackages,
} from "@/lib/pricing";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EditableBooking = {
  id: string;
  date: string;
  startHours: number[];
  customerName: string;
  contactNumber: string;
  email: string;
  paddleCount: number;
  ballCount: number;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";
  adminNote: string | null;
  isFree: boolean;
  isPaid: boolean;
};

export default function AdminManualBookingForm({
  date,
  onClose,
  onCreated,
  editBooking,
  onSaved,
}: {
  /** Date the dashboard was viewing when "Add manual booking" was pressed —
   * used as the modal's starting date, but the admin can change it inside
   * the modal without leaving the dashboard. */
  date: string;
  onClose: () => void;
  /** Fired after a successful save with the date the booking was made for,
   * so the dashboard can jump its own date filter to match. */
  onCreated: (bookingDate: string) => void;
  /** When set, the form opens in edit mode for this existing booking
   * instead of creating a new one. */
  editBooking?: EditableBooking | null;
  /** Fired after a successful edit save (edit mode only). */
  onSaved?: () => void;
}) {
  const isEditing = !!editBooking;
  const [bookingDate, setBookingDate] = useState(editBooking ? editBooking.date.slice(0, 10) : date);
  // Edit mode: a single booking row, so just its hours on `bookingDate`.
  const [hours, setHours] = useState<number[]>(editBooking ? editBooking.startHours : []);
  // Create mode: a cart of { date, hour } picks kept across date
  // navigation (mirrors the customer-facing booking flow) — so a walk-in
  // or phone-in booking can combine slots from two different dates in
  // one go without losing the first date's picks when the admin flips
  // the calendar forward to add the second date.
  const [cart, setCart] = useState<{ date: string; hour: number }[]>([]);
  const [customerName, setCustomerName] = useState(editBooking?.customerName ?? "");
  const [contactNumber, setContactNumber] = useState(editBooking?.contactNumber ?? "");
  const [email, setEmail] = useState(editBooking?.email && editBooking.email !== "walkin@heidespickleballhub.local" ? editBooking.email : "");
  const [paddleCount, setPaddleCount] = useState<number>(editBooking?.paddleCount ?? 0);
  const [ballCount, setBallCount] = useState<number>(editBooking?.ballCount ?? 0);
  const [status, setStatus] = useState<"CONFIRMED" | "PENDING" | "REJECTED" | "CANCELLED">(
    editBooking ? editBooking.status : "CONFIRMED"
  );
  const [adminNote, setAdminNote] = useState(editBooking?.adminNote ?? "");
  const [isFree, setIsFree] = useState(editBooking?.isFree ?? false);
  const [isPaid, setIsPaid] = useState(editBooking?.isPaid ?? true);
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [gridKey, setGridKey] = useState(0);

  const [pricing, setPricing] = useState<PricingSettings>(DEFAULT_PRICING);
  const [rentalProducts, setRentalProducts] = useState<RentalProduct[]>([]);
  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setPricing(d.settings);
        if (Array.isArray(d.products)) setRentalProducts(d.products);
      })
      .catch(() => {});
  }, []);

  // Edit mode only: reset the slot selection whenever the admin switches
  // dates inside the modal — an hour picked for one day shouldn't
  // silently carry to another, since an edit is always a single booking
  // row on a single date. Skipped on the very first render so opening the
  // form to edit an existing booking doesn't immediately wipe out its own
  // pre-selected hours. Create mode doesn't reset — the cart keeps every
  // date's picks (see `cart` above).
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!isEditing) return;
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setHours([]);
  }, [bookingDate, isEditing]);

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
    if (isEditing) {
      setHours((prev) => (prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour].sort((a, b) => a - b)));
      return;
    }
    setCart((prev) => {
      const alreadySelected = prev.some((c) => c.date === bookingDate && c.hour === hour);
      if (alreadySelected) return prev.filter((c) => !(c.date === bookingDate && c.hour === hour));
      return [...prev, { date: bookingDate, hour }];
    });
  }

  // Hours shown as selected on the schedule grid for whichever date is
  // currently displayed.
  const selectedHours = isEditing ? hours : cart.filter((c) => c.date === bookingDate).map((c) => c.hour);

  // Create-mode cart grouped by date, sorted chronologically — up to two
  // groups get submitted together as one linked booking.
  const groupsByDate = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const item of cart) {
      const arr = map.get(item.date) || [];
      arr.push(item.hour);
      map.set(item.date, arr);
    }
    return Array.from(map.entries())
      .map(([d, hrs]) => ({ date: d, hours: hrs.slice().sort((a, b) => a - b) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [cart]);

  const emailIsValid = EMAIL_RE.test(email.trim());

  const summary = useMemo(() => {
    if (isEditing) {
      const d = new Date(bookingDate + "T00:00:00.000Z");
      const courtTotal = hours.reduce((sum, h) => sum + priceForSlot(d, h, pricing), 0);
      const rentalTotal = rentalPrice(paddleCount, rentalProducts);
      const ballTotal = ballPrice(ballCount, rentalProducts);
      return { courtTotal, rentalTotal, ballTotal, grandTotal: courtTotal + rentalTotal + ballTotal, slotCount: hours.length };
    }
    const courtTotal = cart.reduce(
      (sum, c) => sum + priceForSlot(new Date(c.date + "T00:00:00.000Z"), c.hour, pricing),
      0
    );
    const rentalTotal = rentalPrice(paddleCount, rentalProducts);
    const ballTotal = ballPrice(ballCount, rentalProducts);
    return { courtTotal, rentalTotal, ballTotal, grandTotal: courtTotal + rentalTotal + ballTotal, slotCount: cart.length };
  }, [isEditing, bookingDate, hours, cart, paddleCount, ballCount, pricing, rentalProducts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customerName.trim()) {
      setError("Please enter a customer name.");
      return;
    }
    if (isEditing ? hours.length === 0 : cart.length === 0) {
      setError("Select at least one time slot on the schedule.");
      return;
    }
    if (!isEditing && groupsByDate.length > 2) {
      setError("A single booking can only combine slots from up to two dates.");
      return;
    }
    if (notifyCustomer && !emailIsValid) {
      setError("Enter a valid email to notify the customer, or turn that off.");
      return;
    }
    setSubmitting(true);
    try {
      const res = isEditing
        ? await fetch(`/api/admin/bookings/${editBooking!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "edit",
              customerName,
              contactNumber,
              email,
              date: bookingDate,
              hours,
              paddleCount,
              ballCount,
              status,
              adminNote: adminNote.trim() || undefined,
              isFree,
              isPaid,
            }),
          })
        : await fetch("/api/admin/bookings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerName,
              contactNumber,
              email,
              selections: groupsByDate,
              paddleCount,
              ballCount,
              status,
              adminNote: adminNote.trim() || undefined,
              notifyCustomer: notifyCustomer && emailIsValid,
              isFree,
              isPaid,
            }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEditing ? "save" : "create"} booking.`);
      if (isEditing) {
        onSaved?.();
      } else {
        setDone(true);
        onCreated(groupsByDate[0]?.date ?? bookingDate);
      }
    } catch (err: any) {
      setError(err.message);
      setGridKey((k) => k + 1); // slot may now be taken — refresh grid
    } finally {
      setSubmitting(false);
    }
  }

  // Guards against a booking that was made with a tier the admin has since
  // deactivated (or removed products entirely) — the dropdown still shows
  // its current quantity/price rather than silently losing it.
  const paddleOptions = useMemo(() => {
    const opts = rentalPackages(rentalProducts);
    if (paddleCount > 0 && !opts[paddleCount]) {
      opts[paddleCount] = { price: summary.rentalTotal, label: `${paddleCount} Paddles (no longer offered)` };
    }
    return opts;
  }, [rentalProducts, paddleCount, summary.rentalTotal]);
  const ballOptions = useMemo(() => {
    const opts = ballPackages(rentalProducts);
    if (ballCount > 0 && !opts[ballCount]) {
      opts[ballCount] = { price: summary.ballTotal, label: `${ballCount} Balls (no longer offered)` };
    }
    return opts;
  }, [rentalProducts, ballCount, summary.ballTotal]);

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close manual booking form"
        onClick={onClose}
        className="fixed inset-0 bg-court-ink/60 backdrop-blur-sm"
      />

      {/* Pinned to the top + horizontally centered via fixed positioning
          (no vh-based centering transform needed here — margin:auto between
          two 0 insets centers it). Height is left AUTO so a short form just
          takes up the space it needs instead of stretching to fill the
          screen; max-h + overflow-y-auto only kicks in — and only scrolls —
          once real content actually exceeds the available space. */}
      <div className="fixed top-3 sm:top-6 md:top-10 inset-x-3 sm:inset-x-0 sm:mx-auto w-auto sm:w-full sm:max-w-4xl max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] md:max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain rounded-court glass-panel">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-white/95 backdrop-blur border-b border-court-ink/10 px-5 sm:px-6 py-4 rounded-t-court">
          <div>
            <h3 className="font-display font-700 text-lg text-court-ink">{isEditing ? "Edit booking" : "Add manual booking"}</h3>
            <p className="text-xs text-court-ink/50">
              {isEditing ? "Update this reservation's details, schedule, or payment tags." : "Walk-in or phone-in reservation, added straight to the schedule."}
            </p>
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
            <p className="text-sm text-court-ink/60 mb-6">
              {customerName} is on the schedule for{" "}
              {isEditing || groupsByDate.length <= 1
                ? bookingDate
                : groupsByDate.map((g) => g.date).join(" and ")}
              .
            </p>
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
                <DatePicker value={bookingDate} onChange={setBookingDate} admin />
              </div>
              <div key={gridKey}>
                <ScheduleGrid
                  date={bookingDate}
                  mode="select"
                  selected={selectedHours}
                  onToggle={toggleHour}
                  autoRefresh={false}
                  admin
                  excludeBookingId={editBooking?.id}
                />
              </div>
              {selectedHours.length > 0 && (
                <p className="mt-3 text-xs font-medium text-court-ink/60">
                  Selected: {selectedHours.map((h) => labelForSlot(h)).join(", ")}
                </p>
              )}
              {!isEditing && groupsByDate.length > 1 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-court-orange-dark">
                    Combining {groupsByDate.length} dates
                  </p>
                  {groupsByDate.map((g) => (
                    <p key={g.date} className="text-xs text-court-ink/60">
                      <span className="font-medium text-court-ink/80">{g.date}:</span>{" "}
                      {g.hours.map((h) => labelForSlot(h)).join(", ")}
                    </p>
                  ))}
                </div>
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
                    onChange={(e) => setPaddleCount(Number(e.target.value))}
                    className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 focus-ring"
                  >
                    {Object.entries(paddleOptions).map(([count, r]) => (
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
                    onChange={(e) => setBallCount(Number(e.target.value))}
                    className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 focus-ring"
                  >
                    {Object.entries(ballOptions).map(([count, b]) => (
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
                <div className="flex flex-wrap gap-2">
                  {(isEditing ? (["CONFIRMED", "PENDING", "REJECTED", "CANCELLED"] as const) : (["CONFIRMED", "PENDING"] as const)).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`focus-ring flex-1 min-w-[7rem] rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                        status === s
                          ? "border-court-orange bg-court-orange/10 text-court-orange-dark"
                          : "border-court-ink/15 text-court-ink/60 hover:border-court-orange/40"
                      }`}
                    >
                      {s === "CONFIRMED" ? "Confirmed" : s === "PENDING" ? "Pending approval" : s === "REJECTED" ? "Rejected" : "Cancelled"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Free / paid tags — independent of status. A booking can be
                  CONFIRMED and still be comped (isFree) or awaiting actual
                  payment (isPaid off). Marking it free implies paid, since
                  there's nothing to collect. */}
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                    isFree ? "border-court-blue-dark/40 bg-court-blue-light/15" : "border-court-ink/10 hover:border-court-ink/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => setIsFree(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-court-ink/30 accent-court-blue-dark"
                  />
                  <span>
                    <span className="block font-medium text-court-ink/80">Free booking</span>
                    <span className="block text-xs text-court-ink/50">No charge — excluded from revenue.</span>
                  </span>
                </label>
                <label
                  className={`flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-sm transition-colors ${
                    isFree ? "border-court-ink/10 opacity-40 cursor-not-allowed" : "border-court-ink/10 cursor-pointer hover:border-court-ink/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isFree ? true : isPaid}
                    disabled={isFree}
                    onChange={(e) => setIsPaid(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-court-ink/30 accent-court-orange"
                  />
                  <span>
                    <span className="block font-medium text-court-ink/80">Payment received</span>
                    <span className="block text-xs text-court-ink/50">
                      {isFree ? "N/A for a free booking." : "Uncheck if they still owe — kept out of revenue until paid."}
                    </span>
                  </span>
                </label>
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

              {!isEditing && (
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
              )}

              {/* Order summary */}
              <div className="rounded-xl border-2 border-court-ink/10 bg-court-cream/60 px-4 py-3 text-sm">
                <p className="font-display font-600 text-court-ink mb-2">Order summary</p>
                <div className="space-y-1 text-court-ink/70">
                  <div className="flex justify-between">
                    <span>Court ({summary.slotCount} slot{summary.slotCount === 1 ? "" : "s"})</span>
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
                  {submitting ? "Saving…" : isEditing ? "Save changes" : "Add booking"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
