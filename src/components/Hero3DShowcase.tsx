"use client";

/**
 * Decorative-only 3D accent for the hero. Pure CSS 3D transforms (perspective +
 * translateZ layers), no canvas/WebGL dependency. Tilts toward the pointer
 * anywhere in the viewport and idles with a slow orbit when the pointer is
 * unavailable (touch) or the user prefers reduced motion. Never intercepts
 * clicks, never changes layout flow, and has zero effect on booking logic.
 */
import { useEffect, useRef } from "react";

export default function Hero3DShowcase() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (reduceMotion.matches || !fine.matches) return;

    let frame = 0;
    let rect = scene.getBoundingClientRect();

    const refreshRect = () => {
      rect = scene.getBoundingClientRect();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (event.clientX - cx) / (rect.width / 2 || 1);
        const dy = (event.clientY - cy) / (rect.height / 2 || 1);
        const clampedX = Math.max(-1.6, Math.min(1.6, dx));
        const clampedY = Math.max(-1.6, Math.min(1.6, dy));
        scene.style.setProperty("--tilt-x", `${(-clampedY * 9).toFixed(2)}deg`);
        scene.style.setProperty("--tilt-y", `${(clampedX * 11).toFixed(2)}deg`);
        frame = 0;
      });
    };

    refreshRect();
    window.addEventListener("resize", refreshRect, { passive: true });
    window.addEventListener("scroll", refreshRect, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      window.removeEventListener("resize", refreshRect);
      window.removeEventListener("scroll", refreshRect);
      window.removeEventListener("pointermove", onPointerMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="hero-3d-showcase hidden sm:block" aria-hidden="true">
      <div ref={sceneRef} className="hero-3d-scene">
        <span className="hero-3d-layer hero-3d-layer--ring" />
        <span className="hero-3d-layer hero-3d-layer--glow" />
        <span className="hero-3d-layer hero-3d-layer--paddle">
          <img src="/promo-fx/paddle.png" alt="" width={72} height={110} draggable={false} />
        </span>
        <span className="hero-3d-layer hero-3d-layer--ball">
          <img src="/promo-fx/ball.png" alt="" width={40} height={40} draggable={false} />
        </span>
        <span className="hero-3d-layer hero-3d-layer--shadow" />
      </div>
    </div>
  );
}
