"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import DatePicker from "@/components/DatePicker";
import ScheduleGrid from "@/components/ScheduleGrid";
import PaymentMethodPicker from "@/components/PaymentMethodPicker";
import { labelForSlot, priceForSlot, rentalPrice, RENTAL_PACKAGES } from "@/lib/pricing";

function manilaToday(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

export default function BookPage() {
  const router = useRouter();
  const [date, setDate] = useState(manilaToday());
  const [selectedHours, setSelectedHours] = useState<number[]>([]);
  const [paddleCount, setPaddleCount] = useState<0 | 1 | 2>(0);

  const [customerName, setCustomerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [amountSent, setAmountSent] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const dateObj = useMemo(() => new Date(date + "T00:00:00.000Z"), [date]);

  const courtTotal = useMemo(
    () => selectedHours.reduce((sum, h) => sum + priceForSlot(dateObj, h), 0),
    [selectedHours, dateObj]
  );
  const rentalTotal = rentalPrice(paddleCount);
  const grandTotal = courtTotal + rentalTotal;

  function toggleHour(hour: number) {
    setSelectedHours((prev) =>
      prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour].sort((a, b) => a - b)
    );
  }

  function validateClient(): string | null {
    if (selectedHours.length === 0) return "Please select at least one time slot.";
    if (!customerName.trim() || customerName.trim().length < 2) return "Please enter your full name.";
    if (!/^\d{11}$/.test(contactNumber)) return "Contact number must be exactly 11 digits.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address.";
    if (!paymentMethod) return "Please choose a payment method.";
    if (!referenceNumber.trim()) return "Reference number is required.";
    if (!/^\d+$/.test(amountSent) || Number(amountSent) <= 0) return "Amount sent must be a valid number.";
    if (!file) return "Please attach proof of payment.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload proof of payment
      const formData = new FormData();
      formData.append("file", file as File);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed.");

      // 2. Create booking
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          contactNumber,
          email,
          date,
          hours: selectedHours,
          paddleCount,
          paymentMethod,
          referenceNumber,
          amountSent: Number(amountSent),
          proofOfPaymentUrl: uploadData.url,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Booking failed.");
      }

      setSuccess(true);
      setSelectedHours([]);
      setRefreshKey((k) => k + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <>
        <SiteHeader />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-24 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-court-orange/10 flex items-center justify-center mb-6">
            <svg className="h-8 w-8 text-court-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="font-display font-700 text-2xl text-court-ink mb-3">Booking request received!</h1>
          <p className="text-court-ink/70 mb-8">
            Your slot is marked <strong>pending approval</strong> while we verify your proof of payment.
            You&apos;ll receive a confirmation email as soon as it&apos;s approved.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setSuccess(false)}
              className="focus-ring rounded-full bg-court-orange text-white px-6 py-3 font-semibold hover:bg-court-orange-dark"
            >
              Book another slot
            </button>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-display font-700 text-3xl text-court-ink mb-1">Book your court</h1>
        <p className="text-court-ink/60 mb-8">Pick a date, select your hours, and reserve your spot.</p>

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Step 1: date + slots */}
            <section className="rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6">
              <h2 className="font-display font-600 text-lg text-court-ink mb-4">1. Choose date &amp; time</h2>
              <DatePicker
                value={date}
                onChange={(d) => {
                  setDate(d);
                  setSelectedHours([]);
                }}
              />
              <div className="mt-5" key={refreshKey}>
                <ScheduleGrid date={date} mode="select" selected={selectedHours} onToggle={toggleHour} />
              </div>
            </section>

            {/* Step 2: rentals */}
            <section className="rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6">
              <h2 className="font-display font-600 text-lg text-court-ink mb-4">2. Paddle &amp; ball rental (optional)</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {([0, 1, 2] as const).map((count) => (
                  <button
                    type="button"
                    key={count}
                    onClick={() => setPaddleCount(count)}
                    className={`focus-ring rounded-xl border-2 p-4 text-left transition-all ${
                      paddleCount === count
                        ? "border-court-orange bg-court-orange/10 shadow-court"
                        : "border-court-ink/10 hover:border-court-blue-dark/40"
                    }`}
                  >
                    <p className="font-display font-600 text-court-ink">{RENTAL_PACKAGES[count].label}</p>
                    <p className="text-court-orange-dark font-semibold mt-1">
                      {count === 0 ? "Free" : `+ ₱${RENTAL_PACKAGES[count].price}`}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {/* Step 3: customer info */}
            <section className="rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6">
              <h2 className="font-display font-600 text-lg text-court-ink mb-4">3. Your details</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full name">
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="input-field"
                    placeholder="Juan Dela Cruz"
                    required
                  />
                </Field>
                <Field label="Contact number (11 digits)">
                  <input
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    className="input-field"
                    placeholder="09171234567"
                    inputMode="numeric"
                    required
                  />
                </Field>
                <Field label="Email address" full>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="you@email.com"
                    required
                  />
                  <p className="text-xs text-court-ink/50 mt-1">Your booking confirmation receipt will be sent here.</p>
                </Field>
              </div>
            </section>

            {/* Step 4: payment */}
            <section className="rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6">
              <h2 className="font-display font-600 text-lg text-court-ink mb-4">4. Payment</h2>
              <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />

              <div className="grid sm:grid-cols-2 gap-4 mt-5">
                <Field label="Reference number">
                  <input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value.replace(/\D/g, ""))}
                    className="input-field"
                    placeholder="e.g. 1234567890123"
                    inputMode="numeric"
                    required
                  />
                </Field>
                <Field label="Amount sent (₱)">
                  <input
                    value={amountSent}
                    onChange={(e) => setAmountSent(e.target.value.replace(/\D/g, ""))}
                    className="input-field"
                    placeholder={grandTotal ? String(grandTotal) : "0"}
                    inputMode="numeric"
                    required
                  />
                </Field>
                <Field label="Proof of payment (image or PDF)" full>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-court-ink/70 file:mr-4 file:rounded-full file:border-0 file:bg-court-orange file:text-white file:px-4 file:py-2 file:font-semibold file:cursor-pointer focus-ring"
                    required
                  />
                </Field>
              </div>
            </section>

            {error && (
              <div className="rounded-xl border-2 border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium">
                {error}
              </div>
            )}
          </div>

          {/* Order summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-court bg-court-ink text-white shadow-court-lg p-6">
              <h2 className="font-display font-600 text-lg mb-4">Order summary</h2>
              <p className="text-sm text-white/70 mb-1">{dateObj.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</p>

              {selectedHours.length === 0 ? (
                <p className="text-sm text-white/50 italic mt-3">No time slots selected yet.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {selectedHours.map((h) => (
                    <li key={h} className="flex justify-between">
                      <span>{labelForSlot(h)}</span>
                      <span>₱{priceForSlot(dateObj, h)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-white/15 my-4" />

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-white/80">
                  <span>Court fee</span>
                  <span>₱{courtTotal}</span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>Rental ({RENTAL_PACKAGES[paddleCount].label})</span>
                  <span>₱{rentalTotal}</span>
                </div>
              </div>

              <div className="border-t border-white/15 my-4" />

              <div className="flex justify-between items-baseline">
                <span className="font-display font-600">Total</span>
                <span className="font-display font-700 text-2xl text-court-orange-light">₱{grandTotal}</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="focus-ring mt-6 w-full rounded-full bg-court-orange py-3.5 font-semibold shadow-court hover:bg-court-orange-dark transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Confirm booking"}
              </button>
              <p className="text-[11px] text-white/50 mt-3 text-center">
                Your slot is held once payment is verified by our team.
              </p>
            </div>
          </div>
        </form>
      </main>
      <SiteFooter />

      <style jsx global>{`
        .input-field {
          width: 100%;
          border-radius: 0.75rem;
          border: 2px solid rgba(23, 58, 69, 0.12);
          padding: 0.6rem 0.9rem;
          background: white;
          color: #173a45;
        }
        .input-field:focus {
          outline: 3px solid #2fa8d9;
          outline-offset: 1px;
          border-color: #2fa8d9;
        }
      `}</style>
    </>
  );
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block text-sm ${full ? "sm:col-span-2" : ""}`}>
      <span className="block mb-1 font-medium text-court-ink/80">{label}</span>
      {children}
    </label>
  );
}
