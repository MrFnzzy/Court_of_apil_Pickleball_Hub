"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import DatePicker from "@/components/DatePicker";
import ScheduleGrid from "@/components/ScheduleGrid";
import PaymentMethodPicker from "@/components/PaymentMethodPicker";
import PaddleIcon from "@/components/icons/PaddleIcon";
import { labelForSlot, priceForSlot, rentalPrice, rentalPackages, DEFAULT_PRICING, PricingSettings } from "@/lib/pricing";

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

  const [pricing, setPricing] = useState<PricingSettings>(DEFAULT_PRICING);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setPricing(d.settings);
      })
      .catch(() => {});
  }, []);

  const dateObj = useMemo(() => new Date(date + "T00:00:00.000Z"), [date]);

  const step1Done = selectedHours.length > 0;
  const step2Done = true; // rental is optional, always considered "visited"
  const step3Done = customerName.trim().length >= 2 && /^\d{11}$/.test(contactNumber) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const step4Done = !!paymentMethod && referenceNumber.trim().length > 0 && !!file;

  const courtTotal = useMemo(
    () => selectedHours.reduce((sum, h) => sum + priceForSlot(dateObj, h, pricing), 0),
    [selectedHours, dateObj, pricing]
  );
  const rentalTotal = rentalPrice(paddleCount, pricing);
  const grandTotal = courtTotal + rentalTotal;
  const packages = rentalPackages(pricing);

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
          <div className="slot-check-in mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-court-orange to-court-orange-dark flex items-center justify-center mb-6 shadow-court-lg">
            <svg className="h-9 w-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="wizard-step font-display font-700 text-2xl text-court-ink mb-3" style={{ animationDelay: "80ms" }}>
            Booking request received!
          </h1>
          <p className="wizard-step text-court-ink/70 mb-8" style={{ animationDelay: "140ms" }}>
            Your slot is marked <strong>pending approval</strong> while we verify your proof of payment.
            You&apos;ll receive a confirmation email as soon as it&apos;s approved.
          </p>
          <div className="wizard-step flex justify-center gap-3" style={{ animationDelay: "200ms" }}>
            <button
              onClick={() => setSuccess(false)}
              className="focus-ring rounded-full bg-gradient-to-r from-court-orange to-court-orange-dark text-white px-6 py-3 font-semibold shadow-court hover:shadow-court-lg"
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
        <div className="wizard-step flex items-center gap-3 mb-1">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-court-orange to-court-orange-dark shadow-court animate-soft-float">
            <PaddleIcon className="h-5 w-5 text-white" />
          </span>
          <h1 className="font-display font-700 text-3xl text-court-ink">Book your court</h1>
        </div>
        <p className="wizard-step text-court-ink/60 mb-6" style={{ animationDelay: "40ms" }}>
          Pick a date, select your hours, and reserve your spot.
        </p>

        {/* Progress stepper */}
        <div className="wizard-step mb-8 flex items-center" style={{ animationDelay: "80ms" }}>
          <StepDot number={1} label="Date & time" done={step1Done} />
          <StepLine done={step1Done} />
          <StepDot number={2} label="Rental" done={step2Done && step1Done} />
          <StepLine done={step3Done} />
          <StepDot number={3} label="Your details" done={step3Done} />
          <StepLine done={step4Done} />
          <StepDot number={4} label="Payment" done={step4Done} last />
        </div>

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Step 1: date + slots */}
            <section className="wizard-step rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6" style={{ animationDelay: "100ms" }}>
              <SectionHeading number={1} done={step1Done}>Choose date &amp; time</SectionHeading>
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
            <section className="wizard-step rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6" style={{ animationDelay: "160ms" }}>
              <SectionHeading number={2} done={paddleCount > 0}>Paddle &amp; ball rental (optional)</SectionHeading>
              <div className="grid sm:grid-cols-2 gap-3">
                {([1, 2] as const).map((count) => {
                  const selected = paddleCount === count;
                  return (
                    <button
                      type="button"
                      key={count}
                      onClick={() => setPaddleCount(selected ? 0 : count)}
                      aria-pressed={selected}
                      className={`relative focus-ring rounded-court border-2 p-6 text-left transition-all ${
                        selected
                          ? "border-court-orange bg-court-orange/5 shadow-court-lg"
                          : "border-court-blue-dark/20 bg-white hover:border-court-blue-dark/40 hover:shadow-court"
                      }`}
                    >
                      {selected && (
                        <span className="slot-check-in absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-court-orange text-white shadow-court">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      )}
                      {count === 1 ? (
                        <PaddleIcon className={`h-8 w-8 mb-3 transition-transform ${selected ? "text-court-orange animate-bounce-ball" : "text-court-blue-dark"}`} />
                      ) : (
                        <div className="flex -space-x-2 mb-3">
                          <PaddleIcon className={`h-8 w-8 transition-transform ${selected ? "text-court-orange animate-bounce-ball" : "text-court-blue-dark"}`} />
                          <PaddleIcon
                            className={`h-8 w-8 transition-transform ${selected ? "text-court-orange-dark animate-bounce-ball" : "text-court-blue"}`}
                            style={{ animationDelay: "0.3s" }}
                          />
                        </div>
                      )}
                      <p className="font-display font-600 text-lg text-court-ink">
                        {count === 1 ? "1 Paddle" : "2 Paddles"}
                      </p>
                      <p className="text-sm text-court-ink/60 mb-2">Includes {packages[count].balls} balls</p>
                      <p className="font-display font-700 text-2xl text-court-orange">₱{packages[count].price}</p>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setPaddleCount(0)}
                className={`focus-ring mt-3 text-sm font-medium transition ${
                  paddleCount === 0 ? "text-court-orange-dark" : "text-court-ink/50 hover:text-court-ink/80"
                }`}
              >
                {paddleCount === 0 ? "✓ No rental — I have my own paddle & balls" : "I have my own paddle & balls, skip rental"}
              </button>
            </section>

            {/* Step 3: customer info */}
            <section className="wizard-step rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6" style={{ animationDelay: "220ms" }}>
              <SectionHeading number={3} done={step3Done}>Your details</SectionHeading>
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
            <section className="wizard-step rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6" style={{ animationDelay: "280ms" }}>
              <SectionHeading number={4} done={step4Done}>Payment</SectionHeading>

              {/* NOTE: adjust props here to match your actual PaymentMethodPicker signature */}
              <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />

              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <Field label="Reference number">
                  <input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="input-field"
                    placeholder="e.g. 1234567890"
                    required
                  />
                </Field>
                <Field label="Amount sent (₱)">
                  <input
                    value={amountSent}
                    onChange={(e) => setAmountSent(e.target.value.replace(/\D/g, ""))}
                    className="input-field"
                    placeholder={String(grandTotal)}
                    inputMode="numeric"
                    required
                  />
                </Field>
                <Field label="Proof of payment (screenshot)" full>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="input-field"
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

          {/* Sidebar: summary */}
          <div className="lg:col-span-1">
            <div className="wizard-step sticky top-6 rounded-court bg-white border-2 border-court-blue/20 shadow-court-lg p-5 sm:p-6 overflow-hidden" style={{ animationDelay: "140ms" }}>
              <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-court-orange/5" />
              <h2 className="font-display font-600 text-lg text-court-ink mb-4 relative">Summary</h2>

              {selectedHours.length === 0 ? (
                <p className="text-sm text-court-ink/50 italic">No time slots selected yet.</p>
              ) : (
                <ul className="text-sm text-court-ink/70 space-y-1 mb-4">
                  {selectedHours.map((h, i) => (
                    <li
                      key={h}
                      className="wizard-step flex justify-between"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <span>{labelForSlot(h)}</span>
                      <span>₱{priceForSlot(dateObj, h, pricing)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-court-ink/10 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-court-ink/70">
                  <span>Court total</span>
                  <span>₱{courtTotal}</span>
                </div>
                <div className="flex justify-between text-court-ink/70">
                  <span>Rental</span>
                  <span>₱{rentalTotal}</span>
                </div>
                <div className="flex justify-between items-baseline font-display font-700 text-court-ink text-base pt-2">
                  <span>Total</span>
                  <span key={grandTotal} className="total-pulse text-xl text-court-orange">₱{grandTotal}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="focus-ring w-full mt-5 rounded-full bg-gradient-to-r from-court-orange to-court-orange-dark text-white px-6 py-3.5 font-semibold shadow-court hover:shadow-court-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  "Reserve my spot"
                )}
              </button>
              <p className="text-[11px] text-court-ink/40 text-center mt-3">
                You&apos;ll get a confirmation email once your payment is verified.
              </p>
            </div>
          </div>
        </form>
      </main>
      <SiteFooter />
    </>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-sm font-medium text-court-ink/70 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function SectionHeading({ number, done, children }: { number: number; done: boolean; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 font-display font-600 text-lg text-court-ink mb-4">
      <span
        className={`step-badge inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          done ? "bg-green-500 text-white" : "bg-court-orange text-white"
        }`}
      >
        {done ? (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          number
        )}
      </span>
      {children}
    </h2>
  );
}

function StepDot({ number, label, done, last }: { number: number; label: string; done: boolean; last?: boolean }) {
  return (
    <div className={`flex items-center ${last ? "" : "flex-1"}`}>
      <div className="flex flex-col items-center gap-1.5">
        <span
          className={`step-badge inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 ${
            done
              ? "bg-court-orange border-court-orange text-white shadow-court"
              : "bg-white border-court-ink/15 text-court-ink/40"
          }`}
        >
          {done ? (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            number
          )}
        </span>
        <span className={`hidden sm:block text-[11px] font-semibold whitespace-nowrap ${done ? "text-court-ink" : "text-court-ink/40"}`}>
          {label}
        </span>
      </div>
    </div>
  );
}

function StepLine({ done }: { done: boolean }) {
  return (
    <div className="flex-1 h-0.5 mx-1.5 -mt-5 sm:-mt-6 rounded-full overflow-hidden bg-court-ink/10">
      <div
        className={`h-full bg-court-orange transition-all duration-500 ease-out ${done ? "w-full" : "w-0"}`}
      />
    </div>
  );
}
