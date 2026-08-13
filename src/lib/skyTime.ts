// ---------------------------------------------------------------------------
// Sky cycle engine — Day / Sunset / Night / Sunrise, driven by Philippine
// (Asia/Manila) time.
//
// Everything here is pure and framework-free: it models the whole cycle as a
// single continuous number, "minutes since Manila midnight" (0–1440), and
// derives phase, colors, and sun/moon position from it. That means the exact
// same math drives the real-time clock (auto mode) and the fast-forward
// preview animation (manual toggle) — the preview is just this function
// evaluated many times as a virtual clock sweeps forward.
// ---------------------------------------------------------------------------

import { toZonedTime } from "date-fns-tz";

export const MANILA_TZ = "Asia/Manila";

export type SkyPhase = "sunrise" | "day" | "sunset" | "night";
export type RGB = [number, number, number];

// Phase boundaries, in minutes since Manila midnight.
export const SUNRISE_START = 5 * 60; // 5:00 AM
export const DAY_START = 6 * 60; // 6:00 AM
export const SUNSET_START = 17 * 60 + 30; // 5:30 PM
export const NIGHT_START = 18 * 60 + 30; // 6:30 PM
// Night runs 6:30 PM -> 5:00 AM, wrapping past midnight.

export function minutesSinceManilaMidnight(date: Date = new Date()): number {
  const zoned = toZonedTime(date, MANILA_TZ);
  return zoned.getHours() * 60 + zoned.getMinutes() + zoned.getSeconds() / 60;
}

export function phaseForMinutes(minutes: number): SkyPhase {
  const m = wrap(minutes);
  if (m >= SUNRISE_START && m < DAY_START) return "sunrise";
  if (m >= DAY_START && m < SUNSET_START) return "day";
  if (m >= SUNSET_START && m < NIGHT_START) return "sunset";
  return "night";
}

// 0-1 progress through whichever phase `minutes` falls in.
export function phaseProgress(minutes: number): number {
  const m = wrap(minutes);
  const phase = phaseForMinutes(m);
  if (phase === "sunrise") return (m - SUNRISE_START) / (DAY_START - SUNRISE_START);
  if (phase === "day") return (m - DAY_START) / (SUNSET_START - DAY_START);
  if (phase === "sunset") return (m - SUNSET_START) / (NIGHT_START - SUNSET_START);
  const nightLen = 1440 - NIGHT_START + SUNRISE_START;
  const into = m >= NIGHT_START ? m - NIGHT_START : m + (1440 - NIGHT_START);
  return into / nightLen;
}

export const PHASE_META: Record<SkyPhase, { label: string; icon: string }> = {
  sunrise: { label: "Sunrise", icon: "🌄" },
  day: { label: "Day", icon: "☀️" },
  sunset: { label: "Sunset", icon: "🌇" },
  night: { label: "Night", icon: "🌙" },
};

// The two "resting" points the manual Day/Night toggle settles into —
// solar-noon-ish and deep-night-ish, each safely mid-span so the toggle
// never lands right on a transition edge.
export const SETTLE_MINUTES: Record<"day" | "night", number> = {
  day: (DAY_START + SUNSET_START) / 2,
  night: wrap((NIGHT_START + 1440 + SUNRISE_START) / 2),
};

export function sideForPhase(phase: SkyPhase): "day" | "night" {
  return phase === "sunrise" || phase === "day" ? "day" : "night";
}

