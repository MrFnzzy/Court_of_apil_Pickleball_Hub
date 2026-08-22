"use client";

import { useMemo } from "react";

const COLORS = ["#F46036", "#D6491F", "#FF8C61", "#6CD4FF", "#2FA8D9", "#173A45", "#FFC107"];

type Piece = {
  left: number;
  drift: number;
  spin: number;
  delay: number;
  duration: number;
  color: string;
  round: boolean;
  ball: boolean;
};

/**
 * A one-shot confetti burst, fixed to the viewport. Pieces are pure CSS
 * (no canvas, no dependency) — each one is a positioned div animated by the
 * `confetti-fall` keyframes in globals.css, with randomized horizontal
 * drift/spin/timing baked in as CSS custom properties so every piece moves
 * a little differently. Mount this component once per celebration (e.g.
 * keyed by a "won" event) and let it unmount itself after the animation.
 */
export default function ConfettiBurst({ count = 70 }: { count?: number }) {
  const pieces = useMemo<Piece[]>(() => {
    return Array.from({ length: count }).map(() => ({
      left: Math.random() * 100,
      drift: (Math.random() - 0.5) * 220,
      spin: 360 + Math.random() * 540,
      delay: Math.random() * 0.5,
      duration: 2.6 + Math.random() * 1.6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() > 0.5,
      ball: Math.random() > 0.78,
    }));
  }, [count]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`confetti-piece ${p.ball ? "confetti-piece--ball" : ""}`}
          style={
            {
              left: `${p.left}vw`,
              background: p.color,
              borderRadius: p.round ? "50%" : "2px",
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              "--confetti-x": "0px",
              "--confetti-drift": `${p.drift}px`,
              "--confetti-spin": `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
