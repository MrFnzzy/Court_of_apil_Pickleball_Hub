"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Cinematic "promo code applied" success animation.
 *
 * Plays once, anchored to two *real* DOM elements on the booking page:
 *  - `originRef`  — the promo code box (where the code gets "absorbed")
 *  - `targetRef`  — the total price the discount slices into (Order Summary)
 *
 * The energy sphere / dagger / slash is pure CSS (transform + opacity only,
 * per the perf spec), driven by a small phase state machine so timing is
 * easy to read and tune. The actual React total (`toLabel`) has already
 * updated underneath by the time this mounts — this component only draws a
 * "ghost" copy of the old total on top of it, so the real DOM/layout is
 * never touched and nothing here can desync the booking state.
 *
 * No audio files — sounds are synthesized with the Web Audio API, matching
 * the pattern used elsewhere in the app (see InteractionFX / spin page) and
 * the same "heidesPickleballHub.soundEnabled" mute preference.
 */

const SOUND_KEY = "heidesPickleballHub.soundEnabled";

function isSoundOn() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

// Phase start times (ms), tuned to land the whole sequence at ~6.6s —
// comfortably inside the 5–8s target window.
const T_ACTIVATE = 0; // code glows + compresses into an orb
const T_FLIGHT = 950; // orb launches toward the total
const T_GHOST_LIFT = 1650; // current total starts lifting/enlarging
const T_MORPH = 2200; // orb morphs into the energy dagger
const T_SLASH = 3350; // the slash attack + ZING
const T_REVEAL = 3900; // sliced halves fall away, discount fades in
const T_SETTLE = 5100; // discounted total glides into place, sparkles
const T_FADE = 6200; // whole overlay fades out
const T_DONE = 6600; // unmount, hand back to real DOM

type Rect = { left: number; top: number; width: number; height: number };

function rectOf(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

// ─── Sound design (all synthesized, no audio files) ─────────────────────────

function tone(
  ctx: AudioContext,
  time: number,
  opts: {
    freq: number;
    freqTo?: number;
    type?: OscillatorType;
    dur: number;
    vol: number;
    attack?: number;
  }
) {
  const { freq, freqTo, type = "sine", dur, vol, attack = 0.008 } = opts;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  if (freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 1), time + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(vol, time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + dur + 0.02);
}

function noiseBurst(
  ctx: AudioContext,
  time: number,
  opts: { dur: number; freq: number; freqTo?: number; q?: number; vol: number; type?: BiquadFilterType }
) {
  const { dur, freq, freqTo, q = 1.1, vol, type = "bandpass" } = opts;
  const buf = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-6 * (t / dur));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, time);
  if (freqTo) filter.frequency.exponentialRampToValueAtTime(freqTo, time + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(time);
  src.stop(time + dur + 0.02);
}

/** The signature moment: a bright, crisp metallic "ZING". */
function playZing(ctx: AudioContext, time: number) {
  // Fast downward sweep for the "swing"
  tone(ctx, time, { freq: 2600, freqTo: 500, type: "sawtooth", dur: 0.11, vol: 0.16, attack: 0.002 });
  // Bright metallic ring
  tone(ctx, time + 0.01, { freq: 3400, freqTo: 2000, type: "triangle", dur: 0.22, vol: 0.14, attack: 0.002 });
  tone(ctx, time + 0.01, { freq: 5200, freqTo: 3100, type: "sine", dur: 0.16, vol: 0.09, attack: 0.002 });
  // Impact noise
  noiseBurst(ctx, time + 0.015, { dur: 0.2, freq: 3800, freqTo: 900, q: 0.9, vol: 0.22 });
}

function playChimeNote(ctx: AudioContext, time: number, freq: number, vol = 0.11) {
  tone(ctx, time, { freq, type: "sine", dur: 0.55, vol, attack: 0.01 });
  tone(ctx, time, { freq: freq * 2, type: "sine", dur: 0.3, vol: vol * 0.35, attack: 0.01 });
}

