"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type PopupAdData = {
  imageUrl: string;
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

  if (!ad || !visible) return null;

  return (
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

        <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-court-ink/5">
          <Image src={ad.imageUrl} alt={ad.headline || "Promotion"} fill className="object-cover" priority sizes="(max-width: 640px) 100vw, 32rem" />
        </div>

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
  );
}
