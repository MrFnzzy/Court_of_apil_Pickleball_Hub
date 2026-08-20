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
  discountExpiresAt?: string | null;
};

function fmtExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

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
  settling,
  landed,
  winningIndex,
  colors,
}: {
  prizes: Prize[];
  rotation: number;
  spinning: boolean;
  settling: boolean;
  landed: boolean;
  winningIndex?: number | null;
  colors: string[];
}) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 2; // outer radius, leaves room for stroke

  const wedgeAngle = prizes.length > 0 ? 360 / prizes.length : 0;

  const wedges = useMemo(() => {
    return prizes.map((rawPrize, i) => {
      const prize = { ...rawPrize, color: colors[i] || rawPrize.color };
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
  }, [prizes, colors, wedgeAngle, cx, cy, R]);

  // Font size shrinks with more wedges to keep labels legible
  const fontSize =
    prizes.length <= 4 ? 14 : prizes.length <= 7 ? 12 : prizes.length <= 10 ? 10 : 8;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: "block",
        transform: `rotate(${rotation}deg)`,
        transition: spinning
          ? "transform 4.6s cubic-bezier(0.12, 0.67, 0.1, 1)"
          : settling
          ? "transform 340ms cubic-bezier(0.34, 1.56, 0.64, 1)"
          : "none",
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

      {/* Court-inspired rings give the wheel a more bespoke pickleball arena
          character without affecting its paths, labels, or landed outcome. */}
      <circle cx={cx} cy={cy} r={R * 0.78} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.25" strokeDasharray="3 6" />
      <circle cx={cx} cy={cy} r={R * 0.36} fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="1.2" />
      <path d={`M ${cx - R * 0.52} ${cy} H ${cx + R * 0.52} M ${cx} ${cy - R * 0.52} V ${cy + R * 0.52}`} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

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

// ─── Rim lights (fixed, non-rotating bulbs around the wheel bezel) ──────────
// Sits outside the rotating <svg> as its own layer so the bulbs stay put
// while the wheel spins underneath them — like a real carnival prize wheel.

function WheelBulbs({ count, spinning }: { count: number; spinning: boolean }) {
  const bulbs = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return (
    <div aria-hidden className="absolute pointer-events-none" style={{ inset: -10 }}>
      {bulbs.map((i) => {
        const angle = (360 / count) * i;
        const rad = ((angle - 90) * Math.PI) / 180;
        const radius = 50; // % of container
        const x = 50 + radius * Math.cos(rad);
        const y = 50 + radius * Math.sin(rad);
        // Chase effect: bulbs light in sequence around the ring. Speeds up
        // dramatically while spinning, settles to a lazy twinkle at rest.
        const delay = (i / count) * (spinning ? 0.9 : 2.4);
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: 6,
              height: 6,
              transform: "translate(-50%, -50%)",
              background: "radial-gradient(circle, #fffdf5 0%, #FFD98A 45%, #F46036 100%)",
              boxShadow: "0 0 5px rgba(244,96,54,0.85), 0 0 1.5px rgba(255,255,255,0.95)",
              animation: reducedMotion
                ? "none"
                : `bulb-twinkle ${spinning ? "0.9s" : "2.4s"} ease-in-out ${delay}s infinite`,
              opacity: reducedMotion ? 0.75 : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Simple status card for empty/error states (link-not-found, disabled) ──

function StatusCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto rounded-[1.75rem] spin-arena px-7 py-10 text-center wizard-step">
      <div aria-hidden className="spin-arena__court" />
      <div className="relative">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/10 border border-white/15 mb-4">
          <PaddleIcon className="h-6 w-6 text-white/70" />
        </span>
        <h1 className="font-display font-700 text-xl text-white mb-2">{title}</h1>
        <p className="text-white/60 text-sm leading-relaxed">{children}</p>
      </div>
    </div>
  );
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
  const [settling, setSettling] = useState(false);
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

  // Harmonised colours computed once here and shared by both the wheel
  // wedges and the legend swatches, so they're always guaranteed to match.
  const harmonizedColors = useMemo(
    () => harmonizeWedgeColors(prizes.map((p) => p.color || "#888888")),
    [prizes]
  );

  async function handleSpin() {
    if (spinning || alreadySpun || prizes.length === 0) return;
    setError(null);
    setSpinning(true);
    setLanded(false);

    const SPIN_MS = 4600;
    const SETTLE_MS = 340;
    // How far past the target the wheel overshoots before settling back —
    // a small fraction of a wedge, so it always overshoots into the correct
    // wedge rather than skipping into the next one.
    const OVERSHOOT_DEG = Math.min(10, wedgeAngle * 0.22);

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
      setSettling(false);

      let restRotation = 0; // captured for the settle-back phase below
      setRotation((prev) => {
        // Bring prev to a clean multiple of 360 so the maths is simple, then
        // add the exact target angle plus extra full spins, plus a small
        // overshoot so the landing has some physical "give" to settle back
        // from — a wheel that just stops dead reads as fake.
        const prevBase = prev - ((prev % 360) + 360) % 360;
        restRotation = prevBase + extraSpins + targetRotation + jitter;
        return restRotation + OVERSHOOT_DEG;
      });

      window.setTimeout(() => {
        stopSpinSoundRef.current?.();
        setSpinning(false);
        // Snap back from the overshoot with a springy little bounce.
        setSettling(true);
        setRotation(restRotation);

        window.setTimeout(() => {
          setSettling(false);
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
            discountExpiresAt: data.discountExpiresAt ?? null,
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
        }, SETTLE_MS);
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

      {/* ── Ambient glow behind the page header ── */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden -z-0">
        <div className="absolute left-1/2 top-[-140px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-court-orange/14 blur-[100px]" />
        <div className="absolute left-[6%] top-[40px] h-[220px] w-[220px] rounded-full bg-court-blue/18 blur-[70px]" />
      </div>

      <main className="flex-1 w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 relative">

        {/* ── Loading ── */}
        {loading ? (
          <div className="max-w-md mx-auto rounded-[1.75rem] spin-arena px-7 py-14 text-center">
            <div className="mx-auto h-11 w-11 rounded-full border-4 border-white/15 border-t-court-orange animate-spin mb-4" />
            <p className="text-white/55 text-sm">Loading your spin…</p>
          </div>

        ) : notFound ? (
          <StatusCard title="Link not found">
            This spin link is invalid or has expired. If you think this is a mistake, please contact us directly.
          </StatusCard>

        ) : !enabled && !alreadySpun ? (
          <StatusCard title="Not available right now">
            The spin wheel is temporarily unavailable. Please check back later — your link will still be here.
          </StatusCard>

        ) : (
          <div className="max-w-lg mx-auto">
            {isTest && (
              <div className="mb-5 flex items-center gap-1.5 rounded-full bg-court-ink text-white text-[11px] font-bold uppercase tracking-wide px-4 py-1.5 wizard-step mx-auto w-fit">
                <span className="h-1.5 w-1.5 rounded-full bg-court-orange animate-pulse" />
                Test mode — this spin won&apos;t be seen by real customers
              </div>
            )}

            {/* ── Header ── */}
            <div className="text-center mb-6 wizard-step">
              <span
                className="relative inline-flex items-center justify-center rounded-full bg-gradient-to-br from-court-orange-light via-court-orange to-court-orange-dark mb-4 shadow-court-lg animate-soft-float"
                style={{ width: 56, height: 56 }}
              >
                <span aria-hidden className="absolute inset-0 rounded-full ring-4 ring-white/40" />
                <PaddleIcon className="h-7 w-7 text-white relative" />
              </span>
              <h1 className="font-display font-700 text-[1.7rem] sm:text-3xl text-court-ink leading-tight">
                {alreadySpun
                  ? "Your spin result"
                  : `Spin the wheel, ${customerName.split(" ")[0] || "there"}!`}
              </h1>
              <p className="text-court-ink/55 text-sm mt-2">
                {alreadySpun
                  ? "You've already used your one spin — here's what you landed on."
                  : "One spin, one shot at a discount. Good luck out there! 🎯"}
              </p>
            </div>

            {/* ── Arena: a dark, under-the-lights stage that puts the wheel
                 front and center — no side legend competing for attention,
                 just the moment of the spin. ── */}
            <div className="spin-arena spin-arena--premium relative mx-auto px-6 pt-11 pb-8 sm:px-10 sm:pt-12 sm:pb-9 wizard-step">
              <div aria-hidden className="spin-arena__court" />
              <div aria-hidden className="spin-arena__sweep" />
              <div aria-hidden className="spin-arena__net" />
              <div aria-hidden className="spin-arena__scoreboard" />

              <div className="relative flex flex-col items-center">
                {/* ── Wheel container ── */}
                  <div
                    className={`spin-wheel-stage relative mx-auto mb-8 ${spinning ? "spin-wheel-stage--spinning" : ""} ${landed ? "spin-wheel-stage--landed" : ""}`}
                    style={{ width: "min(360px, 78vw, 100%)", aspectRatio: "1 / 1" }}
                  >
                  <span aria-hidden className="spin-wheel-stage__orbit spin-wheel-stage__orbit--outer" />
                  <span aria-hidden className="spin-wheel-stage__orbit spin-wheel-stage__orbit--inner" />
                  {/* Fixed rim light bulbs — do not rotate with the wheel */}
                  <WheelBulbs count={prizes.length > 0 ? Math.max(12, prizes.length * 3) : 16} spinning={spinning} />

                  {/* Rotating halo when idle — gives the wheel a "live" feel */}
                  {!alreadySpun && !spinning && (
                    <div
                      aria-hidden
                      className="spin-wheel-glow absolute rounded-full pointer-events-none"
                      style={{
                        inset: -13,
                        background:
                          "conic-gradient(from 0deg, rgba(244,96,54,0.42), rgba(108,212,255,0.36), rgba(244,96,54,0.42))",
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
                        boxShadow: "0 0 28px rgba(244,96,54,0.5)",
                        animation: "ping 0.55s ease-out forwards",
                      }}
                    />
                  )}

                  {/* ── Pointer ── nicer SVG arrow */}
                  <div
                    aria-hidden
                    className={`spin-wheel-pointer absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none ${landed ? "spin-pointer-bounce" : ""}`}
                    style={{ top: -18, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.45))" }}
                  >
                    <svg width="30" height="38" viewBox="0 0 30 38">
                      <defs>
                        <linearGradient id="ptr" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FF7043" />
                          <stop offset="100%" stopColor="#BF360C" />
                        </linearGradient>
                      </defs>
                      <polygon points="1,3 29,3 15,37" fill="rgba(0,0,0,0.25)" transform="translate(1,2)" />
                      <polygon points="1,3 29,3 15,37" fill="url(#ptr)" />
                      <polygon points="1,3 15,37 15,14" fill="rgba(255,255,255,0.22)" />
                      <circle cx="15" cy="6" r="6.5" fill="white" />
                      <circle cx="15" cy="6" r="3.8" fill="#F46036" />
                    </svg>
                  </div>

                  {/* ── SVG Wheel ── */}
                  <div style={{ width: "100%", height: "100%" }}>
                    <WheelSVG
                      prizes={prizes}
                      rotation={rotation}
                      spinning={spinning}
                      settling={settling}
                      landed={landed}
                      winningIndex={winningIndex}
                      colors={harmonizedColors}
                    />
                  </div>

                  {/* ── Hub cap ── */}
                  <div className="absolute inset-0 grid place-items-center pointer-events-none">
                    <span
                      className="spin-wheel-hub flex items-center justify-center rounded-full bg-white border-2 border-white/70"
                      style={{
                        width: 44,
                        height: 44,
                        boxShadow: "0 3px 14px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.9)",
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
                  <div className="text-center">
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
                          : "0 10px 32px rgba(244,96,54,0.5), 0 2px 8px rgba(244,96,54,0.3)",
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
                          <span className="flex items-center gap-2.5">
                            <PaddleIcon className="h-5 w-5" />
                            Serve your spin
                          </span>
                        )}
                      </span>
                    </button>
                    {prizes.length === 0 && (
                      <p className="text-xs text-white/45 mt-3">No prizes are set up yet — check back soon.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Result ticket ── */}
            {showResultCard && result && (
              <div
                className={`spin-ticket spin-ticket--premium max-w-md mx-auto mt-8 shadow-court-lg text-center wizard-step relative overflow-hidden ${
                  result.won ? "spin-ticket--won" : "spin-ticket--lost"
                }`}
              >
                {/* Watermark ball graphic */}
                <BallIcon
                  aria-hidden
                  className={`absolute -right-5 -top-5 h-28 w-28 pointer-events-none ${
                    result.won ? "text-court-orange/10" : "text-court-ink/[0.06]"
                  }`}
                />

                {result.won ? (
                  <>
                    <div className="relative px-6 pt-6 sm:px-8 sm:pt-7">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-court-orange/10 text-court-orange-dark text-[11px] font-bold uppercase tracking-wide px-3 py-1">
                        <BallIcon className="h-3.5 w-3.5" /> Match point — you scored
                      </span>
                      <p className="font-display font-700 text-2xl sm:text-[1.7rem] text-court-ink mt-3 mb-0.5">
                        You won!
                      </p>
                      <p className="text-court-ink/60 text-sm font-medium">{result.prizeLabel}</p>
                    </div>

                    <div className="spin-ticket__divider my-6">
                      <span className="spin-ticket__divider-dot">
                        <BallIcon className="h-3.5 w-3.5 text-white" />
                      </span>
                    </div>

                    <div className="relative px-6 pb-6 sm:px-8 sm:pb-7">
                      <button
                        onClick={copyCode}
                        title="Tap to copy"
                        className="prize-code-pop focus-ring group relative inline-flex items-center gap-3 rounded-2xl px-6 py-4 font-mono text-lg sm:text-xl font-bold tracking-widest transition-all hover:scale-[1.03] active:scale-95"
                        style={{
                          background: "linear-gradient(135deg, rgba(244,96,54,0.08), rgba(244,96,54,0.03))",
                          border: "2.5px dashed rgba(244,96,54,0.5)",
                          color: "rgb(var(--color-orange-dark))",
                          boxShadow: "0 4px 18px rgba(244,96,54,0.12)",
                        }}
                      >
                        <span>{result.discountCode}</span>
                        <span
                          className="text-[10px] font-sans font-bold uppercase tracking-wide px-2 py-1 rounded-full transition-colors"
                          style={{
                            background: copied ? "rgba(34,197,94,0.15)" : "rgba(244,96,54,0.1)",
                            color: copied ? "rgb(22,163,74)" : "rgba(214,73,31,0.72)",
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

                      {result.discountExpiresAt && (
                        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium px-3 py-1.5">
                          ⏰ Valid until {fmtExpiry(result.discountExpiresAt)}
                        </p>
                      )}

                      <a
                        href="/book"
                        className="focus-ring mt-5 inline-flex items-center gap-2 rounded-full border-2 border-court-ink/10 bg-white text-court-ink font-display font-700 text-sm px-6 py-2.5 shadow-court hover:border-court-orange/30 transition-colors"
                      >
                        <PaddleIcon className="h-4 w-4 text-court-orange" />
                        Book your next game
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="relative px-6 py-7 sm:px-8">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-court-ink/[0.06] mb-4">
                      <PaddleIcon className="h-6 w-6 text-court-ink/45" />
                    </span>
                    <p className="font-display font-700 text-xl text-court-ink mb-2">
                      {result.prizeLabel}
                    </p>
                    <p className="text-court-ink/55 text-sm leading-relaxed mb-5">
                      No discount this time — thanks for playing!
                      <br />
                      Hope to see you back on the court soon. 🏓
                    </p>
                    <a
                      href="/book"
                      className="focus-ring inline-flex items-center gap-2 rounded-full bg-court-ink text-white font-display font-700 text-sm px-6 py-2.5 shadow-court hover:opacity-90 transition-opacity"
                    >
                      <PaddleIcon className="h-4 w-4" />
                      Book a session anyway
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