function playPromoSequence() {
  if (!isSoundOn() || typeof window === "undefined") return;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  const ctx: AudioContext = new AC();
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime + 0.02;
  const at = (ms: number) => now + ms / 1000;

  // Phase 1 — activation + liquid engulf + orb wobble
  tone(ctx, at(T_ACTIVATE), { freq: 260, freqTo: 640, type: "sine", dur: 0.3, vol: 0.09 });
  noiseBurst(ctx, at(T_ACTIVATE + 60), { dur: 0.35, freq: 700, freqTo: 1400, vol: 0.07 });
  tone(ctx, at(T_ACTIVATE + 700), { freq: 520, freqTo: 420, type: "triangle", dur: 0.14, vol: 0.08 });

  // Phase 2 — whoosh + hover hum
  noiseBurst(ctx, at(T_FLIGHT), { dur: 0.55, freq: 300, freqTo: 2000, q: 0.7, vol: 0.1 });
  tone(ctx, at(T_GHOST_LIFT), { freq: 700, type: "sine", dur: 0.6, vol: 0.05 });

  // Phase 3 — price lift
  tone(ctx, at(T_GHOST_LIFT + 80), { freq: 500, freqTo: 900, type: "sine", dur: 0.4, vol: 0.06 });

  // Phase 4 — energy charging into the dagger
  tone(ctx, at(T_MORPH), { freq: 200, freqTo: 780, type: "sawtooth", dur: 1.0, vol: 0.05 });
  noiseBurst(ctx, at(T_MORPH + 850), { dur: 0.18, freq: 1600, vol: 0.08, q: 3 });

  // Phase 5 — the slash + ZING (the emotional highlight)
  playZing(ctx, at(T_SLASH));

  // Phase 6 — slice separation + magical reveal shimmer
  noiseBurst(ctx, at(T_SLASH + 120), { dur: 0.08, freq: 2200, vol: 0.05, q: 4 });
  noiseBurst(ctx, at(T_SLASH + 230), { dur: 0.08, freq: 1800, vol: 0.04, q: 4 });
  [0, 90, 170].forEach((d, i) => playChimeNote(ctx, at(T_REVEAL + 200 + d), 780 + i * 180, 0.06));

  // Phase 7 — settle: confirmation chime + sparkle
  playChimeNote(ctx, at(T_SETTLE + 550), 660, 0.1);
  playChimeNote(ctx, at(T_SETTLE + 650), 990, 0.09);
  noiseBurst(ctx, at(T_SETTLE + 600), { dur: 0.3, freq: 3000, freqTo: 5500, vol: 0.04, q: 0.8 });

  window.setTimeout(() => ctx.close().catch(() => {}), T_DONE + 400);
}

// ─── Component ────────────────────────────────────────────────────────────

export type PromoSuccessAnimationProps = {
  /** Bumping this key starts (or restarts) the sequence. */
  runId: number | string;
  /**
   * Refs, not elements. The target total often re-mounts (it's keyed by
   * value for its own pulse animation) in the very same render that mounts
   * this component, so reading `.current` at parent-render time can capture
   * a node that's about to be replaced. Reading it inside this component's
   * own effect — which runs after commit — always sees the live node.
   */
  originRef: React.RefObject<HTMLElement>;
  targetRef: React.RefObject<HTMLElement>;
  /** Old total, formatted for display, e.g. "₱470" */
  fromLabel: string;
  /** New (discounted) total, formatted for display, e.g. "₱446" */
  toLabel: string;
  onComplete: () => void;
};

type Phase = "idle" | "activate" | "flight" | "morph" | "slash" | "reveal" | "settle" | "fade";

