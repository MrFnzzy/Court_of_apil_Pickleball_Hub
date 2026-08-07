"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import DatePicker from "@/components/DatePicker";
import ScheduleGrid from "@/components/ScheduleGrid";
import PaymentMethodPicker from "@/components/PaymentMethodPicker";
import PaddleIcon from "@/components/icons/PaddleIcon";
import BallIcon from "@/components/icons/BallIcon";
import InstallAppButton from "@/components/InstallAppButton";
import ModalPortal from "@/components/ModalPortal";
import PromoSuccessAnimation from "@/components/PromoSuccessAnimation";
import { rectOf, Rect } from "@/lib/promoFxTiming";
import { labelForSlot, priceForSlot, rentalPrice, rentalPackages, ballPrice, ballPackages, DEFAULT_PRICING, PricingSettings } from "@/lib/pricing";

function manilaToday(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

type CartItem = { date: string; hour: number };

export default function BookPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [date, setDate] = useState(manilaToday());
  // Cart of { date, hour } picks. Kept across date navigation so a single
  // booking can combine slots from "today" and "tomorrow" (e.g. 11PM-12AM
  // today + 12AM-1AM tomorrow) without losing the first pick when the
  // calendar moves forward a day.
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paddleCount, setPaddleCount] = useState<0 | 1 | 2>(0);
  const [ballCount, setBallCount] = useState<0 | 1 | 3>(0);
  const [todayFullNotice, setTodayFullNotice] = useState(false);
  const [fullNoticeCountdown, setFullNoticeCountdown] = useState<number | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [amountSent, setAmountSent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [noRefundAck, setNoRefundAck] = useState(false);

  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percentage: number; discountAmount: number } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Promo success animation: refs mark where the orb spawns (the promo box)
  // and where the slash/reveal plays out (the "Total to pay" value). fxPlay
  // holds the before/after totals for one run; while it's set, repeated
  // Apply clicks are ignored so the animation never overlaps itself.
  const promoBoxRef = useRef<HTMLDivElement>(null);
  const totalValueRef = useRef<HTMLSpanElement>(null);
  const [fxPlay, setFxPlay] = useState<{ sourceRect: Rect; oldTotalText: string; newTotalText: string; percentage: number } | null>(null);

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

  const today = useMemo(() => manilaToday(), []);
  const tomorrow = useMemo(() => addDays(today, 1), [today]);

  // Drives the "today's courts are full" popup's 5-second auto-redirect.
  // Starts counting down whenever the popup opens; cancelRedirect() (the
  // X / "Stay on today" action) clears todayFullNotice, which this effect
  // sees and stops counting — so nothing navigates once the user cancels.
  useEffect(() => {
    if (!todayFullNotice) {
      setFullNoticeCountdown(null);
      return;
    }
    setFullNoticeCountdown(5);
    const interval = setInterval(() => {
      setFullNoticeCountdown((prev) => (prev === null ? null : Math.max(prev - 1, 0)));
    }, 1000);
    return () => clearInterval(interval);
  }, [todayFullNotice]);

  useEffect(() => {
    if (fullNoticeCountdown !== 0) return;
    setDate((current) => (current === today ? tomorrow : current));
    setTodayFullNotice(false);
  }, [fullNoticeCountdown, today, tomorrow]);

  function cancelFullNoticeRedirect() {
    setTodayFullNotice(false);
  }

  // Hours currently selected for whichever date the schedule grid is showing.
  const selectedHours = useMemo(
    () => cart.filter((c) => c.date === date).map((c) => c.hour),
    [cart, date]
  );

  // Cart grouped by date, sorted chronologically — this is what actually
  // gets submitted (one Booking row per date, created together).
  const groupsByDate = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const item of cart) {
      const arr = map.get(item.date) || [];
      arr.push(item.hour);
      map.set(item.date, arr);
    }
    return Array.from(map.entries())
      .map(([d, hours]) => ({ date: d, hours: hours.slice().sort((a, b) => a - b) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [cart]);

  const step1Done = cart.length > 0;
  const step2Done = true; // rental is optional, always considered "visited"
  const step3Done = customerName.trim().length >= 2 && /^\d{11}$/.test(contactNumber) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const step4Done = true; // promo code is optional — the review step is always considered "visited"
  const step5Done = !!paymentMethod && referenceNumber.trim().length > 0 && !!file && noRefundAck;

  function stepAccessible(n: number): boolean {
    if (n <= 1) return true;
    if (n === 2) return step1Done;
    if (n === 3) return step1Done && step2Done;
    if (n === 4) return step1Done && step2Done && step3Done;
    if (n === 5) return step1Done && step2Done && step3Done && step4Done;
    return false;
  }

  function goToStep(n: 1 | 2 | 3 | 4 | 5) {
    if (!stepAccessible(n)) return;
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function canContinueFrom(n: number): boolean {
    if (n === 1) return step1Done;
    if (n === 2) return true;
    if (n === 3) return step3Done;
    if (n === 4) return true;
    return true;
  }

  function handleNext() {
    if (!canContinueFrom(step)) return;
    setStep((s) => (Math.min(5, s + 1) as 1 | 2 | 3 | 4 | 5));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setStep((s) => (Math.max(1, s - 1) as 1 | 2 | 3 | 4 | 5));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const courtTotal = useMemo(
    () =>
      cart.reduce(
        (sum, c) => sum + priceForSlot(new Date(c.date + "T00:00:00.000Z"), c.hour, pricing),
        0
      ),
    [cart, pricing]
  );
  const rentalTotal = rentalPrice(paddleCount, pricing);
  const ballTotal = ballPrice(ballCount, pricing);
  const subtotal = courtTotal + rentalTotal + ballTotal;
  const discountAmount = appliedPromo?.discountAmount ?? 0;
  const grandTotal = subtotal - discountAmount;
  const packages = rentalPackages(pricing);
  const balls = ballPackages(pricing);

  async function applyPromo() {
    const raw = promoCodeInput.trim();
    if (!raw) return;
    setPromoChecking(true);
    setPromoError(null);
    setAppliedPromo(null);
    try {
      const res = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: raw, subtotal, email }),
      });
      const data = await res.json();
      if (!data.valid) {
        setPromoError(data.error || "Invalid promo code.");
      } else {
        // Capture the promo box's position *before* this state update —
        // it's about to re-render into the green "applied" box, and the
        // orb should spawn from wherever the Apply button currently sits.
        const sourceRect = promoBoxRef.current ? rectOf(promoBoxRef.current) : null;
        const oldTotalText = `₱${grandTotal}`;
        const newTotalText = `₱${subtotal - data.discountAmount}`;
        setAppliedPromo({ code: data.code, percentage: data.percentage, discountAmount: data.discountAmount });
        setPromoCodeInput(data.code);
        // Only start the animation if one isn't already mid-flight — a
        // repeat Apply click (or a second code applied quickly) never
        // queues or overlaps a second run, per the animation spec.
        if (!fxPlay && sourceRect) {
          setFxPlay({ sourceRect, oldTotalText, newTotalText, percentage: data.percentage });
        }
      }
    } catch {
      setPromoError("Could not check promo code. Please try again.");
    } finally {
      setPromoChecking(false);
    }
  }

  function removePromo() {
    setAppliedPromo(null);
    setPromoCodeInput("");
    setPromoError(null);
  }

  // Toggling a slot never drops picks made on other dates — the cart keeps
  // every selection across every date the user has visited, so hopping
  // between the calendar's days to build a multi-day booking doesn't reset
  // anything. Only the hour being toggled (for the currently viewed date)
  // is added or removed.
  function toggleHour(hour: number) {
    setAppliedPromo(null);
    setPromoError(null);
    setCart((prev) => {
      const alreadySelected = prev.some((c) => c.date === date && c.hour === hour);
      if (alreadySelected) {
        return prev.filter((c) => !(c.date === date && c.hour === hour));
      }
      return [...prev, { date, hour }];
    });
  }

  function validateClient(): string | null {
    if (cart.length === 0) return "Please select at least one time slot.";
    if (!customerName.trim() || customerName.trim().length < 2) return "Please enter your full name.";
    if (!/^\d{11}$/.test(contactNumber)) return "Contact number must be exactly 11 digits.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address.";
    if (!paymentMethod) return "Please choose a payment method.";
    if (!referenceNumber.trim()) return "Reference number is required.";
    if (!/^\d+$/.test(amountSent) || Number(amountSent) <= 0) return "Amount sent must be a valid number.";
    if (!file) return "Please attach proof of payment.";
    if (!noRefundAck) return "Please confirm you understand the no-refund policy.";
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
          selections: groupsByDate,
          paddleCount,
          ballCount,
          paymentMethod,
          referenceNumber,
          amountSent: Number(amountSent),
          proofOfPaymentUrl: uploadData.url,
          promoCode: appliedPromo?.code ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Booking failed.");
      }

      setSuccess(true);
      setCart([]);
      // Reset the payment-step fields so a fresh booking doesn't start out
      // pre-filled with (and re-submit) the previous booking's payment proof.
      setPaymentMethod(null);
      setReferenceNumber("");
      setAmountSent("");
      setFile(null);
      setNoRefundAck(false);
      setPromoCodeInput("");
      setAppliedPromo(null);
      setPromoError(null);
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
              onClick={() => {
                setSuccess(false);
                // Send them back to step 1 (date & time) for the new
                // booking instead of leaving them on step 4 (payment),
                // which is where `step` was left after the last submit.
                setStep(1);
              }}
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

        <InstallAppButton swScope="/book" appName="Book Court" />

        {/* Progress stepper */}
        <div className="wizard-step mb-8 flex items-center" style={{ animationDelay: "80ms" }}>
          <StepDot number={1} label="Date & time" done={step1Done} current={step === 1} onClick={() => goToStep(1)} />
          <StepLine done={step >= 2} />
          <StepDot number={2} label="Rental" done={step2Done && step1Done} current={step === 2} onClick={() => goToStep(2)} disabled={!stepAccessible(2)} />
          <StepLine done={step >= 3} />
          <StepDot number={3} label="Your details" done={step3Done} current={step === 3} onClick={() => goToStep(3)} disabled={!stepAccessible(3)} />
          <StepLine done={step >= 4} />
          <StepDot number={4} label="Review" done={step4Done && step >= 4} current={step === 4} onClick={() => goToStep(4)} disabled={!stepAccessible(4)} />
          <StepLine done={step >= 5} />
          <StepDot number={5} label="Payment" done={step5Done} current={step === 5} onClick={() => goToStep(5)} disabled={!stepAccessible(5)} last />
        </div>

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: date + slots */}
            {step === 1 && (
            <section key="step1" className="wizard-step rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6">
              <SectionHeading number={1} done={step1Done}>Choose date &amp; time</SectionHeading>
              <p className="text-xs text-court-ink/50 -mt-2 mb-4">
                Tip: you can pick hours on different days and reserve them all together in one booking —
                switching dates on the calendar keeps your earlier picks.
              </p>

              {todayFullNotice && (
                <ModalPortal>
                <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto overscroll-contain bg-black/40 p-4" role="dialog" aria-modal="true">
                  <div className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-court bg-white border-2 border-court-blue/20 shadow-court-lg p-6 text-center">
                    <button
                      type="button"
                      onClick={cancelFullNoticeRedirect}
                      className="focus-ring absolute top-3 right-3 text-court-ink/40 hover:text-court-ink/70"
                      aria-label="Close and cancel redirect"
                    >
                      ✕
                    </button>
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-court-blue-light/40 text-court-blue-dark">
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
                      </svg>
                    </div>
                    <p className="font-display font-600 text-court-ink mb-1">Today&apos;s courts are full</p>
                    <p className="text-sm text-court-ink/60 mb-5">
                      Plan your next game by booking a slot tomorrow. Taking you there in{" "}
                      <span className="font-semibold text-court-ink">{fullNoticeCountdown}s</span> — or choose below.
                    </p>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={cancelFullNoticeRedirect}
                        className="focus-ring rounded-full bg-white text-court-ink/70 border border-court-ink/15 px-4 py-2 text-sm font-semibold hover:bg-court-ink/5"
                      >
                        Stay on today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDate(tomorrow);
                          setTodayFullNotice(false);
                        }}
                        className="focus-ring rounded-full bg-court-orange text-white px-4 py-2 text-sm font-semibold hover:bg-court-orange-dark"
                      >
                        Go to tomorrow
                      </button>
                    </div>
                  </div>
                </div>
                </ModalPortal>
              )}

              <DatePicker
                value={date}
                onChange={(d) => {
                  setDate(d);
                  if (d !== today) setTodayFullNotice(false);
                }}
              />
              <div className="mt-5" key={refreshKey}>
                <ScheduleGrid
                  date={date}
                  mode="select"
                  selected={selectedHours}
                  onToggle={toggleHour}
                  onAvailabilityChange={(hasAvailable, gridDate) => {
                    if (gridDate === today && !hasAvailable) {
                      setTodayFullNotice(true);
                    }
                  }}
                />
              </div>
            </section>
            )}

            {/* Step 2: rentals */}
            {step === 2 && (
            <section key="step2" className="wizard-step rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6">
              <SectionHeading number={2} done={paddleCount > 0 || ballCount > 0}>Paddle &amp; ball rental (optional)</SectionHeading>
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
                {paddleCount === 0 ? "✓ No rental — I have my own paddle" : "I have my own paddle, skip rental"}
              </button>

              <div className="mt-8 pt-6 border-t border-court-ink/10">
                <p className="font-display font-600 text-court-ink mb-3">Ball (optional)</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {([1, 3] as const).map((count) => {
                    const selected = ballCount === count;
                    return (
                      <button
                        type="button"
                        key={count}
                        onClick={() => setBallCount(selected ? 0 : count)}
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
                        <div className={`flex ${count === 3 ? "-space-x-2" : ""} mb-3`}>
                          <BallIcon className={`h-8 w-8 transition-transform ${selected ? "text-court-orange animate-bounce-ball" : "text-court-blue-dark"}`} />
                          {count === 3 && (
                            <>
                              <BallIcon
                                className={`h-8 w-8 transition-transform ${selected ? "text-court-orange-dark animate-bounce-ball" : "text-court-blue"}`}
                                style={{ animationDelay: "0.2s" }}
                              />
                              <BallIcon
                                className={`h-8 w-8 transition-transform ${selected ? "text-court-orange animate-bounce-ball" : "text-court-blue-dark"}`}
                                style={{ animationDelay: "0.4s" }}
                              />
                            </>
                          )}
                        </div>
                        <p className="font-display font-600 text-lg text-court-ink">{count === 1 ? "1 Ball" : "3 Balls"}</p>
                        <p className="font-display font-700 text-2xl text-court-orange">₱{balls[count].price}</p>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setBallCount(0)}
                  className={`focus-ring mt-3 text-sm font-medium transition ${
                    ballCount === 0 ? "text-court-orange-dark" : "text-court-ink/50 hover:text-court-ink/80"
                  }`}
                >
                  {ballCount === 0 ? "✓ No ball rental — I have my own balls" : "I have my own balls, skip"}
                </button>
              </div>
            </section>
            )}

            {/* Step 3: customer info */}
            {step === 3 && (
            <section key="step3" className="wizard-step rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6">
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
                  {customerName.length > 0 && customerName.trim().length < 2 && (
                    <p className="text-xs text-red-600 mt-1">Please enter your full name.</p>
                  )}
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
                  {contactNumber.length > 0 && contactNumber.length !== 11 && (
                    <p className="text-xs text-red-600 mt-1">
                      {contactNumber.length}/11 digits — must be exactly 11 digits (e.g. 09171234567).
                    </p>
                  )}
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
                  {email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? (
                    <p className="text-xs text-red-600 mt-1">Please enter a valid email address.</p>
                  ) : (
                    <p className="text-xs text-court-ink/50 mt-1">Your booking confirmation receipt will be sent here.</p>
                  )}
                </Field>
              </div>
            </section>
            )}

            {/* Step 4: promo code + finalize total */}
            {step === 4 && (
            <section key="step4" className="wizard-step rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6">
              <SectionHeading number={4} done={step4Done}>Review your total</SectionHeading>
              <p className="text-xs text-court-ink/50 -mt-2 mb-4">
                Got a promo code? Apply it here — your total gets locked in before you move on to payment.
              </p>

              {/* Promo code */}
              <div
                ref={promoBoxRef}
                className={`rounded-xl border-2 p-4 transition-shadow ${
                  appliedPromo ? "border-court-blue/20 bg-court-blue-light/10" : "border-court-blue/20 bg-court-blue-light/10 energy-glow-border"
                }`}
              >
                <p className="text-sm font-semibold text-court-ink mb-2">Have a promo code?</p>
                {appliedPromo ? (
                  <div className="flex items-center gap-3">
                    <div className="energy-badge flex-1 flex items-center gap-2 rounded-xl px-3 py-2">
                      <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="font-mono font-bold text-sm tracking-wide">{appliedPromo.code}</span>
                      <span className="text-xs font-medium opacity-90">({appliedPromo.percentage}% off — saving ₱{appliedPromo.discountAmount})</span>
                    </div>
                    <button
                      type="button"
                      onClick={removePromo}
                      className="text-xs font-semibold text-court-ink/50 hover:underline focus-ring"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={promoCodeInput}
                      onChange={(e) => { setPromoCodeInput(e.target.value.toUpperCase()); setPromoError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } }}
                      placeholder="Enter code"
                      className="flex-1 input-field font-mono tracking-wide"
                      maxLength={32}
                    />
                    <button
                      type="button"
                      onClick={applyPromo}
                      disabled={promoChecking || !promoCodeInput.trim()}
                      className="energy-btn focus-ring rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {promoChecking ? "Checking…" : "Apply"}
                    </button>
                  </div>
                )}
                {promoError && (
                  <p className="text-xs text-red-600 mt-2">{promoError}</p>
                )}
              </div>

              {/* Finalized total breakdown */}
              <div className="mt-4 rounded-xl border-2 border-court-ink/10 p-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-court-ink/70">
                  <span>Court total</span>
                  <span>₱{courtTotal}</span>
                </div>
                <div className="flex justify-between text-court-ink/70">
                  <span>Paddle rental</span>
                  <span>₱{rentalTotal}</span>
                </div>
                <div className="flex justify-between text-court-ink/70">
                  <span>Ball</span>
                  <span>₱{ballTotal}</span>
                </div>
                {appliedPromo && (
                  <div className="flex justify-between font-semibold text-court-energy-red">
                    <span>Promo ({appliedPromo.code})</span>
                    <span>-₱{discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline font-display font-700 text-court-ink text-base pt-2 border-t border-court-ink/10 mt-1">
                  <span>Total to pay</span>
                  <span ref={totalValueRef} key={grandTotal} className="total-pulse text-xl text-court-orange">₱{grandTotal}</span>
                </div>
              </div>
            </section>
            )}

            {fxPlay && (
              <PromoSuccessAnimation
                sourceRect={fxPlay.sourceRect}
                targetRef={totalValueRef}
                oldTotalText={fxPlay.oldTotalText}
                newTotalText={fxPlay.newTotalText}
                percentage={fxPlay.percentage}
                onDone={() => setFxPlay(null)}
              />
            )}

            {/* Step 5: payment */}
            {step === 5 && (
            <section key="step5" className="wizard-step rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6">
              <SectionHeading number={5} done={step5Done}>Payment</SectionHeading>

              <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-court-orange/25 bg-court-orange/5 px-4 py-3">
                <span className="text-sm font-medium text-court-ink/70">Your total (finalized)</span>
                <span className="font-display font-700 text-lg text-court-orange">₱{grandTotal}</span>
              </div>

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
                    placeholder={`₱${grandTotal}`}
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

              <label className="mt-4 flex items-start gap-2.5 text-sm text-court-ink/70 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={noRefundAck}
                  onChange={(e) => setNoRefundAck(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-court-ink/30 text-court-orange focus-ring flex-shrink-0"
                  required
                />
                <span>
                  I understand this booking is <strong>non-refundable</strong> and can only be rescheduled, not refunded.
                </span>
              </label>
            </section>
            )}

            {error && (
              <div className="rounded-xl border-2 border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium">
                {error}
              </div>
            )}

            {/* Wizard navigation */}
            <div className="wizard-step flex items-center justify-between gap-3 pt-1">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="focus-ring rounded-full bg-white text-court-ink border-2 border-court-ink/15 px-5 py-3 font-semibold hover:border-court-ink/30 inline-flex items-center gap-1.5"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Back
                </button>
              ) : (
                <span />
              )}

              {step < 5 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canContinueFrom(step)}
                  className="focus-ring rounded-full bg-gradient-to-r from-court-orange to-court-orange-dark text-white px-6 py-3 font-semibold shadow-court hover:shadow-court-lg disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  {step === 4 ? "Continue to payment" : "Continue"}
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="focus-ring rounded-full bg-gradient-to-r from-court-orange to-court-orange-dark text-white px-6 py-3.5 font-semibold shadow-court hover:shadow-court-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
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
              )}
            </div>
            {step === 1 && !step1Done && (
              <p className="text-xs text-court-ink/40 text-center sm:text-left">Select at least one time slot to continue.</p>
            )}
            {step === 3 && !step3Done && (
              <p className="text-xs text-court-ink/40 text-center sm:text-left">Fill in your name, an 11-digit contact number, and a valid email to continue.</p>
            )}
          </div>

          {/* Sidebar: summary */}
          <div className="lg:col-span-1">
            <div className="wizard-step sticky top-6 rounded-court bg-white border-2 border-court-blue/20 shadow-court-lg p-5 sm:p-6 overflow-hidden" style={{ animationDelay: "140ms" }}>
              <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-court-orange/5" />
              <h2 className="font-display font-600 text-lg text-court-ink mb-4 relative">Summary</h2>

              {cart.length === 0 ? (
                <p className="text-sm text-court-ink/50 italic">No time slots selected yet.</p>
              ) : (
                <div className="mb-4 space-y-3">
                  {groupsByDate.map((group, gi) => (
                    <div key={group.date}>
                      {groupsByDate.length > 1 && (
                        <p className="text-[11px] font-bold uppercase tracking-wide text-court-orange-dark mb-1">
                          {group.date === today ? "Today" : group.date === tomorrow ? "Tomorrow" : group.date}
                        </p>
                      )}
                      <ul className="text-sm text-court-ink/70 space-y-1">
                        {group.hours.map((h, i) => (
                          <li
                            key={h}
                            className="wizard-step flex justify-between"
                            style={{ animationDelay: `${(gi * group.hours.length + i) * 40}ms` }}
                          >
                            <span>{labelForSlot(h)}</span>
                            <span>₱{priceForSlot(new Date(group.date + "T00:00:00.000Z"), h, pricing)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-court-ink/10 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-court-ink/70">
                  <span>Court total</span>
                  <span>₱{courtTotal}</span>
                </div>
                <div className="flex justify-between text-court-ink/70">
                  <span>Paddle rental</span>
                  <span>₱{rentalTotal}</span>
                </div>
                <div className="flex justify-between text-court-ink/70">
                  <span>Ball</span>
                  <span>₱{ballTotal}</span>
                </div>
                {appliedPromo && (
                  <div className="flex justify-between font-semibold text-court-energy-red">
                    <span>Promo ({appliedPromo.code})</span>
                    <span>-₱{discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline font-display font-700 text-court-ink text-base pt-2">
                  <span>Total</span>
                  <span key={grandTotal} className="total-pulse text-xl text-court-orange">₱{grandTotal}</span>
                </div>
              </div>

              <p className="text-[11px] text-court-ink/40 text-center mt-5">
                {step === 5
                  ? "You'll get a confirmation email once your payment is verified."
                  : "Complete each step to reserve your spot."}
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

function StepDot({
  number,
  label,
  done,
  current,
  onClick,
  disabled,
  last,
}: {
  number: number;
  label: string;
  done: boolean;
  current?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center ${last ? "" : "flex-1"}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-current={current ? "step" : undefined}
        className={`focus-ring flex flex-col items-center gap-1.5 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`step-badge inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 transition-all ${
            current
              ? "bg-court-orange border-court-orange text-white shadow-court ring-4 ring-court-orange/20"
              : done
              ? "bg-court-orange border-court-orange text-white shadow-court"
              : "bg-white border-court-ink/15 text-court-ink/40"
          }`}
        >
          {done && !current ? (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            number
          )}
        </span>
        <span className={`hidden sm:block text-[11px] font-semibold whitespace-nowrap ${done || current ? "text-court-ink" : "text-court-ink/40"}`}>
          {label}
        </span>
      </button>
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
