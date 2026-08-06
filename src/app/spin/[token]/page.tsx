"use client";

import { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PaddleIcon from "@/components/icons/PaddleIcon";
import BallIcon from "@/components/icons/BallIcon";
import ConfettiBurst from "@/components/ConfettiBurst";

type Prize = { id: string; label: string; color: string };
type Result = {
  prizeLabel: string;
  won: boolean;
  discountCode: string | null;
  discountPercentage: number | null;
};

const SOUND_KEY = "heidesPickleballHub.soundEnabled";

// Same lightweight synthesized-audio approach as InteractionFX.tsx (no audio
// files), used here for a two-note "win chime" the moment a prize lands.
function playWinChime() {
  try {
    const muted = localStorage.getItem(SOUND_KEY) === "off";
    if (muted) return;
  } catch {
    // ignore
  }
  if (typeof window === "undefined") return;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  const now = ctx.currentTime;
  const notes = [660, 880, 1320];
  notes.forEach((freq, i) => {
    const start = now + i * 0.09;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.32);
  });
}

export default function SpinWheelPage({ params }: { params: { token: string } }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [isTest, setIsTest] = useState(false);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [alreadySpun, setAlreadySpun] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showResultCard, setShowResultCard] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copied, setCopied] = useState(false);

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
        setIsTest(!!data.isTest);
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
    setLanded(false);
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
      const spins = 6; // extra full turns for a satisfying spin
      const finalRotation = spins * 360 + (360 - wedgeCenter + jitter);

      setRotation((prev) => prev - (prev % 360) + finalRotation);

      window.setTimeout(() => {
        setSpinning(false);
        setLanded(true);
        setAlreadySpun(true);
        const won = !!data.discountCode;
        setResult({
          prizeLabel: data.prizeLabel,
          won,
          discountCode: data.discountCode,
          discountPercentage: data.discountPercentage,
        });
        setShowResultCard(true);
        if (won) {
          setShowConfetti(true);
          playWinChime();
          window.setTimeout(() => setShowConfetti(false), 4200);
        }
        window.setTimeout(() => setLanded(false), 500);
      }, 4600);
    } catch {
      setError("Something went wrong. Please try again.");
      setSpinning(false);
    }
  }

  async function copyCode() {
    if (!result?.discountCode) return;
    try {
      await navigator.clipboard.writeText(result.discountCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the code is still visible/selectable on screen.
    }
  }

  return (
    <div className="min-h-screen bg-court-cream flex flex-col relative overflow-hidden">
      {showConfetti && <ConfettiBurst />}
      <SiteHeader />

      {/* Ambient background flourish */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden -z-0">
        <div className="absolute left-1/2 top-[-140px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-court-orange/10 blur-3xl" />
        <div className="absolute left-[15%] top-[80px] h-[220px] w-[220px] rounded-full bg-court-blue/15 blur-3xl" />
      </div>

      <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-10 relative">
        {loading ? (
          <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-8 text-center">
            <div className="mx-auto h-12 w-12 rounded-full border-4 border-court-orange/20 border-t-court-orange animate-spin mb-4" />
            <p className="text-court-ink/50 text-sm">Loading your spin…</p>
          </div>
        ) : notFound ? (
          <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-8 text-center wizard-step">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-court-ink/10 mb-3">
              <PaddleIcon className="h-6 w-6 text-court-ink/40" />
            </span>
            <h1 className="font-display font-700 text-xl text-court-ink mb-2">Link not found</h1>
            <p className="text-court-ink/60 text-sm">
              This spin link is invalid or has expired. If you think this is a mistake, please contact us directly.
            </p>
          </div>
        ) : !enabled && !alreadySpun ? (
          <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-8 text-center wizard-step">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-court-ink/10 mb-3">
              <PaddleIcon className="h-6 w-6 text-court-ink/40" />
            </span>
            <h1 className="font-display font-700 text-xl text-court-ink mb-2">Not available right now</h1>
            <p className="text-court-ink/60 text-sm">
              The spin wheel is temporarily unavailable. Please check back later — your link will still be here.
            </p>
          </div>
        ) : (
          <>
            {isTest && (
              <div className="mb-5 rounded-full bg-court-ink text-white text-xs font-bold uppercase tracking-wide px-4 py-1.5 text-center wizard-step">
                Test mode — this spin won&apos;t be seen by real customers
              </div>
            )}

            <div className="text-center mb-6 wizard-step">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-court-orange mb-3 shadow-court animate-soft-float">
                <PaddleIcon className="h-6 w-6 text-white" />
              </span>
              <h1 className="font-display font-700 text-2xl sm:text-3xl text-court-ink">
                {alreadySpun ? "Your spin result" : `Spin the wheel, ${customerName.split(" ")[0] || "there"}!`}
              </h1>
              <p className="text-court-ink/60 text-sm mt-1.5">
                {alreadySpun ? "You've already used your one spin." : "You get one spin — good luck!"}
              </p>
            </div>

            <div className="relative mx-auto mb-8" style={{ width: "min(84vw, 340px)", height: "min(84vw, 340px)" }}>
              {/* Ambient glow ring while waiting */}
              {!alreadySpun && !spinning && (
                <div className="spin-wheel-glow absolute inset-[-14px] rounded-full bg-gradient-to-br from-court-orange/40 to-court-blue/30 blur-xl" />
              )}

              {/* Pointer */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 -top-3 z-10 ${landed ? "spin-pointer-bounce" : ""}`}
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "16px solid transparent",
                  borderRight: "16px solid transparent",
                  borderTop: "26px solid #173A45",
                  filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.25))",
                }}
              />

              <div
                className={`rounded-full border-[6px] border-white shadow-court-lg relative overflow-hidden ${landed ? "spin-wheel-land" : ""}`}
                style={{
                  width: "100%",
                  height: "100%",
                  background: wheelBackground,
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? "transform 4.6s cubic-bezier(0.12, 0.67, 0.1, 1)" : "none",
                  boxShadow: "0 0 0 3px rgba(23,58,69,0.06), 0 20px 50px rgba(23,58,69,0.22)",
                }}
              >
                {prizes.map((p, i) => {
                  const angle = i * wedgeAngle + wedgeAngle / 2;
                  return (
                    <div
                      key={p.id}
                      className="absolute left-1/2 top-1/2 origin-left text-[11px] sm:text-xs font-bold text-white"
                      style={{
                        transform: `rotate(${angle}deg) translateX(18%)`,
                        width: "62%",
                        textShadow: "0 1px 3px rgba(0,0,0,0.45)",
                      }}
                    >
                      {p.label}
                    </div>
                  );
                })}
                {/* Glossy highlight overlay for a bit of shine */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse at 35% 22%, rgba(255,255,255,0.35), transparent 45%), radial-gradient(ellipse at 70% 80%, rgba(0,0,0,0.12), transparent 55%)",
                  }}
                />
              </div>

              {/* Hub */}
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <span className="h-9 w-9 rounded-full bg-white border-2 border-court-ink/10 shadow-court flex items-center justify-center">
                  <BallIcon className="h-5 w-5 text-court-orange" />
                </span>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border-2 border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium mb-4 text-center wizard-step">
                {error}
              </div>
            )}

            {!alreadySpun && (
              <div className="text-center">
                <button
                  onClick={handleSpin}
                  disabled={spinning || prizes.length === 0}
                  className={`focus-ring relative overflow-hidden rounded-full bg-gradient-to-r from-court-orange to-court-orange-dark text-white font-display font-600 text-lg px-12 py-3.5 shadow-court-lg disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-court-lg hover:brightness-105 active:scale-95 transition-all ${
                    !spinning && prizes.length > 0 ? "spin-button-shimmer" : ""
                  }`}
                >
                  {spinning ? "Spinning…" : "Spin!"}
                </button>
                {prizes.length === 0 && (
                  <p className="text-xs text-court-ink/40 mt-3">No prizes are set up yet — check back soon.</p>
                )}
              </div>
            )}

            {showResultCard && result && (
              <div className="mt-8 rounded-court bg-white border-2 border-court-ink/10 shadow-court-lg p-6 sm:p-7 text-center wizard-step relative overflow-hidden">
                {result.won ? (
                  <>
                    <div
                      aria-hidden
                      className="absolute inset-x-0 -top-10 h-24 bg-gradient-to-b from-court-orange/15 to-transparent"
                    />
                    <p className="font-display font-700 text-xl text-court-ink mb-1 relative">You won! 🎉</p>
                    <p className="text-court-ink/70 text-sm mb-4 relative">{result.prizeLabel}</p>
                    <button
                      onClick={copyCode}
                      title="Tap to copy"
                      className="prize-code-pop focus-ring group relative inline-flex items-center gap-2 border-2 border-dashed border-court-orange rounded-xl px-5 py-3 font-mono text-lg font-bold text-court-orange-dark tracking-wide hover:bg-court-orange/5 transition-colors"
                    >
                      {result.discountCode}
                      <span className="text-[10px] font-sans font-bold uppercase tracking-wide text-court-orange-dark/60 group-hover:text-court-orange-dark">
                        {copied ? "Copied!" : "Tap to copy"}
                      </span>
                    </button>
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
