/**
 * Timing for the promo-code "PLASMA SLASH" success animation (v3).
 *
 * All values are milliseconds from animation start (t=0 = the moment a
 * valid promo code comes back from the API). These are the single source
 * of truth for the JS-side orchestration (sound scheduling, the
 * onComplete timeout, canvas particle scheduling in
 * PromoSuccessAnimation.tsx, and ignoring repeat triggers while playing).
 *
 * v3 note: retimed from v2's 6.9s to ~2.65s. The longer cut read as
 * "impressive the first time, slow every time after" — this keeps the same
 * beats (charge → flight → dagger-form/pause → slash → impact → reveal →
 * settle) but compressed to a pace that still reads clearly at speed. Bump
 * TOTAL back up (and re-space the phases proportionally) for a more
 * cinematic pace on a specific big-promo moment — everything below derives
 * from these numbers.
 */
export const FX = {
  // Phase 1 — charge / orb formation at the promo box
  CHARGE_END: 550,
  // Phase 2 — flight toward the price
  FLIGHT_START: 550,
  FLIGHT_END: 1150,
  // Phase 3 — orb -> dagger transformation + glint pause
  DAGGER_FORM_START: 1150,
  DAGGER_PAUSE_END: 1650,
  GLINT_AT: 1550,
  TENSION_CHORD_AT: 1550,
  // Phase 4 — slash attack + impact ("SLASH!!")
  SLASH_START: 1650,
  IMPACT_AT: 1700,
  SLASH_END: 1740,
  SPEEDLINES_AT: 1650,
  ONOMATOPOEIA_AT: 1700,
  // Phase 5 — glitch-decode reveal of the discounted total
  REVEAL_START: 1700,
  REVEAL_SHARP_AT: 2200,
  // Phase 6 — settle sparkle + discount stamp
  SETTLE_START: 2200,
  SETTLE_END: 2650,
  SPARKLE_AT: 2300,
  STAMP_AT: 2450,
  // Total runtime
  TOTAL: 2650,
  // Extra buffer before unmount/onDone so the last frame is never cut off
  DONE_BUFFER: 150,
} as const;

export type Rect = { left: number; top: number; width: number; height: number };

export function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}
