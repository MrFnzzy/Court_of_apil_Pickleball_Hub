/**
 * Timing for the promo-code "forged discount" success animation.
 *
 * All values are milliseconds from animation start (t=0 = the moment a
 * valid promo code comes back from the API). These are the single source
 * of truth for the JS-side orchestration (sound scheduling, the
 * onComplete timeout, ignoring repeat triggers while playing).
 *
 * The CSS keyframes in globals.css (`promofx-*`) are authored as
 * percentages of FX.TOTAL and are hand-derived from these same numbers —
 * if you change TOTAL or a phase boundary here, update the matching
 * percentage stops in globals.css too (each keyframe block has a comment
 * showing its ms breakdown).
 */
export const FX = {
  // Phase 1 — activation / orb formation at the promo box
  ORB_FORM_END: 1100,
  // Phase 2 — flight toward the price
  FLIGHT_START: 1100,
  FLIGHT_END: 2200,
  // Phase 3 — price lifts / separates (overlaps tail of flight)
  PRICE_LIFT_START: 1750,
  PRICE_LIFT_END: 3000,
  // Phase 4 — orb -> dagger transformation + dramatic pause
  DAGGER_FORM_START: 2850,
  DAGGER_PAUSE_END: 4150,
  // Phase 5 — slash attack + impact ("ZING")
  SLASH_START: 4150,
  IMPACT_AT: 4500,
  SLASH_END: 4700,
  // Phase 6 — split reveal of the discounted total
  SPLIT_END: 5150,
  REVEAL_SHARP_AT: 5600,
  // Phase 7 — glide to rest + settle sparkle
  SETTLE_START: 5600,
  SETTLE_END: 6500,
  SPARKLE_AT: 6300,
  // Total runtime (within the 5–8s target, hard max 10s)
  TOTAL: 6900,
  // Extra buffer before unmount/onDone so the last CSS frame is never cut off
  DONE_BUFFER: 150,
} as const;

export type Rect = { left: number; top: number; width: number; height: number };

export function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}
