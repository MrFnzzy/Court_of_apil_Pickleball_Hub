"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function isSoundOn() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

// ─── Sound helpers (all synthesized, no audio files) ────────────────────────

/** A single "tick" click as the pointer passes a wedge boundary. */
function playTick(ctx: AudioContext, time: number, pitch = 600) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    data[i] = Math.sin(2 * Math.PI * pitch * t) * Math.exp(-80 * t);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.18, time);
  src.connect(gain).connect(ctx.destination);
  src.start(time);
}

/**
 * Schedules ticks for the full 4.6-second spin, decelerating to match the
 * CSS cubic-bezier(0.12, 0.67, 0.1, 1) easing. Returns a cleanup fn.
 */
function playSpinSounds(totalMs: number): () => void {
  if (!isSoundOn()) return () => {};
  if (typeof window === "undefined") return () => {};
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return () => {};
  const ctx = new AC() as AudioContext;
  const totalSec = totalMs / 1000;

  // Simulate the cubic-bezier velocity curve by computing cumulative angle
  // at each sample and triggering a tick every wedge-width (assuming 8 wedges
  // as a representative default; visual ticks just need to feel right).
  const FULL_SPINS = 6;
  const totalDeg = FULL_SPINS * 360 + 180; // representative travel
  const STEPS = 500;
  let prevDeg = 0;
  const tickEvery = 360 / 8; // ~one tick per wedge boundary
  let accumulated = 0;
  const now = ctx.currentTime;

  for (let s = 1; s <= STEPS; s++) {
    const progress = s / STEPS;
    // Approximate cubic-bezier(0.12, 0.67, 0.1, 1) — fast start, slow end
    const eased =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    const curDeg = eased * totalDeg;
    accumulated += curDeg - prevDeg;
    prevDeg = curDeg;
    if (accumulated >= tickEvery) {
      accumulated -= tickEvery;
      const t = now + (s / STEPS) * totalSec;
      const pitch = 800 - 500 * eased; // pitch drops as wheel slows
      playTick(ctx, t, pitch);
    }
  }

  return () => {
    try { ctx.close(); } catch {}
  };
}

/** Three rising notes + two sparkle overtones for a win. */
function playWinChime() {
  if (!isSoundOn()) return;
  if (typeof window === "undefined") return;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  const ctx = new AC() as AudioContext;
  const now = ctx.currentTime;
  // Major arpeggio: C5 E5 G5 C6
  [523, 659, 784, 1047].forEach((freq, i) => {
    const t = now + i * 0.1;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  });
  // High sparkle layer
  [2093, 2637].forEach((freq, i) => {
    const t = now + 0.3 + i * 0.12;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  });
}

/** Gentle descending minor-third "better luck next time" tone. */
function playNoWinSound() {
  if (!isSoundOn()) return;
  if (typeof window === "undefined") return;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  const ctx = new AC() as AudioContext;
  const now = ctx.currentTime;
  [440, 370].forEach((freq, i) => {
    const t = now + i * 0.13;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.13, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  });
}

// ─── Colour helpers ──────────────────────────────────────────────────────────

/** Parse a CSS hex colour string and return [r, g, b] in 0–255. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance – true when the background is light enough to need dark text. */
function needsDarkText(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const lum =
    0.2126 * (r / 255) ** 2.2 +
    0.7152 * (g / 255) ** 2.2 +
    0.0722 * (b / 255) ** 2.2;
  return lum > 0.35;
}

/** Lighten a hex colour by mixing it toward white. */
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) =>
    Math.round(c + (255 - c) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}

// ─── SVG wheel (proper wedge paths with depth) ───────────────────────────────

