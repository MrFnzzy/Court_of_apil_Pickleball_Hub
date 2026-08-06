"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PaddleIcon from "@/components/icons/PaddleIcon";
import BallIcon from "@/components/icons/BallIcon";
import ConfettiBurst from "@/components/ConfettiBurst";

type Prize = { id: string; label: string; color: string };
type Result = {
  prizeId?: string | null;
  prizeLabel: string;
  won: boolean;
  discountCode: string | null;
  discountPercentage: number | null;
};

/** Fires a short device vibration if the browser/OS supports it. No-op otherwise. */
function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Haptics are a nice-to-have — never let them break the flow.
  }
}

const SOUND_KEY = "heidesPickleballHub.soundEnabled";

function isSoundOn() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

// ─── Sound helpers (all synthesized, no audio files) ────────────────────────

/** A single ratchet "clack" as the pointer flicks past a peg/wedge boundary. */
function playTick(ctx: AudioContext, time: number, pitch = 600, volume = 0.18) {
  // Layer 1: a short noise burst — the physical "clack" of a peg.
  const noiseLen = ctx.sampleRate * 0.02;
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) {
    const t = i / ctx.sampleRate;
    noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-140 * t);
  }
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = pitch * 2.2;
  noiseFilter.Q.value = 1.2;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.7, time);
  noiseSrc.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
  noiseSrc.start(time);

  // Layer 2: a brief tonal pluck for pitch definition.
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    data[i] = Math.sin(2 * Math.PI * pitch * t) * Math.exp(-90 * t);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, time);
  src.connect(gain).connect(ctx.destination);
  src.start(time);
}

/** A soft rising "whoosh" as the wheel first kicks off. */
function playWhoosh(ctx: AudioContext, time: number) {
  const dur = 0.5;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(200, time);
  filter.frequency.exponentialRampToValueAtTime(2200, time + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.16, time + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(time);
  src.stop(time + dur);
}

/** A soft low "thunk" as the wheel comes to rest. */
function playLandThunk(ctx: AudioContext, time: number) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(160, time);
  osc.frequency.exponentialRampToValueAtTime(60, time + 0.22);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(0.28, time + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.32);
}

/**
 * Schedules ratchet ticks + a suspense swell for the full spin, decelerating
 * to match the CSS cubic-bezier(0.12, 0.67, 0.1, 1) easing, and matching the
 * *actual* number of wedges so the last few ticks visually line up with the
 * real wedge boundaries. Returns a cleanup fn.
 */
function playSpinSounds(totalMs: number, wedgeCount = 8): () => void {
  if (!isSoundOn()) return () => {};
  if (typeof window === "undefined") return () => {};
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return () => {};
  const ctx = new AC() as AudioContext;
  const totalSec = totalMs / 1000;
  const now = ctx.currentTime;
  const wedges = Math.max(2, wedgeCount);

  playWhoosh(ctx, now);

  const FULL_SPINS = 6;
  const totalDeg = FULL_SPINS * 360 + 180; // representative travel
  const STEPS = 500;
  let prevDeg = 0;
  const tickEvery = 360 / wedges; // one tick per real wedge boundary
  let accumulated = 0;
  let tickCount = 0;

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
      const pitch = 900 - 550 * eased; // pitch drops as wheel slows
      const volume = 0.1 + 0.12 * (1 - eased); // ticks get punchier as it slows
      playTick(ctx, t, pitch, volume);
      tickCount++;
    }
  }

  // Landing thunk, timed to the end of the spin.
  playLandThunk(ctx, now + totalSec - 0.02);

  // Light haptic buzz on the very last few ticks for a tactile "it's slowing
  // down" cue on devices that support vibration.
  window.setTimeout(() => vibrate([12, 40, 12]), totalMs - 260);

  return () => {
    try { ctx.close(); } catch {}
  };
}

