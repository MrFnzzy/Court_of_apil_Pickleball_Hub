"use client";

// Drives the single source of truth for the day/night sky: a "minutes since
// Manila midnight" value that is either (a) tracking the real clock (auto),
// (b) pinned to a settled Day/Night resting point (manual), or (c) sweeping
// through a fast-forward preview animation between the two.
//
// Idle updates are throttled to a low-frequency interval — the sky drifts
// slowly, so there is no need to re-render on every animation frame. The
// preview animation is the one time we want silky-smooth motion, so it runs
// on requestAnimationFrame for its ~4s duration.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  formatMinutesClock,
  minutesSinceManilaMidnight,
  phaseForMinutes,
  phaseProgress,
  sideForPhase,
  SETTLE_MINUTES,
  type SkyPhase,
} from "@/lib/skyTime";

type SkyMode = "auto" | "manual";

type SkyContextValue = {
  minutes: number;
  phase: SkyPhase;
  progress: number;
  mode: SkyMode;
  manualSide: "day" | "night" | null;
  isAnimating: boolean;
  statusLabel: string;
  toggleDayNight: () => void;
  setMode: (mode: SkyMode) => void;
};

const SkyContext = createContext<SkyContextValue | null>(null);

const STORAGE_KEY = "pbhub-sky-preference";
const PREVIEW_DURATION_MS = 4200;
const IDLE_UPDATE_MS = 6000;

export function useSky(): SkyContextValue {
  const ctx = useContext(SkyContext);
  if (!ctx) throw new Error("useSky must be used within <SkyProvider>");
  return ctx;
}

export default function SkyProvider({
  initialMinutes,
  children,
}: {
  initialMinutes: number;
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<SkyMode>("auto");
  const [manualSide, setManualSide] = useState<"day" | "night" | null>(null);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [isAnimating, setIsAnimating] = useState(false);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const minutesRef = useRef(minutes);
  minutesRef.current = minutes;
  const animRef = useRef<{ from: number; forward: number; to: number; start: number } | null>(null);
  const reducedMotionRef = useRef(false);
  const hydrated = useRef(false);

  // Pick up any saved preference on mount. Server-rendered markup always
  // shows the real auto phase (see layout.tsx), so this only matters for
  // returning visitors who had picked Manual — the swap happens as part of
  // the initial hydration pass, not as a visible post-load flash.
  useEffect(() => {
    reducedMotionRef.current =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { mode: SkyMode; side?: "day" | "night" };
        if (saved.mode === "manual" && (saved.side === "day" || saved.side === "night")) {
          setModeState("manual");
          setManualSide(saved.side);
          setMinutes(SETTLE_MINUTES[saved.side]);
        }
      }
    } catch {
      // corrupt/unavailable storage — fall back to auto silently
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      if (mode === "manual" && manualSide) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, side: manualSide }));
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "auto" }));
      }
    } catch {
      // ignore
    }
  }, [mode, manualSide]);

  const runPreviewFrame = useCallback(() => {
    const anim = animRef.current;
    if (!anim) return;
    const now = performance.now();
    const t = Math.min(1, (now - anim.start) / PREVIEW_DURATION_MS);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    setMinutes((anim.from + eased * anim.forward) % 1440);
    if (t >= 1) {
      animRef.current = null;
      setMinutes(anim.to);
      setIsAnimating(false);
      return;
    }
    requestAnimationFrame(runPreviewFrame);
  }, []);

  const runPreview = useCallback(
    (to: number) => {
      const from = minutesRef.current;
      const forward = ((to - from) % 1440 + 1440) % 1440 || 1440;
      if (reducedMotionRef.current) {
        setMinutes(to);
        return;
      }
      setIsAnimating(true);
      animRef.current = { from, forward, to, start: performance.now() };
      requestAnimationFrame(runPreviewFrame);
    },
    [runPreviewFrame]
  );

  // Low-frequency idle loop that keeps `minutes` tracking the real clock
  // while in auto mode. Skipped entirely while a preview animation owns the
  // updates.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (animRef.current) return;
      if (modeRef.current === "auto") setMinutes(minutesSinceManilaMidnight());
    }, IDLE_UPDATE_MS);
    return () => window.clearInterval(id);
  }, []);

  const toggleDayNight = useCallback(() => {
    const currentSide: "day" | "night" =
      modeRef.current === "manual" && manualSide ? manualSide : sideForPhase(phaseForMinutes(minutesRef.current));
    const target: "day" | "night" = currentSide === "day" ? "night" : "day";
    runPreview(SETTLE_MINUTES[target]);
    setModeState("manual");
    setManualSide(target);
  }, [manualSide, runPreview]);

  const setMode = useCallback(
    (next: SkyMode) => {
      if (next === "auto") {
        setModeState("auto");
        setManualSide(null);
        runPreview(minutesSinceManilaMidnight());
      } else {
        const target = sideForPhase(phaseForMinutes(minutesRef.current));
        setModeState("manual");
        setManualSide(target);
      }
    },
    [runPreview]
  );

  const phase = phaseForMinutes(minutes);
  const progress = phaseProgress(minutes);

  const statusLabel = useMemo(() => {
    const label = phase.charAt(0).toUpperCase() + phase.slice(1);
    if (mode === "manual" && !isAnimating) return `${label} • Manual`;
    return `${label} • ${formatMinutesClock(minutes)}`;
  }, [phase, mode, isAnimating, minutes]);

  const value: SkyContextValue = {
    minutes,
    phase,
    progress,
    mode,
    manualSide,
    isAnimating,
    statusLabel,
    toggleDayNight,
    setMode,
  };

  return <SkyContext.Provider value={value}>{children}</SkyContext.Provider>;
}