function WheelSVG({
  prizes,
  rotation,
  spinning,
  landed,
}: {
  prizes: Prize[];
  rotation: number;
  spinning: boolean;
  landed: boolean;
}) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 2; // outer radius, leaves room for stroke

  const wedgeAngle = prizes.length > 0 ? 360 / prizes.length : 0;

  const wedges = useMemo(() => {
    return prizes.map((prize, i) => {
      const startDeg = i * wedgeAngle;
      const endDeg = (i + 1) * wedgeAngle;
      // SVG angles: 0 = right (3 o'clock), so subtract 90 to start at top
      const startRad = ((startDeg - 90) * Math.PI) / 180;
      const endRad = ((endDeg - 90) * Math.PI) / 180;
      const largeArc = wedgeAngle > 180 ? 1 : 0;

      const x1 = cx + R * Math.cos(startRad);
      const y1 = cy + R * Math.sin(startRad);
      const x2 = cx + R * Math.cos(endRad);
      const y2 = cy + R * Math.sin(endRad);
      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      // Label sits at 60% radius along the midpoint angle
      const midRad = ((startDeg + wedgeAngle / 2 - 90) * Math.PI) / 180;
      const lx = cx + R * 0.6 * Math.cos(midRad);
      const ly = cy + R * 0.6 * Math.sin(midRad);
      const labelRotate = startDeg + wedgeAngle / 2;

      const gradId = `wg${i}`;
      return { prize, path, lx, ly, labelRotate, gradId, startDeg };
    });
  }, [prizes, wedgeAngle, cx, cy, R]);

  // Font size shrinks with more wedges to keep labels legible
  const fontSize =
    prizes.length <= 4 ? 14 : prizes.length <= 7 ? 12 : prizes.length <= 10 ? 10 : 8;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        transform: `rotate(${rotation}deg)`,
        transition: spinning ? "transform 4.6s cubic-bezier(0.12, 0.67, 0.1, 1)" : "none",
        willChange: "transform",
        filter: landed
          ? "drop-shadow(0 0 20px rgba(244,96,54,0.6)) drop-shadow(0 8px 32px rgba(23,58,69,0.3))"
          : "drop-shadow(0 8px 32px rgba(23,58,69,0.25))",
        transition: spinning
          ? "transform 4.6s cubic-bezier(0.12, 0.67, 0.1, 1)"
          : "none",
      }}
    >
      <defs>
        {/* Per-wedge radial gradient: lighter at center, full colour at edge */}
        {wedges.map(({ prize, gradId }) => (
          <radialGradient key={gradId} id={gradId} cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor={lighten(prize.color || "#888", 0.28)} />
            <stop offset="100%" stopColor={prize.color || "#888"} />
          </radialGradient>
        ))}
        {/* Glossy highlight overlay gradient */}
        <radialGradient id="gloss" cx="38%" cy="28%" r="58%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.40)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        {/* Rim drop-shadow filter */}
        <filter id="rimShadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(0,0,0,0.4)" />
        </filter>
      </defs>

      {/* Decorative outer ring */}
      <circle cx={cx} cy={cy} r={R + 6} fill="none" stroke="white" strokeWidth={8} />
      <circle cx={cx} cy={cy} r={R + 6} fill="none" stroke="rgba(23,58,69,0.15)" strokeWidth={2.5} />

      {/* Wedges */}
      {wedges.map(({ prize, path, gradId }) => (
        <path
          key={gradId}
          d={path}
          fill={`url(#${gradId})`}
          stroke="rgba(255,255,255,0.6)"
          strokeWidth={1.5}
        />
      ))}

      {/* Wedge separator spokes */}
      {wedges.map(({ startDeg, gradId }) => {
        const rad = ((startDeg - 90) * Math.PI) / 180;
        return (
          <line
            key={`spoke-${gradId}`}
            x1={cx}
            y1={cy}
            x2={cx + R * Math.cos(rad)}
            y2={cy + R * Math.sin(rad)}
            stroke="rgba(255,255,255,0.45)"
            strokeWidth={1}
          />
        );
      })}

      {/* Labels */}
      {wedges.map(({ prize, lx, ly, labelRotate, gradId }) => {
        const dark = needsDarkText(prize.color || "#888");
        const label =
          prize.label.length > 14 ? prize.label.slice(0, 13) + "…" : prize.label;
        return (
          <text
            key={`lbl-${gradId}`}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fontWeight="800"
            fontFamily="Fredoka, system-ui, sans-serif"
            fill={dark ? "rgba(23,58,69,0.9)" : "rgba(255,255,255,0.97)"}
            style={{ userSelect: "none", pointerEvents: "none" }}
            transform={`rotate(${labelRotate}, ${lx}, ${ly})`}
          >
            {label}
          </text>
        );
      })}

      {/* Glossy sheen */}
      <circle cx={cx} cy={cy} r={R} fill="url(#gloss)" style={{ pointerEvents: "none" }} />

      {/* Inner rim vignette */}
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        stroke="rgba(0,0,0,0.1)"
        strokeWidth={5}
        style={{ pointerEvents: "none" }}
      />
    </svg>
  );
}

