"use client";

import { useMemo } from "react";
import { useSky } from "./SkyProvider";
import { skyVisualForMinutes, rgbCss } from "@/lib/skyTime";

// Deterministic pseudo-random stars (fixed seed) so the layout is identical
// on server and client — no hydration mismatch, no post-load "pop-in".
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_COUNT = 70;
const STARS = (() => {
  const rand = mulberry32(20260813);
  return Array.from({ length: STAR_COUNT }, () => ({
    left: rand() * 100,
    top: rand() * 62, // keep stars in the upper sky, away from the horizon glow
    size: 1 + rand() * 1.8,
    duration: 2.4 + rand() * 3.2,
    delay: rand() * 4,
    baseOpacity: 0.45 + rand() * 0.55,
  }));
})();

export default function SkyBackdrop() {
  const { minutes, isAnimating } = useSky();
  const visual = useMemo(() => skyVisualForMinutes(minutes), [minutes]);

  // Long, smooth transitions while idling between low-frequency updates;
  // no CSS transition during the preview since we're already animating
  // every frame ourselves — a transition here would just add lag on top.
  const transitionTiming = isAnimating ? "none" : "6.5s linear";
  const fadeTransition = isAnimating ? "none" : "opacity 3s ease";

  return (
    <div aria-hidden="true" className="sky-backdrop" style={{ transition: fadeTransition }}>
      <div
        className="sky-backdrop-gradient"
        style={{
          background: `linear-gradient(180deg, ${rgbCss(visual.top)} 0%, ${rgbCss(visual.bottom)} 100%)`,
          transition: isAnimating ? "none" : "background 6.5s linear",
        }}
      />

      <div
        className="sky-stars"
        style={{ opacity: visual.starOpacity, transition: fadeTransition }}
      >
        {STARS.map((s, i) => (
          <span
            key={i}
            className="sky-star"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              opacity: s.baseOpacity,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>

      <div
        className="sky-body sky-sun"
        style={{
          left: `${visual.sun.left}%`,
          top: `${visual.sun.top}%`,
          opacity: visual.sun.opacity,
          transition: isAnimating ? "none" : `left ${transitionTiming}, top ${transitionTiming}, opacity 1.5s ease`,
        }}
      />
      <div
        className="sky-body sky-moon"
        style={{
          left: `${visual.moon.left}%`,
          top: `${visual.moon.top}%`,
          opacity: visual.moon.opacity,
          transition: isAnimating ? "none" : `left ${transitionTiming}, top ${transitionTiming}, opacity 1.5s ease`,
        }}
      />
    </div>
  );
}