export function formatMinutesClock(minutes: number): string {
  const m = wrap(minutes);
  let h = Math.floor(m / 60);
  const min = Math.floor(m % 60);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(min).padStart(2, "0")} ${ampm}`;
}

// ---------------------------------------------------------------------------
// Visuals: sky gradient + sun/moon arc + star opacity, all as a function of
// the same `minutes` value.
// ---------------------------------------------------------------------------

export interface SkyVisual {
  top: RGB;
  bottom: RGB;
  sun: { left: number; top: number; opacity: number };
  moon: { left: number; top: number; opacity: number };
  starOpacity: number;
}

const NIGHT_PALETTE: { top: RGB; bottom: RGB } = { top: [9, 12, 40], bottom: [23, 29, 68] };
const DAWN_GLOW: { top: RGB; bottom: RGB } = { top: [255, 176, 120], bottom: [255, 134, 150] };
const DAY_PALETTE: { top: RGB; bottom: RGB } = { top: [86, 186, 255], bottom: [186, 228, 255] };
const DUSK_GLOW: { top: RGB; bottom: RGB } = { top: [255, 116, 84], bottom: [138, 62, 128] };

function paletteFor(phase: SkyPhase, progress: number): { top: RGB; bottom: RGB } {
  if (phase === "day") return DAY_PALETTE;
  if (phase === "night") return NIGHT_PALETTE;
  if (phase === "sunrise") {
    return progress < 0.5
      ? {
          top: lerpColor(NIGHT_PALETTE.top, DAWN_GLOW.top, progress / 0.5),
          bottom: lerpColor(NIGHT_PALETTE.bottom, DAWN_GLOW.bottom, progress / 0.5),
        }
      : {
          top: lerpColor(DAWN_GLOW.top, DAY_PALETTE.top, (progress - 0.5) / 0.5),
          bottom: lerpColor(DAWN_GLOW.bottom, DAY_PALETTE.bottom, (progress - 0.5) / 0.5),
        };
  }
  // sunset
  return progress < 0.5
    ? {
        top: lerpColor(DAY_PALETTE.top, DUSK_GLOW.top, progress / 0.5),
        bottom: lerpColor(DAY_PALETTE.bottom, DUSK_GLOW.bottom, progress / 0.5),
      }
    : {
        top: lerpColor(DUSK_GLOW.top, NIGHT_PALETTE.top, (progress - 0.5) / 0.5),
        bottom: lerpColor(DUSK_GLOW.bottom, NIGHT_PALETTE.bottom, (progress - 0.5) / 0.5),
      };
}

// Arc across the sky for a 0-1 span position: rises from one horizon,
// peaks near the middle, sets at the other horizon, softly fading at edges.
function arcPosition(t: number) {
  const clamped = clamp(t, 0, 1);
  const left = 6 + clamped * 88;
  const top = 80 - Math.sin(clamped * Math.PI) * 64;
  const edge = Math.min(1, clamped / 0.08, (1 - clamped) / 0.08);
  return { left, top, edge: Math.max(0, edge) };
}

export function skyVisualForMinutes(minutes: number): SkyVisual {
  const m = wrap(minutes);
  const phase = phaseForMinutes(m);
  const progress = phaseProgress(m);
  const { top, bottom } = paletteFor(phase, progress);

  // Sun is up across sunrise -> day -> sunset (5:00 AM – 6:30 PM).
  const sunSpan = NIGHT_START - SUNRISE_START;
  const sunT = (m - SUNRISE_START) / sunSpan;
  const sunArc = arcPosition(sunT);
  const sunVisible = m >= SUNRISE_START && m < NIGHT_START;

  // Moon is up across sunset -> night -> sunrise (6:30 PM – 5:00 AM), wrapping midnight.
  const moonSpanLen = 1440 - NIGHT_START + SUNRISE_START;
  const unwrapped = m >= NIGHT_START ? m - NIGHT_START : m + (1440 - NIGHT_START);
  const moonT = unwrapped / moonSpanLen;
  const moonArc = arcPosition(moonT);
  const moonVisible = !sunVisible;

  const starOpacity =
    phase === "night"
      ? 1
      : phase === "sunset"
        ? smoothstep(0.35, 1, progress)
        : phase === "sunrise"
          ? 1 - smoothstep(0, 0.55, progress)
          : 0;

  return {
    top,
    bottom,
    sun: { left: sunArc.left, top: sunArc.top, opacity: sunVisible ? sunArc.edge : 0 },
    moon: { left: moonArc.left, top: moonArc.top, opacity: moonVisible ? moonArc.edge : 0 },
    starOpacity,
  };
}

// ---------------------------------------------------------------------------
// small math helpers
// ---------------------------------------------------------------------------

function wrap(minutes: number): number {
  return ((minutes % 1440) + 1440) % 1440;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function rgbCss(c: RGB): string {
  return `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;
}