/** Rising arpeggio + sparkle overtones + a soft tail echo for a win. */
function playWinChime() {
  if (!isSoundOn()) return;
  if (typeof window === "undefined") return;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  const ctx = new AC() as AudioContext;
  const now = ctx.currentTime;

  // Main bus with a touch of feedback delay for a "sparkly room" tail.
  const bus = ctx.createGain();
  bus.gain.value = 1;
  const delay = ctx.createDelay();
  delay.delayTime.value = 0.16;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.28;
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = "lowpass";
  delayFilter.frequency.value = 3500;
  bus.connect(delay);
  delay.connect(delayFilter);
  delayFilter.connect(feedback);
  feedback.connect(delay);
  delay.connect(ctx.destination);
  bus.connect(ctx.destination);

  // Major arpeggio: C5 E5 G5 C6 E6
  [523, 659, 784, 1047, 1319].forEach((freq, i) => {
    const t = now + i * 0.09;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(gain).connect(bus);
    osc.start(t);
    osc.stop(t + 0.65);
  });
  // High sparkle layer
  [2093, 2637, 3136].forEach((freq, i) => {
    const t = now + 0.32 + i * 0.1;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain).connect(bus);
    osc.start(t);
    osc.stop(t + 0.32);
  });
  // Warm sub thump underneath the first note for extra "impact".
  const thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(180, now);
  thump.frequency.exponentialRampToValueAtTime(90, now + 0.2);
  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.0001, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  thump.connect(thumpGain).connect(bus);
  thump.start(now);
  thump.stop(now + 0.28);

  vibrate([0, 30, 40, 30, 40, 60]);
}

/** Gentle descending minor-third "better luck next time" tone — soft, not sad. */
function playNoWinSound() {
  if (!isSoundOn()) return;
  if (typeof window === "undefined") return;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  const ctx = new AC() as AudioContext;
  const now = ctx.currentTime;
  [440, 370, 330].forEach((freq, i) => {
    const t = now + i * 0.12;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.46);
  });
  vibrate(30);
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

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Takes the raw wedge colours an admin picked and returns a harmonised set:
 * evenly-spaced hues (so nothing sits awkwardly close to its neighbour on
 * the colour wheel), a shared saturation band, and alternating light/dark
 * bands so every wedge boundary reads with clear contrast — while still
 * keeping each wedge recognisably close to the colour that was configured
 * for it. If the admin's colours are already well spread out, they're left
 * close to untouched; harmonising only kicks in where it actually helps.
 */
function harmonizeWedgeColors(colors: string[]): string[] {
  const n = colors.length;
  if (n <= 1) return colors;

  const hsl = colors.map((c) => {
    try {
      return hexToHsl(c);
    } catch {
      return [0, 0.6, 0.5] as [number, number, number];
    }
  });

  // Check the minimum gap between consecutive hues (wrapping around 360°).
  const sortedHues = hsl.map(([h]) => h).sort((a, b) => a - b);
  let minGap = Infinity;
  for (let i = 0; i < n; i++) {
    const a = sortedHues[i];
    const b = sortedHues[(i + 1) % n];
    const gap = i === n - 1 ? 360 - a + b : b - a;
    minGap = Math.min(minGap, gap);
  }
  const idealGap = 360 / n;
  const needsRedistribution = minGap < idealGap * 0.55;

  return hsl.map(([h, s, l], i) => {
    // Spread hues evenly (in original order) only when they're clashing.
    const hue = needsRedistribution ? (hsl[0][0] + i * idealGap) % 360 : h;
    // Keep saturation lively but consistent across wedges (55–78%).
    const sat = Math.min(0.78, Math.max(0.55, s || 0.65));
    // Alternate lightness slightly band-to-band so adjacent wedges never
    // blur together, while staying inside a range both light and dark
    // label text can read against.
    const baseL = Math.min(0.62, Math.max(0.42, l || 0.52));
    const band = i % 2 === 0 ? 0.03 : -0.03;
    const lightness = Math.min(0.66, Math.max(0.38, baseL + band));
    return hslToHex(hue, sat, lightness);
  });
}

// ─── SVG wheel (proper wedge paths with depth) ───────────────────────────────

