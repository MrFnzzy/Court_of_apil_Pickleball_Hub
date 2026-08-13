"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ModalPortal from "@/components/ModalPortal";

type PopupAdData = {
  imageUrl: string;
  videoUrl: string | null;
  headline: string | null;
  message: string | null;
  linkUrl: string | null;
  buttonText: string | null;
  /** ISO string of when the admin last changed this ad — used as the
   * sessionStorage key so editing the ad shows it again even to visitors
   * who already dismissed an earlier version this session. */
  version: string;
};

const STORAGE_PREFIX = "pb_popup_seen_";

/**
 * Shows the admin-configured popup ad once per browser session (tracked via
 * sessionStorage, which clears when the tab/browser closes — a fresh visit
 * next time shows it again, but navigating between pages within the same
 * visit doesn't retrigger it). Renders nothing if the ad is off, has no
 * photo, or has already been seen this session.
 */
export default function PopupAdModal({ ad }: { ad: PopupAdData | null }) {
  const [visible, setVisible] = useState(false);
  const [needsUnmuteTap, setNeedsUnmuteTap] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!ad) return;
    try {
      const key = `${STORAGE_PREFIX}${ad.version}`;
      if (sessionStorage.getItem(key)) return;
      // Small delay so it doesn't compete with the initial page paint —
      // feels like a deliberate popup rather than a layout jolt.
      const t = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(t);
    } catch {
      // sessionStorage can throw in some locked-down browser contexts
      // (private mode edge cases, etc.) — fail quiet, just don't show it.
    }
  }, [ad]);

  function dismiss() {
    if (ad) {
      try {
        sessionStorage.setItem(`${STORAGE_PREFIX}${ad.version}`, "1");
      } catch {
        // Same as above — non-fatal if storage isn't available.
      }
    }
    setVisible(false);
  }

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Try to play the video WITH sound as soon as it's shown. Most browsers
  // only allow unmuted autoplay if the visitor already interacted with the
  // page (e.g. clicked/tapped something) earlier in this session — otherwise
  // they reject the play() call. When that happens we fall back to a muted
  // autoplay (which browsers always allow) and show a one-tap "Unmute"
  // button, since a tap counts as user interaction and lets us turn sound on.
  useEffect(() => {
    if (!visible || !ad?.videoUrl) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    const playPromise = v.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        v.muted = true;
        setNeedsUnmuteTap(true);
        v.play().catch(() => {
          // Even muted autoplay can be blocked in rare cases — nothing more
          // we can do without a user gesture; the tap-to-unmute control also
          // doubles as a tap-to-play control if this happens.
        });
      });
    }
  }, [visible, ad?.videoUrl]);

  function unmute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {});
    setNeedsUnmuteTap(false);
  }

  if (!ad || !visible) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-court-ink/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
        onClick={dismiss}
        role="dialog"
        aria-modal="true"
        aria-label={ad.headline || "Promotion"}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-court bg-white shadow-court-lg animate-[popIn_0.25s_ease-out]"
        >
          <button
            onClick={dismiss}
            aria-label="Close"
            className="focus-ring absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-court-ink shadow-court hover:bg-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          {/* Video plays edge-to-edge at its natural aspect ratio (no
              cropping box or background letterboxing) so it doesn't look
              like it's stuck inside a frame. Falls back to the photo in its
              square, object-contain box when there's no video. Sound is
              attempted on mount (see effect above) — browsers that block
              unmuted autoplay get a muted fallback plus a tap-to-unmute
              button. */}
          {ad.videoUrl ? (
            <div className="relative">
              <video
                ref={videoRef}
                src={ad.videoUrl}
                poster={ad.imageUrl}
                className="block w-full h-auto rounded-t-court"
                autoPlay
                loop
                playsInline
              />
              {needsUnmuteTap && (
                <button
                  onClick={unmute}
                  className="focus-ring absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-court-ink/80 text-white px-3.5 py-2 text-sm font-semibold shadow-court hover:bg-court-ink"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M3 10v4h4l5 5V5L7 10H3z" />
                    <path d="M16 8.5a4.5 4.5 0 0 1 0 7" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" />
                    <path d="M19 5.5a8.5 8.5 0 0 1 0 13" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.6} />
                  </svg>
                  Tap for sound
                </button>
              )}
            </div>
          ) : (
            <div className="relative w-full aspect-square bg-court-ink/5">
              <Image src={ad.imageUrl} alt={ad.headline || "Promotion"} fill className="object-contain" priority sizes="(max-width: 640px) 100vw, 32rem" />
            </div>
          )}

          {(ad.headline || ad.message || ad.buttonText) && (
            <div className="p-5 sm:p-6 text-center">
              {ad.headline && <h3 className="font-display font-700 text-xl sm:text-2xl text-court-ink mb-1.5">{ad.headline}</h3>}
              {ad.message && <p className="text-sm sm:text-base text-court-ink/70 leading-relaxed">{ad.message}</p>}
              {ad.buttonText && (
                <div className="mt-4">
                  {ad.linkUrl ? (
                    <Link
                      href={ad.linkUrl}
                      onClick={dismiss}
                      className="focus-ring inline-flex items-center gap-2 rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold shadow-court hover:bg-court-orange-dark transition-colors"
                    >
                      {ad.buttonText}
                    </Link>
                  ) : (
                    <button
                      onClick={dismiss}
                      className="focus-ring inline-flex items-center gap-2 rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold shadow-court hover:bg-court-orange-dark transition-colors"
                    >
                      {ad.buttonText}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
