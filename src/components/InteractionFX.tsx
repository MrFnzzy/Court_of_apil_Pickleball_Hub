"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Site-wide interaction layer:
 *  - "light wave" ripple circle at every click/tap on a button/link
 *  - a short synthesized "paddle pop" sound on click, and a soft "tick" on hover
 *  - a small mute toggle (bottom-right) since sound preference is personal and
 *    autoplay-style audio should always be easy to turn off
 *
 * No audio files are used — sounds are synthesized in-browser with the Web
 * Audio API, so there's nothing to fetch and nothing to keep in the bundle.
 */

const INTERACTIVE_SELECTOR = 'button, a, [role="button"], input[type="submit"], .fx-pressable';
const STORAGE_KEY = "courtOfApil.soundEnabled";

export default function InteractionFX() {
  const [muted, setMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastHoverTargetRef = useRef<EventTarget | null>(null);
  const lastHoverTimeRef = useRef(0);

  // Load saved sound preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "off") setMuted(true);
    } catch {
      // ignore (e.g. localStorage disabled)
    }
  }, []);

  function getAudioCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    if (!audioCtxRef.current) audioCtxRef.current = new AC();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }

  // Short, bright "pop" — like a paddle making contact with the ball
  function playPop(muted: boolean) {
    if (muted) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Soft, quiet "tick" for hover
  function playTick(muted: boolean) {
    if (muted) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(980, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  function spawnRipple(x: number, y: number) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    const el = document.createElement("span");
    el.className = "fx-ripple";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 700);
  }

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      const match = target?.closest(INTERACTIVE_SELECTOR);
      if (!match) return;
      // Ripple is a pure visual effect, so it's safe to fire immediately on
      // press for instant feedback on both mouse and touch.
      spawnRipple(e.clientX, e.clientY);
    }

    // The "pop" sound is triggered on click rather than pointerdown/touchstart.
    // Mobile browsers (iOS Safari in particular) only reliably treat a
    // "completed gesture" — click, touchend, mouseup — as valid user
    // activation for creating/resuming a Web Audio AudioContext. Firing from
    // pointerdown looked fine on desktop (where the context was usually
    // already unlocked from an earlier interaction in the same session) but
    // silently failed on the first tap on phones. `click` fires after a tap
    // is completed on every platform and is universally accepted as a real
    // user gesture, so this fixes sound on mobile without changing desktop
    // behavior at all.
    function onClick(e: MouseEvent) {
      const target = e.target as Element | null;
      const match = target?.closest(INTERACTIVE_SELECTOR);
      if (!match) return;
      playPop(muted);
    }

    function onPointerOver(e: PointerEvent) {
      if (e.pointerType !== "mouse") return; // skip touch, which fires synthetic hover
      const target = e.target as Element | null;
      const match = target?.closest(INTERACTIVE_SELECTOR);
      if (!match) return;
      if (lastHoverTargetRef.current === match) return; // already hovering this one
      const now = performance.now();
      if (now - lastHoverTimeRef.current < 120) return; // throttle rapid mouse travel
      lastHoverTargetRef.current = match;
      lastHoverTimeRef.current = now;
      playTick(muted);
    }

    function onPointerOut(e: PointerEvent) {
      const target = e.target as Element | null;
      const match = target?.closest(INTERACTIVE_SELECTOR);
      if (match && lastHoverTargetRef.current === match) {
        lastHoverTargetRef.current = null;
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("click", onClick);
    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("click", onClick);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
    };
  }, [muted]);

  function toggleMuted() {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "off" : "on");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <button
      type="button"
      onClick={toggleMuted}
      className="fx-mute-toggle focus-ring"
      aria-label={muted ? "Turn sound effects on" : "Turn sound effects off"}
      title={muted ? "Sound effects: off" : "Sound effects: on"}
    >
      {muted ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 6a9 9 0 0 1 0 12" />
        </svg>
      )}
    </button>
  );
}
