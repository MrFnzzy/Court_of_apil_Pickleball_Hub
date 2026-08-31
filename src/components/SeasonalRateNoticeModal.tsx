"use client";

import { useEffect, useState } from "react";
import ModalPortal from "@/components/ModalPortal";
import { SeasonalPriceOverride, defaultSeasonalPopupMessage } from "@/lib/pricing";

const STORAGE_PREFIX = "pb_seasonal_rate_seen_";

/**
 * Warns a customer, once per browser session, that the date they just
 * picked on the booking calendar falls inside an admin-defined seasonal
 * pricing override (e.g. the soft-opening promo rate no longer applies and
 * the regular/adjusted rate does instead). Renders nothing when the
 * selected date uses the main rates, or once the customer has dismissed
 * this exact override version this session.
 *
 * `override` should be the live result of `overrideForDate(selectedDate,
 * pricing)` — the parent recomputes it as the customer changes dates, and
 * this component reacts by showing the notice again if the new date lands
 * in a *different* override the customer hasn't seen yet (each override's
 * sessionStorage key is scoped to its own id + updatedAt).
 */
export default function SeasonalRateNoticeModal({ override }: { override: SeasonalPriceOverride | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!override) {
      setVisible(false);
      return;
    }
    try {
      const key = `${STORAGE_PREFIX}${override.id}_${override.updatedAt}`;
      if (sessionStorage.getItem(key)) {
        setVisible(false);
        return;
      }
    } catch {
      // sessionStorage can throw in locked-down browser contexts — fail
      // open here (show it) rather than silently hiding a real price
      // change from the customer.
    }
    const t = setTimeout(() => setVisible(true), 250);
    return () => clearTimeout(t);
  }, [override]);

  function dismiss() {
    if (override) {
      try {
        sessionStorage.setItem(`${STORAGE_PREFIX}${override.id}_${override.updatedAt}`, "1");
      } catch {
        // non-fatal, see above
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
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!override || !visible) return null;

  const message = override.popupMessage?.trim() || defaultSeasonalPopupMessage(override);

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto overscroll-contain bg-court-ink/50 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Pricing notice"
        onClick={dismiss}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-court glass-panel glass-scroll p-6 text-center"
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="focus-ring absolute top-3 right-3 text-court-ink/40 hover:text-court-ink/70"
          >
            ✕
          </button>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-court-orange/15 text-court-orange-dark">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1" />
            </svg>
          </div>
          <p className="font-display font-600 text-court-ink mb-1">Heads up — rates for this date</p>
          <p className="text-sm text-court-ink/70 leading-relaxed mb-4">{message}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-court-ink/5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-court-ink/45">Day</p>
              <p className="font-display font-700 text-sm text-court-ink">₱{override.weekdayDayPrice}</p>
            </div>
            <div className="rounded-lg bg-court-ink/5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-court-ink/45">Night</p>
              <p className="font-display font-700 text-sm text-court-ink">₱{override.weekdayNightPrice}</p>
            </div>
            <div className="rounded-lg bg-court-ink/5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-court-ink/45">Weekend</p>
              <p className="font-display font-700 text-sm text-court-ink">₱{override.weekendPrice}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="focus-ring mt-5 w-full rounded-full bg-court-orange text-white px-4 py-2.5 text-sm font-semibold hover:bg-court-orange-dark"
          >
            Got it
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
