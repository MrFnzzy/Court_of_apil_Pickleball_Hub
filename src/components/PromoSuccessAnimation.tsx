"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ModalPortal from "./ModalPortal";
import { FX, Rect, rectOf } from "@/lib/promoFxTiming";
import { playPromoFxSequence } from "@/lib/promoFxSound";

export interface PromoSuccessAnimationProps {
  /** Bounding rect of the promo box, captured *before* the applied-state
   * re-render (see book/page.tsx) — where the energy orb spawns from. */
  sourceRect: Rect;
  /** Ref to the real "Total to pay" value element — its rect (read after
   * the applied-state re-render, so it reflects final layout) is where
   * the whole price sequence plays out, and where this overlay masks the
   * real DOM until the reveal is complete. */
  targetRef: React.RefObject<HTMLElement>;
  /** Pre-discount total, formatted exactly as the real UI shows it (e.g. "₱470"). */
  oldTotalText: string;
  /** Post-discount total, formatted exactly as the real UI shows it (e.g. "₱423"). */
  newTotalText: string;
  /** Discount percentage (e.g. 12), used for the bonus "-12% OFF" ink-stamp badge. */
  percentage: number;
  /** Called once the sequence finishes (or immediately, in reduced-motion mode). */
  onDone: () => void;
}

type Particle = { id: number; delayMs: number; angleDeg: number; distPx: number; sizePx: number };

function makeParticles(count: number, seedScale = 1): Particle[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    delayMs: Math.random() * 90,
    angleDeg: (i / count) * 360 + (Math.random() - 0.5) * 26,
    distPx: (30 + Math.random() * 40) * seedScale,
    sizePx: 3 + Math.random() * 4,
  }));
}