function WheelSVG({
  prizes,
  rotation,
  spinning,
  landed,
  winningIndex,
}: {
  prizes: Prize[];
  rotation: number;
  spinning: boolean;
  landed: boolean;
  winningIndex?: number | null;
}) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 2; // outer radius, leaves room for stroke

  const wedgeAngle = prizes.length > 0 ? 360 / prizes.length : 0;

  // Harmonised colours: balanced hue spacing + alternating contrast bands,
  // computed once per prize set (not per render).
  const harmonizedColors = useMemo(
    () => harmonizeWedgeColors(prizes.map((p) => p.color || "#888888")),
    [prizes]
  );

  const wedges = useMemo(() => {
    return prizes.map((rawPrize, i) => {
      const prize = { ...rawPrize, color: harmonizedColors[i] || rawPrize.color };
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
  }, [prizes, harmonizedColors, wedgeAngle, cx, cy, R]);

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
      {wedges.map(({ prize, path, gradId }, i) => {
        const isWinner = winningIndex != null && i === winningIndex;
        const isDimmed = winningIndex != null && !isWinner;
        return (
          <path
            key={gradId}
            d={path}
            fill={`url(#${gradId})`}
            stroke={isWinner ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.6)"}
            strokeWidth={isWinner ? 2.5 : 1.5}
            opacity={isDimmed ? 0.45 : 1}
            style={{ transition: "opacity 500ms ease, stroke-width 300ms ease" }}
          />
        );
      })}

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
      {wedges.map(({ prize, lx, ly, labelRotate, gradId }, i) => {
        const dark = needsDarkText(prize.color || "#888");
        const label =
          prize.label.length > 14 ? prize.label.slice(0, 13) + "…" : prize.label;
        const isDimmed = winningIndex != null && i !== winningIndex;
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
            opacity={isDimmed ? 0.55 : 1}
            style={{ userSelect: "none", pointerEvents: "none", transition: "opacity 500ms ease" }}
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
  const [winningIndex, setWinningIndex] = useState<number | null>(null);
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
        const loadedPrizes: Prize[] = data.prizes || [];
        setPrizes(loadedPrizes);
        setAlreadySpun(data.alreadySpun);
        if (data.result) {
          setResult(data.result);
          setShowResultCard(true);

          // ── Point the wheel graphic at the ACTUAL result ──────────────
          // This is the fix: previously the wheel just rendered at its
          // default rotation (0°) whenever the page loaded on an
          // already-spun invite, so the wedge shown under the pointer had
          // nothing to do with what was actually won. Now we look up the
          // won prize's position among the current wedges and rotate the
          // wheel to put that exact wedge under the pointer, instantly
          // (no spin animation needed — nothing is "spinning", we're just
          // displaying the recorded outcome).
          const wedgeCount = loadedPrizes.length;
          if (wedgeCount > 0) {
            let idx = loadedPrizes.findIndex((p) => p.id === data.result.prizeId);
            if (idx < 0) {
              // Prize may have since been deactivated/deleted — fall back
              // to matching by label so the wheel still shows something
              // sensible rather than silently defaulting to wedge 0.
              idx = loadedPrizes.findIndex((p) => p.label === data.result.prizeLabel);
            }
            if (idx >= 0) {
              const wedgeAngleLoad = 360 / wedgeCount;
              const wedgeCenter = idx * wedgeAngleLoad + wedgeAngleLoad / 2;
              // Same rotation direction as handleSpin below: R = (360 − C) mod 360.
              setRotation((360 - wedgeCenter) % 360);
              setWinningIndex(idx);
            }
          }
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

    // Start ticking sounds immediately for tactile feedback — pass the real
    // wedge count so ticks land in sync with the actual wedge boundaries.
    stopSpinSoundRef.current = playSpinSounds(SPIN_MS, prizes.length || 8);
    vibrate(15);

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

      // ── ROTATION (verified) ──────────────────────────────────────────────
      // The pointer sits fixed at the TOP (0° / 12 o'clock) of the wheel's
      // container. Wedge i's centre sits at clockwise-from-top angle:
      //   C = i * wedgeAngle + wedgeAngle / 2
      // CSS `rotate(Rdeg)` turns the wheel clockwise, so a point originally
      // at angle θ ends up on-screen at (θ + R) mod 360. To land wedge i's
      // centre on the pointer (screen angle 0), we need (C + R) ≡ 0 (mod
      // 360), i.e.  R = (360 − C) mod 360  — NOT R = C.
      //
      // A previous change here used R = C directly. That is off by a
      // reflection: for evenly-spaced wedges it lands on a *different*
      // wedge than the one that was actually won (verified by simulation —
      // for 4 wedges it consistently shows the wrong neighbour). Using
      // (360 − C) is the version that actually matches the server's pick.
      // ─────────────────────────────────────────────────────────────────────
      const wedgeCenter = targetIndex * wedgeAngle + wedgeAngle / 2;
      const targetRotation = (360 - wedgeCenter) % 360;
      // Jitter within ±40% of the wedge so it never lands right on an edge
      const jitter = (Math.random() - 0.5) * wedgeAngle * 0.4;
      const extraSpins = 6 * 360; // 6 full rotations for drama

      setWinningIndex(null); // don't dim any wedge while it's actively spinning
      setRotation((prev) => {
        // Bring prev to a clean multiple of 360 so the maths is simple, then
        // add the exact target angle plus extra full spins.
        const prevBase = prev - ((prev % 360) + 360) % 360;
        return prevBase + extraSpins + targetRotation + jitter;
      });

      window.setTimeout(() => {
        stopSpinSoundRef.current?.();
        setSpinning(false);
        setLanded(true);
        setAlreadySpun(true);
        setWinningIndex(targetIndex);
        const won = !!data.discountCode;
        setResult({
          prizeId: data.prizeId,
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
                  winningIndex={winningIndex}
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
