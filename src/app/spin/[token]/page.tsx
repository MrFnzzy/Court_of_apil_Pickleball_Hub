"use client";

import { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PaddleIcon from "@/components/icons/PaddleIcon";

type Prize = { id: string; label: string; color: string };
type Result = {
  prizeLabel: string;
  won: boolean;
  discountCode: string | null;
  discountPercentage: number | null;
};

export default function SpinWheelPage({ params }: { params: { token: string } }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [alreadySpun, setAlreadySpun] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showResultCard, setShowResultCard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/spin/${params.token}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setCustomerName(data.customerName || "");
        setEnabled(data.enabled);
        setPrizes(data.prizes || []);
        setAlreadySpun(data.alreadySpun);
        if (data.result) {
          setResult(data.result);
          setShowResultCard(true);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  const wedgeAngle = prizes.length > 0 ? 360 / prizes.length : 0;

  const wheelBackground = useMemo(() => {
    if (prizes.length === 0) return "#eee";
    const stops = prizes
      .map((p, i) => `${p.color} ${i * wedgeAngle}deg ${(i + 1) * wedgeAngle}deg`)
      .join(", ");
    return `conic-gradient(${stops})`;
  }, [prizes, wedgeAngle]);

  async function handleSpin() {
    if (spinning || alreadySpun || prizes.length === 0) return;
    setError(null);
    setSpinning(true);
    try {
      const res = await fetch(`/api/spin/${params.token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSpinning(false);
        return;
      }

      const index = prizes.findIndex((p) => p.id === data.prizeId);
      const targetIndex = index >= 0 ? index : 0;
      const wedgeCenter = targetIndex * wedgeAngle + wedgeAngle / 2;
      // Jitter within the wedge so it doesn't always land dead-center.
      const jitter = (Math.random() - 0.5) * wedgeAngle * 0.5;
      const spins = 5; // extra full turns for a satisfying spin
      const finalRotation = spins * 360 + (360 - wedgeCenter + jitter);

      setRotation((prev) => prev - (prev % 360) + finalRotation);

      window.setTimeout(() => {
        setSpinning(false);
        setAlreadySpun(true);
        setResult({
          prizeLabel: data.prizeLabel,
          won: data.won,
          discountCode: data.discountCode,
          discountPercentage: data.discountPercentage,
        });
        setShowResultCard(true);
      }, 4200);
    } catch {
      setError("Something went wrong. Please try again.");
      setSpinning(false);
    }
  }

  return (
    <div className="min-h-screen bg-court-cream flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-10">
        {loading ? (
          <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-8 text-center text-court-ink/50">
            Loading…
          </div>
        ) : notFound ? (
          <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-8 text-center">
            <h1 className="font-display font-700 text-xl text-court-ink mb-2">Link not found</h1>
            <p className="text-court-ink/60 text-sm">
              This spin link is invalid or has expired. If you think this is a mistake, please contact us directly.
            </p>
          </div>
        ) : !enabled && !alreadySpun ? (
          <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-8 text-center">
            <h1 className="font-display font-700 text-xl text-court-ink mb-2">Not available right now</h1>
            <p className="text-court-ink/60 text-sm">
              The spin wheel is temporarily unavailable. Please check back later — your link will still be here.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-court-orange mb-3">
                <PaddleIcon className="h-6 w-6 text-white" />
              </span>
              <h1 className="font-display font-700 text-2xl text-court-ink">
                {alreadySpun ? "Your spin result" : `Spin the wheel, ${customerName.split(" ")[0] || "there"}!`}
              </h1>
              <p className="text-court-ink/60 text-sm mt-1">
                {alreadySpun ? "You've already used your one spin." : "You get one spin — good luck!"}
              </p>
            </div>

            <div className="relative mx-auto mb-8" style={{ width: "min(80vw, 320px)", height: "min(80vw, 320px)" }}>
              {/* Pointer */}
              <div
                className="absolute left-1/2 -translate-x-1/2 -top-2 z-10"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "14px solid transparent",
                  borderRight: "14px solid transparent",
                  borderTop: "22px solid #173A45",
                }}
              />
              <div
                className="rounded-full border-[6px] border-white shadow-court-lg relative overflow-hidden"
                style={{
                  width: "100%",
                  height: "100%",
                  background: wheelBackground,
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? "transform 4.2s cubic-bezier(0.17, 0.67, 0.17, 1)" : "none",
                }}
              >
                {prizes.map((p, i) => {
                  const angle = i * wedgeAngle + wedgeAngle / 2;
                  return (
                    <div
                      key={p.id}
                      className="absolute left-1/2 top-1/2 origin-left text-[11px] font-bold text-white"
                      style={{
                        transform: `rotate(${angle}deg) translateX(18%)`,
                        width: "60%",
                        textShadow: "0 1px 2px rgba(0,0,0,0.35)",
                      }}
                    >
                      {p.label}
                    </div>
                  );
                })}
              </div>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <span className="h-8 w-8 rounded-full bg-white border-2 border-court-ink/10 shadow-court" />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border-2 border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium mb-4 text-center">
                {error}
              </div>
            )}

            {!alreadySpun && (
              <div className="text-center">
                <button
                  onClick={handleSpin}
                  disabled={spinning || prizes.length === 0}
                  className="focus-ring rounded-full bg-gradient-to-r from-court-orange to-court-orange-dark text-white font-display font-600 px-10 py-3 shadow-court disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-court-lg transition-shadow"
                >
                  {spinning ? "Spinning…" : "Spin!"}
                </button>
              </div>
            )}

            {showResultCard && result && (
              <div className="mt-8 rounded-court bg-white border-2 border-court-ink/10 shadow-court p-6 text-center wizard-step">
                {result.won ? (
                  <>
                    <p className="font-display font-700 text-lg text-court-ink mb-1">You won! 🎉</p>
                    <p className="text-court-ink/70 text-sm mb-3">{result.prizeLabel}</p>
                    <div className="inline-block border-2 border-dashed border-court-orange rounded-xl px-5 py-3 font-mono text-lg font-bold text-court-orange-dark tracking-wide">
                      {result.discountCode}
                    </div>
                    <p className="text-xs text-court-ink/50 mt-3">
                      {result.discountPercentage}% off your next booking. We also emailed this code to you — it can
                      only be used once.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-display font-700 text-lg text-court-ink mb-1">{result.prizeLabel}</p>
                    <p className="text-court-ink/60 text-sm">
                      No discount this time — thanks for playing! Hope to see you back on the court soon.
                    </p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