export default function PromoSuccessAnimation({
  sourceRect,
  targetRef,
  oldTotalText,
  newTotalText,
  percentage,
  onDone,
}: PromoSuccessAnimationProps) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [priceStyle, setPriceStyle] = useState<React.CSSProperties>({});
  const finishedRef = useRef(false);

  // Reduced-motion: show a simplified version (quick fade + correct numbers),
  // never the full cinematic sequence.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
  }, []);

  // Read the target's final rect + computed text style after the applied
  // promo state has already committed (so it matches where the real total
  // will land), and finish immediately if there's nothing to anchor to.
  useEffect(() => {
    const el = targetRef.current;
    if (!el) {
      finish();
      return;
    }
    setTargetRect(rectOf(el));
    const cs = window.getComputedStyle(el);
    setPriceStyle({
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight as React.CSSProperties["fontWeight"],
      fontSize: cs.fontSize,
      letterSpacing: cs.letterSpacing,
      color: cs.color,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onDone();
  }

  // Reduced-motion path: nothing to animate, real DOM already shows the
  // correct (discounted) total underneath — just clear the overlay quickly.
  useEffect(() => {
    if (reduced) {
      const t = window.setTimeout(finish, 200);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // Full sequence: sound + guaranteed completion timer.
  useEffect(() => {
    if (reduced !== false || !targetRect) return;
    const stopSound = playPromoFxSequence();
    const t = window.setTimeout(finish, FX.TOTAL + FX.DONE_BUFFER);
    return () => {
      window.clearTimeout(t);
      stopSound();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, targetRect]);

  const trailParticles = useMemo(() => makeParticles(12), []);
  const impactSparks = useMemo(() => makeParticles(12, 1.3), []);
  const settleSparkles = useMemo(() => makeParticles(9, 0.85), []);
  const speedLines = useMemo(
    () =>
      Array.from({ length: 9 }).map((_, i) => ({
        id: i,
        angleDeg: (i / 9) * 360 + (Math.random() - 0.5) * 18,
        lengthPx: 70 + Math.random() * 60,
        delayMs: Math.random() * 40,
      })),
    []
  );

  if (reduced !== false || !targetRect) return null;

  const sx = sourceRect.left + sourceRect.width / 2;
  const sy = sourceRect.top + sourceRect.height / 2;
  const tx = targetRect.left + targetRect.width / 2;
  const ty = targetRect.top + targetRect.height / 2;
  const dx = tx - sx;
  const dy = ty - sy;
  // The orb arrives near the price but not directly on it (spec: "upper-left
  // area of pricing section"), then the dagger dashes the last stretch onto
  // the number itself at the moment of the slash.
  const hx = dx - 46;
  const hy = dy - 42;
  const arc = -Math.max(70, Math.abs(dx) * 0.32);

  const travelVars = {
    left: sx,
    top: sy,
    ["--hx" as string]: `${hx}px`,
    ["--hy" as string]: `${hy}px`,
    ["--dx" as string]: `${dx}px`,
    ["--dy" as string]: `${dy}px`,
    ["--arc" as string]: `${arc}px`,
  } as React.CSSProperties;

  const targetVars = {
    left: targetRect.left,
    top: targetRect.top,
    width: targetRect.width,
    height: targetRect.height,
  } as React.CSSProperties;

  return (
    <ModalPortal lockScroll={false}>
      <div className="promofx-layer" aria-hidden="true" role="presentation">
        {/* Ambient glow at the promo box — reads as the code being absorbed
            without needing to hide the real (already-applied) box underneath. */}
        <div
          className="promofx-source-glow"
          style={{
            left: sx,
            top: sy,
            width: Math.max(sourceRect.width, 40),
            height: Math.max(sourceRect.height, 40),
          }}
        />

        {/* Orb -> dagger travel group */}
        <div className="promofx-travel" style={travelVars}>
          {/* Plasma rings orbiting the energy orb */}
          <div className="promofx-orb-ring" />
          <div className="promofx-orb-ring2" />
          <div className="promofx-orb-shape" />
          {/* Afterimage streaks — three ghost clones for a denser motion trail */}
          <div className="promofx-dagger-ghost promofx-dagger-ghost-1" />
          <div className="promofx-dagger-ghost promofx-dagger-ghost-2" />
          <div className="promofx-dagger-ghost promofx-dagger-ghost-3" />
          <div className="promofx-dagger-shape">
            <svg viewBox="0 0 60 84" className="promofx-dagger-svg">
              <defs>
                <linearGradient id="promofxDaggerBlade" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ff8a75" />
                  <stop offset="45%" stopColor="#e0261f" />
                  <stop offset="100%" stopColor="#7a0f16" />
                </linearGradient>
                <linearGradient id="promofxDaggerGlint" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="50%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                <clipPath id="promofxDaggerClip">
                  <path d="M30 2 L38 34 L30 78 L22 34 Z" />
                </clipPath>
              </defs>
              <path d="M30 2 L38 34 L30 78 L22 34 Z" fill="url(#promofxDaggerBlade)" stroke="#ffd9d0" strokeWidth="0.8" />
              <path d="M30 2 L38 34 L30 40 L22 34 Z" fill="#ffc3b6" opacity="0.85" />
              <circle cx="30" cy="34" r="3.4" fill="#fff4e6" opacity="0.9" />
              {/* Katana glint — a bright highlight that sweeps across the blade
                  right as it finishes forming (the anime "shiiing" light-catch). */}
              <g clipPath="url(#promofxDaggerClip)">
                <rect x="0" y="0" width="10" height="90" fill="url(#promofxDaggerGlint)" className="promofx-glint-sweep" />
              </g>
            </svg>
          </div>
          {trailParticles.map((p) => (
            <span
              key={p.id}
              className="promofx-trail-dot"
              style={
                {
                  animationDelay: `${FX.FLIGHT_START + p.delayMs}ms`,
                  width: p.sizePx,
                  height: p.sizePx,
                  marginLeft: -p.sizePx / 2,
                  marginTop: -p.sizePx / 2,
                  ["--tang" as string]: `${p.angleDeg}deg`,
                  ["--tdist" as string]: `${p.distPx * 0.4}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* Price stage: masks the real total and plays out phases 3-7 */}
        <div className="promofx-target" style={targetVars}>
          <div className="promofx-target-bg" />

          {/* Manga-style radiating speed lines at the moment of the strike */}
          <div className="promofx-speedlines">
            {speedLines.map((l) => (
              <span
                key={l.id}
                className="promofx-speedline"
                style={
                  {
                    animationDelay: `${FX.SPEEDLINES_AT + l.delayMs}ms`,
                    width: `${l.lengthPx}px`,
                    ["--lang" as string]: `${l.angleDeg}deg`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>

          <div className="promofx-old-total" style={priceStyle}>
            {oldTotalText}
          </div>
          <div className="promofx-half promofx-half-left" style={priceStyle} aria-hidden="true">
            {oldTotalText}
          </div>
          <div className="promofx-half promofx-half-right" style={priceStyle} aria-hidden="true">
            {oldTotalText}
          </div>

          <div className="promofx-flash" />
          <div className="promofx-arc-ring" />
          <div className="promofx-impact-star" aria-hidden="true">
            <svg viewBox="0 0 100 100">
              <polygon points="50,0 61,38 100,38 68,60 79,100 50,76 21,100 32,60 0,38 39,38" fill="currentColor" />
            </svg>
          </div>

          {/* Bold onomatopoeia burst — the comic-panel "SLASH!!" */}
          <div className="promofx-onomatopoeia" aria-hidden="true">
            SLASH!!
          </div>

          <div className="promofx-new-total" style={priceStyle}>
            {newTotalText}
          </div>

          {/* Bonus: an ink-stamp discount badge, stamped down after the total settles */}
          <div className="promofx-stamp" aria-hidden="true">
            <span className="promofx-stamp-ring" />
            <span className="promofx-stamp-text">-{percentage}%</span>
          </div>

          {impactSparks.map((p) => (
            <span
              key={p.id}
              className="promofx-impact-spark"
              style={
                {
                  animationDelay: `${FX.IMPACT_AT + p.delayMs}ms`,
                  width: p.sizePx,
                  height: p.sizePx,
                  marginLeft: -p.sizePx / 2,
                  marginTop: -p.sizePx / 2,
                  ["--pang" as string]: `${p.angleDeg}deg`,
                  ["--pdist" as string]: `${p.distPx}px`,
                } as React.CSSProperties
              }
            />
          ))}

          {settleSparkles.map((p) => (
            <span
              key={p.id}
              className="promofx-settle-sparkle"
              style={
                {
                  animationDelay: `${FX.SPARKLE_AT + p.delayMs}ms`,
                  width: p.sizePx,
                  height: p.sizePx,
                  marginLeft: -p.sizePx / 2,
                  marginTop: -p.sizePx / 2,
                  ["--sang" as string]: `${p.angleDeg}deg`,
                  ["--sdist" as string]: `${p.distPx}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>
    </ModalPortal>
  );
}
