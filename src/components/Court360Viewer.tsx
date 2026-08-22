"use client";

import { useEffect, useRef, useState } from "react";

// A real photo doesn't stitch seamlessly at its own edges the way a
// rendered 3D scene would, so this pans across the captured panorama within
// its natural bounds (rubber-banding slightly at the edges) rather than
// looping — that keeps the drag feeling responsive without ever showing a
// visible seam.
export default function Court360Viewer({
  src,
  alt = "360° view of the pickleball court",
}: {
  src: string;
  alt?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [offset, setOffset] = useState(0); // px, always <= 0
  const [maxPan, setMaxPan] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const dragState = useRef<{ startX: number; startOffset: number; pointerId: number } | null>(null);

  // Recompute how far the image can pan (its rendered width minus the
  // viewport width) whenever the container resizes or the image loads.
  useEffect(() => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img) return;

    const recompute = () => {
      const wrapWidth = wrap.clientWidth;
      const renderedWidth = img.clientWidth;
      const nextMax = Math.max(0, renderedWidth - wrapWidth);
      setMaxPan(nextMax);
      setOffset((prev) => Math.min(0, Math.max(-nextMax, prev)));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(wrap);
    if (img.complete) recompute();
    else img.addEventListener("load", recompute, { once: true });

    return () => ro.disconnect();
  }, []);

  const clamp = (value: number) => Math.min(0, Math.max(-maxPan, value));

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragState.current = { startX: e.clientX, startOffset: offset, pointerId: e.pointerId };
    setDragging(true);
    setHasInteracted(true);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    if (!state) return;
    const delta = e.clientX - state.startX;
    setOffset(clamp(state.startOffset + delta));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    dragState.current = null;
    setDragging(false);
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture may already have been released by the browser
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      setHasInteracted(true);
      setOffset((prev) => clamp(prev + 60));
    } else if (e.key === "ArrowRight") {
      setHasInteracted(true);
      setOffset((prev) => clamp(prev - 60));
    }
  };

  return (
    <div
      ref={wrapRef}
      className="court-360-wrap"
      role="group"
      aria-label={alt}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      style={{ cursor: maxPan > 0 ? (dragging ? "grabbing" : "grab") : "default" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        className="court-360-img"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 320ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
      <span className="court-360-fade court-360-fade--left" aria-hidden />
      <span className="court-360-fade court-360-fade--right" aria-hidden />
      <div className={`court-360-hint ${hasInteracted ? "court-360-hint--hidden" : ""}`} aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 7L3 12L8 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 7L21 12L16 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        DRAG TO LOOK AROUND
      </div>
    </div>
  );
}