export default function PromoSuccessAnimation({
  runId,
  originRef,
  targetRef,
  fromLabel,
  toLabel,
  onComplete,
}: PromoSuccessAnimationProps) {
  const [phase, setPhase] = useState<Phase>("activate");
  const [ghostLifted, setGhostLifted] = useState(false);
  const rectsRef = useRef<{ origin: Rect; target: Rect } | null>(null);
  const reducedMotionRef = useRef(false);
  const completedRef = useRef(false);

  // Snapshot geometry + reduced-motion once per run, and play sound once.
  useEffect(() => {
    completedRef.current = false;
    const origin = rectOf(originRef.current);
    const target = rectOf(targetRef.current);
    rectsRef.current = origin && target ? { origin, target } : null;
    reducedMotionRef.current =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const finish = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete();
    };

    if (reducedMotionRef.current || !rectsRef.current) {
      // Simplified path: quick fade + the number swap. Prices are already
      // correct in the real DOM — this just gives a brief, calm confirmation.
      setPhase("fade");
      if (isSoundOn()) {
        try {
          const AC = window.AudioContext || (window as any).webkitAudioContext;
          if (AC) {
            const ctx: AudioContext = new AC();
            playChimeNote(ctx, ctx.currentTime + 0.02, 720, 0.09);
            window.setTimeout(() => ctx.close().catch(() => {}), 700);
          }
        } catch {
          // ignore
        }
      }
      const t = window.setTimeout(finish, 550);
      return () => window.clearTimeout(t);
    }

    playPromoSequence();

    const timers: number[] = [];
    timers.push(window.setTimeout(() => setPhase("flight"), T_FLIGHT));
    timers.push(window.setTimeout(() => setGhostLifted(true), T_GHOST_LIFT));
    timers.push(window.setTimeout(() => setPhase("morph"), T_MORPH));
    timers.push(window.setTimeout(() => setPhase("slash"), T_SLASH));
    timers.push(window.setTimeout(() => setPhase("reveal"), T_REVEAL));
    timers.push(window.setTimeout(() => setPhase("settle"), T_SETTLE));
    timers.push(window.setTimeout(() => setPhase("fade"), T_FADE));
    timers.push(window.setTimeout(finish, T_DONE));

    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const sparks = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => ({
        angle: (i / 10) * 360 + Math.random() * 20,
        dist: 26 + Math.random() * 22,
        delay: Math.random() * 40,
        size: 3 + Math.random() * 3,
      })),
    [runId]
  );
  const sparkles = useMemo(
    () =>
      Array.from({ length: 8 }).map((_, i) => ({
        angle: (i / 8) * 360 + Math.random() * 25,
        dist: 20 + Math.random() * 26,
        delay: Math.random() * 120,
      })),
    [runId]
  );

  const rects = rectsRef.current;
  if (!rects || reducedMotionRef.current) {
    // Reduced-motion / no-geometry fallback renders nothing visual — the
    // real total's existing pulse animation is enough of a confirmation.
    return null;
  }

  const { origin, target } = rects;
  const originCenter = { x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 };
  const targetCenter = { x: target.left + target.width / 2, y: target.top + target.height / 2 };
  // Orb/dagger hovers just above-left of the total, per spec.
  const hoverPoint = { x: targetCenter.x - Math.min(56, target.width / 2 + 18), y: targetCenter.y - 34 };
  const dx = hoverPoint.x - originCenter.x;
  const dy = hoverPoint.y - originCenter.y;

  const showOrbWrap = phase === "activate" || phase === "flight";
  const showBlade = phase === "morph" || phase === "slash";
  const showHoverGlow = phase === "flight" || phase === "morph";
  const showGhostOld = phase !== "settle" && phase !== "fade";
  const showSlashFx = phase === "slash";
  const showSplit = phase === "reveal";
  const showDiscountGhost = phase === "reveal" || phase === "settle" || phase === "fade";
  const discountSharp = phase === "settle" || phase === "fade";
  const overlayFading = phase === "fade";

  return (
    <div
      className={`promo-fx-root fixed inset-0 z-[80] pointer-events-none ${
        showSlashFx ? "promo-fx-shake" : ""
      } ${overlayFading ? "promo-fx-fadeout" : ""}`}
      aria-hidden="true"
    >
      {/* Phase 1: activation glow at the promo box */}
      {phase === "activate" && (
        <span
          className="promo-fx-activate-glow"
          style={{ left: originCenter.x, top: originCenter.y }}
        />
      )}

      {/* Orb: travels from the promo box to just above the total */}
      {showOrbWrap && (
        <div
          className={`promo-fx-orb-wrap ${phase === "flight" ? "promo-fx-orb-flight" : ""}`}
          style={
            {
              left: originCenter.x,
              top: originCenter.y,
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
            } as React.CSSProperties
          }
        >
          <span className={`promo-fx-orb ${phase === "activate" ? "promo-fx-orb-wiggle" : "promo-fx-orb-hover"}`} />
        </div>
      )}

      {/* Dagger: sits where the orb arrived (same resting point, no jump), morphs, then slashes */}
      {showBlade && (
        <div
          className="promo-fx-orb-wrap"
          style={{
            left: originCenter.x,
            top: originCenter.y,
            transform: `translate3d(${dx}px, ${dy}px, 0)`,
          }}
        >
          {showHoverGlow && <span className="promo-fx-hover-glow" />}
          <span className={`promo-fx-dagger ${phase === "morph" ? "promo-fx-dagger-form" : "promo-fx-dagger-slash"}`} />
        </div>
      )}

      {/* Impact sparks at the point of the slash */}
      {showSlashFx && (
        <>
          <span className="promo-fx-flash" style={{ left: targetCenter.x, top: targetCenter.y }} />
          {sparks.map((s, i) => (
            <span
              key={i}
              className="promo-fx-spark"
              style={
                {
                  left: targetCenter.x,
                  top: targetCenter.y,
                  "--spark-angle": `${s.angle}deg`,
                  "--spark-dist": `${s.dist}px`,
                  animationDelay: `${s.delay}ms`,
                  width: s.size,
                  height: s.size,
                } as React.CSSProperties
              }
            />
          ))}
        </>
      )}

      {/* The ghost total: masks the real number while it "gets sliced" */}
      <div
        className="promo-fx-ghost-wrap"
        style={{ left: target.left, top: target.top, width: target.width, height: target.height }}
      >
        {showGhostOld && !showSplit && (
          <span
            className={`promo-fx-ghost-total ${ghostLifted ? "promo-fx-ghost-lift" : ""} ${
              showSlashFx ? "promo-fx-ghost-hit" : ""
            }`}
          >
            {fromLabel}
          </span>
        )}
        {showSplit && (
          <>
            <span className="promo-fx-ghost-total promo-fx-ghost-half-a">{fromLabel}</span>
            <span className="promo-fx-ghost-total promo-fx-ghost-half-b">{fromLabel}</span>
          </>
        )}
        {showDiscountGhost && (
          <span className={`promo-fx-ghost-total promo-fx-ghost-discount ${discountSharp ? "promo-fx-ghost-sharp" : ""}`}>
            {toLabel}
          </span>
        )}
        {phase === "settle" &&
          sparkles.map((s, i) => (
            <span
              key={i}
              className="promo-fx-sparkle"
              style={
                {
                  "--spark-angle": `${s.angle}deg`,
                  "--spark-dist": `${s.dist}px`,
                  animationDelay: `${s.delay}ms`,
                } as React.CSSProperties
              }
            />
          ))}
      </div>
    </div>
  );
}
