"use client";

import { useEffect, useRef, useState } from "react";
import ModalPortal from "./ModalPortal";
import { FX, Rect } from "@/lib/promoFxTiming";
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

// ---------- small math/particle helpers ----------
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;
function easeOutBack(t: number) {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

type P = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; gravity: number; drag: number };
function spawn(list: P[], x: number, y: number, opts: Partial<P> & { angle?: number; speed?: number } = {}) {
  const angle = opts.angle ?? rand(0, Math.PI * 2);
  const speed = opts.speed ?? rand(80, 260);
  list.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0,
    maxLife: opts.maxLife ?? rand(0.35, 0.8),
    size: opts.size ?? rand(1.5, 4),
    gravity: opts.gravity ?? 0,
    drag: opts.drag ?? 2.2,
  });
}
function stepParticles(list: P[], dt: number) {
  return list.filter((sp) => {
    sp.life += dt;
    sp.vx -= sp.vx * sp.drag * dt;
    sp.vy -= sp.vy * sp.drag * dt;
    sp.vy += sp.gravity * dt;
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    return sp.life < sp.maxLife;
  });
}
function drawParticles(ctx: CanvasRenderingContext2D, list: P[], cyan: string, red: string) {
  for (const sp of list) {
    const p = clamp01(sp.life / sp.maxLife);
    const a = 1 - p;
    const r = sp.size * (1 - p * 0.6) * 4 + 2;
    const grd = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, r);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.4, cyan);
    grd.addColorStop(1, "transparent");
    ctx.globalAlpha = a;
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  void red;
}

function boltPath(x1: number, y1: number, x2: number, y2: number, segs = 5, jitter = 10) {
  const pts = [{ x: x1, y: y1 }];
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    pts.push({ x: lerp(x1, x2, t) + rand(-jitter, jitter), y: lerp(y1, y2, t) + rand(-jitter, jitter) });
  }
  pts.push({ x: x2, y: y2 });
  return pts;
}
function drawBolt(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], color: string, width: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowBlur = 12;
  ctx.shadowColor = color;
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.restore();
}

function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, cyan: string) {
  ctx.save();
  const grd = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, 0, x, y, r);
  grd.addColorStop(0, "#ffffff");
  grd.addColorStop(0.25, cyan);
  grd.addColorStop(0.6, "#ff6b4a");
  grd.addColorStop(1, "#7a0f16");
  ctx.shadowBlur = 18;
  ctx.shadowColor = cyan;
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDagger(ctx: CanvasRenderingContext2D, x: number, y: number, rotDeg: number, scale: number, alpha: number, glintP: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.shadowBlur = 14;
  ctx.shadowColor = "rgba(220, 38, 38, 0.6)";
  const grd = ctx.createLinearGradient(-15, -40, 15, 40);
  grd.addColorStop(0, "#ff8a75");
  grd.addColorStop(0.45, "#e0261f");
  grd.addColorStop(1, "#7a0f16");
  ctx.fillStyle = grd;
  ctx.strokeStyle = "#ffd9d0";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -40);
  ctx.lineTo(8, -6);
  ctx.lineTo(0, 38);
  ctx.lineTo(-8, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (glintP > 0) {
    ctx.save();
    ctx.globalAlpha = alpha * Math.sin(glintP * Math.PI);
    const gg = ctx.createLinearGradient(-8 + glintP * 20, -40, -8 + glintP * 20, 40);
    gg.addColorStop(0, "rgba(255,255,255,0)");
    gg.addColorStop(0.5, "rgba(255,255,255,.95)");
    gg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gg;
    ctx.fillRect(-9 + glintP * 20, -40, 4, 80);
    ctx.restore();
  }
  ctx.restore();
}

const GLITCH_CHARS = "₱0123456789#%$&";
function scrambleText(target: string, progress: number) {
  return target
    .split("")
    .map((ch, i) => {
      if (ch === " " || ch === "₱") return ch;
      const reveal = clamp01((progress * target.length - i) / 1.4);
      if (reveal >= 1) return ch;
      return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
    })
    .join("");
}