// ─── Main page component ─────────────────────────────────────────────────────

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

  const stopSpinSoundRef = useRef<(() => void) | null>(null);

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

  async function handleSpin() {
    if (spinning || alreadySpun || prizes.length === 0) return;
    setError(null);
    setSpinning(true);
    setLanded(false);

    const SPIN_MS = 4600;

    // Start ticking sounds immediately for tactile feedback
    stopSpinSoundRef.current = playSpinSounds(SPIN_MS);

    try {
      const res = await fetch(`/api/spin/${params.token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSpinning(false);
        stopSpinSoundRef.current?.();
        return;
      }

      const index = prizes.findIndex((p) => p.id === data.prizeId);
      const targetIndex = index >= 0 ? index : 0;

      // ── ROTATION FIX ─────────────────────────────────────────────────────
      // The pointer sits at the TOP (0° / 12 o'clock).
      //
      // CSS conic-gradient and our SVG both place wedge[i]'s START edge at
      // angle  i * wedgeAngle  measured clockwise from 12 o'clock, so the
      // CENTRE of wedge[i] sits at:
      //   wedgeCenter = i * wedgeAngle + wedgeAngle / 2
      //
      // When the wheel has rotated by R degrees clockwise, the part of the
      // wheel at the pointer is the part that was originally at angle R from
      // 12 o'clock.  To put wedge[target]'s centre under the pointer:
      //   R mod 360  =  wedgeCenter
      //
      // Original code used  (360 - wedgeCenter)  which is the angle of the
      // OPPOSITE point on the wheel — that's why it landed on the wrong prize.
      // ─────────────────────────────────────────────────────────────────────
      const wedgeCenter = targetIndex * wedgeAngle + wedgeAngle / 2;
      // Jitter within ±40% of the wedge so it never lands right on an edge
      const jitter = (Math.random() - 0.5) * wedgeAngle * 0.4;
      const extraSpins = 6 * 360; // 6 full rotations for drama

      setRotation((prev) => {
        // Bring prev to a clean multiple of 360 so the maths is simple, then
        // add the exact target angle plus extra full spins.
        const prevBase = prev - ((prev % 360) + 360) % 360;
        return prevBase + extraSpins + wedgeCenter + jitter;
      });

      window.setTimeout(() => {
        stopSpinSoundRef.current?.();
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
          window.setTimeout(() => setShowConfetti(false), 4800);
        } else {
          playNoWinSound();
        }
        window.setTimeout(() => setLanded(false), 600);
      }, SPIN_MS);
    } catch {
      setError("Something went wrong. Please try again.");
      setSpinning(false);
      stopSpinSoundRef.current?.();
    }
  }

  async function copyCode() {
    if (!result?.discountCode) return;
    try {
      await navigator.clipboard.writeText(result.discountCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the code is still visible on screen.
    }
  }

  return (
    <div className="min-h-screen bg-court-cream flex flex-col relative overflow-hidden">
      {showConfetti && <ConfettiBurst />}
      <SiteHeader />

      {/* ── Richer ambient background ── */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[500px] overflow-hidden -z-0">
        <div className="absolute left-1/2 top-[-100px] h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-court-orange/18 blur-[90px]" />
        <div className="absolute left-[8%]  top-[60px]  h-[260px] w-[260px] rounded-full bg-court-blue/22   blur-[70px]" />
        <div className="absolute right-[6%] top-[120px] h-[200px] w-[200px] rounded-full bg-court-orange/12 blur-[55px]" />
      </div>

      <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-10 relative">

        {/* ── Loading ── */}
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

            {/* ── Header ── */}
            <div className="text-center mb-7 wizard-step">
              <span className="inline-flex h-13 w-13 items-center justify-center rounded-full bg-court-orange mb-3 shadow-court-lg animate-soft-float"
                style={{ width: 52, height: 52 }}>
                <PaddleIcon className="h-7 w-7 text-white" />
              </span>
              <h1 className="font-display font-700 text-2xl sm:text-3xl text-court-ink mt-1">
                {alreadySpun
                  ? "Your spin result"
                  : `Spin the wheel, ${customerName.split(" ")[0] || "there"}!`}
              </h1>
              <p className="text-court-ink/58 text-sm mt-1.5">
                {alreadySpun
                  ? "You've already used your one spin."
                  : "You get one spin — good luck! 🎯"}
              </p>
            </div>

            {/* ── Wheel container ── */}
            <div
              className="relative mx-auto mb-9"
              style={{ width: "min(88vw, 340px)", height: "min(88vw, 340px)" }}
            >
              {/* Rotating halo when idle — gives the wheel a "live" feel */}
              {!alreadySpun && !spinning && (
                <div
                  aria-hidden
                  className="spin-wheel-glow absolute rounded-full pointer-events-none"
                  style={{
                    inset: -18,
                    background:
                      "conic-gradient(from 0deg, rgba(244,96,54,0.38), rgba(108,212,255,0.32), rgba(244,96,54,0.38))",
                    filter: "blur(18px)",
                    animation: "spin 7s linear infinite",
                  }}
                />
              )}

              {/* Landing flash ring */}
              {landed && (
                <div
                  aria-hidden
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    inset: -8,
                    border: "3px solid rgba(244,96,54,0.65)",
                    boxShadow: "0 0 28px rgba(244,96,54,0.45)",
                    animation: "ping 0.55s ease-out forwards",
                  }}
                />
              )}

              {/* ── Pointer ── nicer SVG arrow */}
              <div
                aria-hidden
                className={`absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none ${landed ? "spin-pointer-bounce" : ""}`}
                style={{ top: -18, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }}
              >
                <svg width="30" height="38" viewBox="0 0 30 38">
                  <defs>
                    <linearGradient id="ptr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF7043" />
                      <stop offset="100%" stopColor="#BF360C" />
                    </linearGradient>
                  </defs>
                  {/* Drop shadow shape */}
                  <polygon points="1,3 29,3 15,37" fill="rgba(0,0,0,0.2)" transform="translate(1,2)" />
                  {/* Main arrow body */}
                  <polygon points="1,3 29,3 15,37" fill="url(#ptr)" />
                  {/* Left-edge highlight */}
                  <polygon points="1,3 15,37 15,14" fill="rgba(255,255,255,0.2)" />
                  {/* Top cap circle */}
                  <circle cx="15" cy="6" r="6" fill="white" />
                  <circle cx="15" cy="6" r="3.5" fill="#F46036" />
                </svg>
              </div>

              {/* ── SVG Wheel ── */}
              <div style={{ width: "100%", height: "100%" }}>
                <WheelSVG
                  prizes={prizes}
                  rotation={rotation}
                  spinning={spinning}
                  landed={landed}
                />
              </div>

              {/* ── Hub cap ── */}
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <span
                  className="flex items-center justify-center rounded-full bg-white border-2 border-court-ink/10"
                  style={{
                    width: 42,
                    height: 42,
                    boxShadow: "0 3px 12px rgba(0,0,0,0.18), inset 0 1px 2px rgba(255,255,255,0.9)",
                  }}
                >
                  <BallIcon className="h-5 w-5 text-court-orange" />
                </span>
              </div>
            </div>

            {/* ── Error ── */}
            {error && (
              <div className="rounded-xl border-2 border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium mb-5 text-center wizard-step">
                {error}
              </div>
            )}

            {/* ── Spin button ── */}
            {!alreadySpun && (
              <div className="text-center mb-2">
                <button
                  onClick={handleSpin}
                  disabled={spinning || prizes.length === 0}
                  className={`focus-ring relative overflow-hidden rounded-full text-white font-display font-700 text-lg px-14 py-4 shadow-court-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all ${
                    !spinning && prizes.length > 0 ? "spin-button-shimmer" : ""
                  }`}
                  style={{
                    background: spinning
                      ? "rgb(var(--color-orange-dark))"
                      : "linear-gradient(135deg, rgb(var(--color-orange-light)) 0%, rgb(var(--color-orange)) 45%, rgb(var(--color-orange-dark)) 100%)",
                    boxShadow: spinning
                      ? "none"
                      : "0 6px 28px rgba(244,96,54,0.45), 0 2px 8px rgba(244,96,54,0.25)",
                  }}
                >
                  {/* Inner gloss streak */}
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(108deg, rgba(255,255,255,0) 38%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0) 62%)",
                    }}
                  />
                  <span className="relative">
                    {spinning ? (
                      <span className="flex items-center gap-2.5">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.28)" strokeWidth="3" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        Spinning…
                      </span>
                    ) : (
                      "🎰  Spin!"
                    )}
                  </span>
                </button>
                {prizes.length === 0 && (
                  <p className="text-xs text-court-ink/40 mt-3">No prizes are set up yet — check back soon.</p>
                )}
              </div>
            )}

            {/* ── Result card ── */}
            {showResultCard && result && (
              <div
                className="mt-8 rounded-court shadow-court-lg p-6 sm:p-8 text-center wizard-step relative overflow-hidden"
                style={{
                  background: result.won
                    ? "linear-gradient(150deg, #fff 0%, rgba(244,96,54,0.06) 100%)"
                    : "white",
                  border: result.won
                    ? "2px solid rgba(244,96,54,0.28)"
                    : "2px solid rgba(23,58,69,0.1)",
                }}
              >
                {result.won ? (
                  <>
                    {/* Colour accent bar at top */}
                    <div
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-1.5 rounded-t-court"
                      style={{
                        background: "linear-gradient(90deg, #F46036, #6CD4FF, #F46036)",
                      }}
                    />
                    {/* Radial glow behind win content */}
                    <div
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-32 pointer-events-none"
                      style={{
                        background:
                          "radial-gradient(ellipse at 50% 0%, rgba(244,96,54,0.14), transparent 68%)",
                      }}
                    />
                    <p className="font-display font-700 text-2xl sm:text-3xl text-court-ink mb-1 relative mt-3">
                      You won! 🎉
                    </p>
                    <p className="text-court-ink/65 text-sm mb-5 relative font-medium">
                      {result.prizeLabel}
                    </p>

                    {/* Discount code copy button */}
                    <button
                      onClick={copyCode}
                      title="Tap to copy"
                      className="prize-code-pop focus-ring group relative inline-flex items-center gap-3 rounded-2xl px-6 py-4 font-mono text-xl font-bold tracking-widest transition-all hover:scale-[1.03] active:scale-95"
                      style={{
                        background: "linear-gradient(135deg, rgba(244,96,54,0.07), rgba(244,96,54,0.03))",
                        border: "2.5px dashed rgba(244,96,54,0.5)",
                        color: "rgb(var(--color-orange-dark))",
                        boxShadow: "0 4px 18px rgba(244,96,54,0.1)",
                      }}
                    >
                      <span>{result.discountCode}</span>
                      <span
                        className="text-[10px] font-sans font-bold uppercase tracking-wide px-2 py-1 rounded-full transition-colors"
                        style={{
                          background: copied
                            ? "rgba(34,197,94,0.15)"
                            : "rgba(244,96,54,0.1)",
                          color: copied
                            ? "rgb(22,163,74)"
                            : "rgba(214,73,31,0.72)",
                        }}
                      >
                        {copied ? "✓ Copied!" : "Tap to copy"}
                      </span>
                    </button>

                    <p className="text-xs text-court-ink/50 mt-4 leading-relaxed">
                      <strong className="text-court-orange-dark font-semibold">
                        {result.discountPercentage}% off
                      </strong>{" "}
                      your next booking. We also emailed this code to you — it can only be used once.
                    </p>
                  </>
                ) : (
                  <>
                    {/* Subtle accent bar */}
                    <div
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-1.5 rounded-t-court"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(23,58,69,0.25), rgba(108,212,255,0.35), rgba(23,58,69,0.25))",
                      }}
                    />
                    <span
                      className="inline-flex h-13 w-13 items-center justify-center rounded-full mt-3 mb-3"
                      style={{ width: 52, height: 52, background: "rgba(23,58,69,0.07)" }}
                    >
                      <PaddleIcon className="h-6 w-6 text-court-ink/40" />
                    </span>
                    <p className="font-display font-700 text-xl text-court-ink mb-2">
                      {result.prizeLabel}
                    </p>
                    <p className="text-court-ink/60 text-sm leading-relaxed">
                      No discount this time — thanks for playing!<br />
                      Hope to see you back on the court soon. 🏓
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