/** Reads a "--color-x" CSS variable (an "r g b" triplet) off :root as an "rgb(r,g,b)" string. */
function cssVarRgb(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const parts = raw.split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return fallback;
  return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetBoxRef = useRef<HTMLDivElement>(null);
  const oldTotalRef = useRef<HTMLDivElement>(null);
  const glitchTextRef = useRef<HTMLDivElement>(null);
  const onoRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    console.log("[promoFx trace] PromoSuccessAnimation mounted. prefers-reduced-motion matches:", mq.matches);
    setReduced(mq.matches);
  }, []);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onDone();
  }

  // Read the target's final rect + computed text style, then set up live
  // tracking so the overlay never drifts on scroll, resize, or rotation.
  // Double-rAF: the target <span> has key={grandTotal} so React
  // unmounts+remounts it when the promo is applied; two nested rAFs
  // guarantee we measure after the first fully-painted frame of the new node.
  useEffect(() => {
    let cancelled = false;
    let pollRaf = 0;
    let innerCleanup: (() => void) | null = null;

    const el = targetRef.current;
    if (!el) {
      // The target <span> has key={grandTotal}, so it unmounts+remounts on
      // the same commit that mounts this component — the ref *should*
      // already be attached by the time this effect runs. But rather than
      // silently bailing (and killing the whole animation) on the rare
      // chance it isn't yet, give it a couple of frames to show up before
      // giving up for real.
      let tries = 0;
      const poll = () => {
        if (cancelled) return;
        const found = targetRef.current;
        if (found) {
          innerCleanup = setupMeasurement(found);
          return;
        }
        tries += 1;
        if (tries > 10) {
          console.error("[promoFx] targetRef never attached — aborting animation.");
          finish();
          return;
        }
        pollRaf = requestAnimationFrame(poll);
      };
      pollRaf = requestAnimationFrame(poll);
    } else {
      innerCleanup = setupMeasurement(el);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(pollRaf);
      if (innerCleanup) innerCleanup();
    };

    function setupMeasurement(el: HTMLElement) {
    const cs = window.getComputedStyle(el);
    setPriceStyle({
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight as React.CSSProperties["fontWeight"],
      fontSize: cs.fontSize,
      letterSpacing: cs.letterSpacing,
      color: cs.color,
    });

    let raf1: number;
    let raf2: number;
    let pendingRaf: number | null = null;

    function measureAndUpdate() {
      const current = targetRef.current;
      if (!current) return;
      setTargetRect((prev) => {
        const r = current.getBoundingClientRect();
        if (prev && Math.abs(prev.left - r.left) < 1 && Math.abs(prev.top - r.top) < 1 && Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1) {
          return prev;
        }
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      });
    }

    function onViewportChange() {
      if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
      pendingRaf = requestAnimationFrame(() => {
        measureAndUpdate();
        pendingRaf = null;
      });
    }

    let cleanupLive: (() => void) | null = null;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        measureAndUpdate();
        window.addEventListener("scroll", onViewportChange, { passive: true, capture: true });
        window.addEventListener("resize", onViewportChange, { passive: true });
        const ro = new ResizeObserver(onViewportChange);
        ro.observe(document.documentElement);
        if (targetRef.current) ro.observe(targetRef.current);
        cleanupLive = () => {
          window.removeEventListener("scroll", onViewportChange, { capture: true });
          window.removeEventListener("resize", onViewportChange);
          ro.disconnect();
          if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
        };
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (cleanupLive) cleanupLive();
      if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
    };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reduced-motion path: nothing to animate — just clear the overlay quickly.
  useEffect(() => {
    if (reduced) {
      const t = window.setTimeout(finish, 200);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // Full canvas-driven sequence.
  useEffect(() => {
    console.log("[promoFx trace] main effect check — reduced:", reduced, "targetRect:", targetRect);
    if (reduced !== false || !targetRect) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (!canvas || !ctx) {
      finish();
      return;
    }

    const cyan = cssVarRgb("--color-energy-cyan", "rgb(100, 220, 255)");
    const red = cssVarRgb("--color-energy-red", "rgb(220, 38, 38)");

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);
    console.log(
      "[promoFx trace] canvas ready — element in DOM:",
      document.body.contains(canvas),
      "size:",
      canvas.width,
      canvas.height,
      "layer in DOM:",
      !!document.querySelector(".promofx-layer"),
      "layer computed z-index/display:",
      (() => {
        const layer = document.querySelector(".promofx-layer") as HTMLElement | null;
        if (!layer) return "NO LAYER FOUND";
        const cs = window.getComputedStyle(layer);
        return { display: cs.display, visibility: cs.visibility, opacity: cs.opacity, zIndex: cs.zIndex, position: cs.position };
      })()
    );

    // Sound is a bonus layer on top of the visual sequence — the lib
    // already guards its own AudioContext creation/scheduling, but we
    // never want *anything* sound-related to be able to take the visual
    // animation down with it, so this call gets its own belt-and-braces
    // try/catch too.
    let stopSound = () => {};
    try {
      stopSound = playPromoFxSequence();
    } catch (err) {
      console.error("[promoFx] playPromoFxSequence threw, continuing without sound:", err);
    }

    // Watchdog: if anything below throws or otherwise stalls the render
    // loop before it reaches its normal finish(), this guarantees the
    // overlay (which is currently masking the real price) still gets
    // torn down instead of sitting there indefinitely.
    const watchdog = window.setTimeout(() => {
      console.error("[promoFx] Animation watchdog fired — forcing finish().");
      finish();
    }, FX.TOTAL + FX.DONE_BUFFER + 1000);

    const sx = sourceRect.left + sourceRect.width / 2;
    const sy = sourceRect.top + sourceRect.height / 2;
    const tx = targetRect.left + targetRect.width / 2;
    const ty = targetRect.top + targetRect.height / 2;
    const midx = lerp(sx, tx, 0.55);
    const midy = lerp(sy, ty, 0.55) - Math.max(70, Math.abs(tx - sx) * 0.35);

    let particles: P[] = [];
    let impacted = false;
    let stamped = false;
    const t0 = performance.now();
    let rafId = 0;

    function shakeScreen(duration: number, mag: number) {
      const start = performance.now();
      function f(now: number) {
        const el = targetBoxRef.current;
        if (!el) return;
        const p = clamp01((now - start) / duration);
        if (p >= 1) {
          el.style.transform = "";
          return;
        }
        const damp = 1 - p;
        el.style.transform = `translate(${rand(-mag, mag) * damp}px, ${rand(-mag, mag) * damp}px)`;
        requestAnimationFrame(f);
      }
      requestAnimationFrame(f);
    }

    function frame(now: number) {
      const t = now - t0;
      if (t < 20) {
        console.log("[promoFx trace] frame() is running. t:", Math.round(t), "canvas size:", canvas!.width, canvas!.height);
      }
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      // Phase 1 — charge at promo box
      if (t < FX.CHARGE_END) {
        const p = clamp01(t / FX.CHARGE_END);
        const r = lerp(6, 24, easeOutBack(p));
        ctx!.save();
        ctx!.globalAlpha = p;
        const grd = ctx!.createRadialGradient(sx, sy, 0, sx, sy, r * 2.2);
        grd.addColorStop(0, "rgba(255,255,255,.9)");
        grd.addColorStop(0.3, cyan);
        grd.addColorStop(0.65, red);
        grd.addColorStop(1, "transparent");
        ctx!.fillStyle = grd;
        ctx!.beginPath();
        ctx!.arc(sx, sy, r * 2.2, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();

        if (Math.random() < 0.5) {
          const ang = rand(0, Math.PI * 2);
          const dist = rand(45, 100);
          const pts = boltPath(sx + Math.cos(ang) * dist, sy + Math.sin(ang) * dist, sx, sy, 5, 7);
          drawBolt(ctx!, pts, Math.random() < 0.5 ? cyan : "#ff8a75", 1.3, p * 0.8);
        }
      }

      // Phase 2 — flight
      let daggerX = tx - 30,
        daggerY = ty - 26;
      if (t >= FX.CHARGE_END && t < FX.FLIGHT_END) {
        const p = easeInCubic(clamp01((t - FX.CHARGE_END) / (FX.FLIGHT_END - FX.CHARGE_END)));
        const ix = lerp(lerp(sx, midx, p), lerp(midx, tx, p), p);
        const iy = lerp(lerp(sy, midy, p), lerp(midy, ty, p), p);
        spawn(particles, ix, iy, { speed: rand(20, 60), maxLife: rand(0.22, 0.4), size: 1.6 });
        drawOrb(ctx!, ix, iy, 15 * lerp(0.6, 1.15, Math.sin(p * Math.PI)), cyan);
      }

      // Phase 3 — dagger forms + glint pause
      let daggerRot = 32,
        daggerScale = 1,
        daggerAlpha = 0;
      if (t >= FX.FLIGHT_END && t < FX.DAGGER_PAUSE_END) {
        const p = clamp01((t - FX.FLIGHT_END) / (FX.DAGGER_PAUSE_END - FX.FLIGHT_END));
        daggerAlpha = clamp01(p * 4);
        daggerScale = lerp(1.3, 1, easeOutBack(clamp01(p * 2)));
        daggerRot = lerp(20, 34, p);
        drawDagger(ctx!, daggerX, daggerY, daggerRot, daggerScale, daggerAlpha, p > 0.7 ? (p - 0.7) / 0.3 : 0);
        if (p > 0.7 && Math.random() < 0.4) {
          spawn(particles, daggerX, daggerY, { speed: rand(5, 18), maxLife: 0.18, size: 1 });
        }
      }

      // Phase 4 — slash + impact
      if (t >= FX.SLASH_START && t < FX.IMPACT_AT + 40) {
        const p = clamp01((t - FX.SLASH_START) / (FX.IMPACT_AT + 40 - FX.SLASH_START));
        for (let g = 0; g < 5; g++) {
          const gp = clamp01(p - g * 0.09);
          if (gp <= 0) continue;
          const gx = lerp(daggerX, tx, easeOutCubic(gp));
          const gy = lerp(daggerY, ty, easeOutCubic(gp));
          drawDagger(ctx!, gx, gy, 55, 1.1, (1 - g / 5) * 0.5, 1);
        }
        const ex = lerp(daggerX, tx, easeOutCubic(p));
        const ey = lerp(daggerY, ty, easeOutCubic(p));
        drawDagger(ctx!, ex, ey, 58, 1.15, 1, 1);

        if (t >= FX.IMPACT_AT && !impacted) {
          impacted = true;
          for (let i = 0; i < 34; i++) spawn(particles, tx, ty, { speed: rand(140, 400), maxLife: rand(0.3, 0.65), size: rand(1.8, 3.6) });
          shakeScreen(240, 6);
          if (flashRef.current) {
            flashRef.current.style.setProperty("--fx-x", `${tx}px`);
            flashRef.current.style.setProperty("--fx-y", `${ty}px`);
            flashRef.current.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0 }], { duration: 320, easing: "ease-out" });
          }
          if (onoRef.current) {
            onoRef.current.style.left = tx + 16 + "px";
            onoRef.current.style.top = ty - 68 + "px";
            onoRef.current.animate(
              [
                { opacity: 0, transform: "translate(-10%,-10%) rotate(-10deg) scale(.2)" },
                { opacity: 1, transform: "translate(-10%,-10%) rotate(-6deg) scale(1.22)", offset: 0.25 },
                { opacity: 1, transform: "translate(-10%,-10%) rotate(-6deg) scale(1)", offset: 0.7 },
                { opacity: 0, transform: "translate(-10%,-28%) rotate(-6deg) scale(.9)" },
              ],
              { duration: 560, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "forwards" }
            );
          }
        }
      }

      // Old total stays crisp right up through the strike, then the
      // glitch-decode layer takes over at the exact moment of impact.
      if (oldTotalRef.current) {
        oldTotalRef.current.style.opacity = t < FX.IMPACT_AT ? "1" : "0";
      }

      // Phase 5 — glitch-decode reveal
      if (t >= FX.IMPACT_AT && glitchTextRef.current) {
        const wrapperP = clamp01((t - FX.IMPACT_AT) / (FX.REVEAL_SHARP_AT - FX.IMPACT_AT + 250));
        const resolved = clamp01((t - (FX.IMPACT_AT + 100)) / 450);
        const el = glitchTextRef.current;
        el.textContent = resolved < 1 ? scrambleText(newTotalText, resolved) : newTotalText;
        el.style.opacity = String(clamp01(wrapperP * 3));
        el.style.color = resolved < 1 ? cyan : "rgb(var(--color-orange))";
        el.style.textShadow = resolved < 1 ? `0 0 12px ${cyan}` : "0 0 8px rgba(244,96,54,.35)";
        el.style.filter = resolved < 1 ? `blur(${lerp(3, 0, resolved)}px)` : "none";
        el.style.transform = `scale(${lerp(0.85, 1, easeOutBack(resolved))})`;
      }

      // Phase 6 — settle sparkle + stamp
      if (t >= FX.SETTLE_START && t < FX.SETTLE_END && !stamped) {
        stamped = true;
        for (let i = 0; i < 12; i++) spawn(particles, tx, ty - 8, { speed: rand(20, 65), maxLife: rand(0.45, 0.85), size: rand(1.4, 2.8), gravity: 40 });
        if (stampRef.current) {
          stampRef.current.style.left = tx + 30 + "px";
          stampRef.current.style.top = ty + 14 + "px";
          stampRef.current.animate(
            [
              { opacity: 0, transform: "translate(-50%,-50%) scale(2.2) rotate(-22deg)" },
              { opacity: 1, transform: "translate(-50%,-50%) scale(1) rotate(-14deg)", offset: 0.4 },
              { opacity: 1, transform: "translate(-50%,-50%) scale(1) rotate(-14deg)", offset: 0.85 },
              { opacity: 0, transform: "translate(-50%,-50%) scale(1) rotate(-14deg)" },
            ],
            { duration: 850, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "forwards" }
          );
        }
      }

      particles = stepParticles(particles, 1 / 60);
      drawParticles(ctx!, particles, cyan, red);

      if (t < FX.SETTLE_END + FX.DONE_BUFFER) {
        rafId = requestAnimationFrame(safeFrame);
      } else {
        window.clearTimeout(watchdog);
        window.removeEventListener("resize", resize);
        stopSound();
        finish();
      }
    }

    // A throw inside a requestAnimationFrame callback doesn't crash the
    // page — it just silently stops that rAF chain, which used to leave
    // the overlay (and the white mask over the real price) stuck on
    // screen forever with no console signal pointing at why. Catching
    // here means a mid-animation error still tears the overlay down
    // cleanly and logs exactly where it happened.
    function safeFrame(now: number) {
      try {
        frame(now);
      } catch (err) {
        console.error("[promoFx] Animation frame threw, aborting sequence:", err);
        window.clearTimeout(watchdog);
        window.removeEventListener("resize", resize);
        stopSound();
        finish();
      }
    }

    rafId = requestAnimationFrame(safeFrame);

    return () => {
      window.clearTimeout(watchdog);
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      stopSound();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, targetRect]);

  if (reduced !== false || !targetRect) return null;

  // The old-total layer keeps the real computed color (it's just the
  // existing price, unstruck yet); the glitch layer overrides its own
  // color imperatively per-frame (cyan while scrambling, brand orange once
  // resolved), so it only needs the shape/size properties, not color.
  const oldTotalStyle: React.CSSProperties = priceStyle;
  const glitchStyle: React.CSSProperties = {
    fontFamily: priceStyle.fontFamily,
    fontWeight: priceStyle.fontWeight,
    fontSize: priceStyle.fontSize,
    letterSpacing: priceStyle.letterSpacing,
  };

  return (
    <ModalPortal lockScroll={false}>
      <div className="promofx-layer" aria-hidden="true" role="presentation">
        <canvas ref={canvasRef} className="promofx-canvas" />
        <div ref={flashRef} className="promofx-flash-v3" />

        {/* Masks the real total, hosts the glitch-decode price text. Also
            the element that takes the impact screen-shake. */}
        <div
          ref={targetBoxRef}
          className="promofx-target-v3"
          style={{ left: targetRect.left, top: targetRect.top, width: targetRect.width, height: targetRect.height }}
        >
          <div className="promofx-target-bg-v3" />
          <div ref={oldTotalRef} className="promofx-old-total-v3" style={oldTotalStyle}>
            {oldTotalText}
          </div>
          <div ref={glitchTextRef} className="promofx-glitch-total-v3" style={glitchStyle} />
        </div>

        <div ref={onoRef} className="promofx-onomatopoeia-v3">
          SLASH!!
        </div>
        <div ref={stampRef} className="promofx-stamp-v3">
          <span className="promofx-stamp-ring-v3" />
          <span className="promofx-stamp-text-v3">-{percentage}%</span>
        </div>
      </div>
    </ModalPortal>
  );
}
