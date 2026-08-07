import { FX } from "./promoFxTiming";

/**
 * Sound design for the promo success animation. All synthesized in-browser
 * with the Web Audio API — no audio files to fetch or bundle, matching the
 * pattern already used for the paddle-pop click sound (InteractionFX.tsx)
 * and the spin-wheel win chime (spin/[token]/page.tsx).
 *
 * Respects the site-wide sound preference (same localStorage key as the
 * rest of the app) so the mute toggle in the corner controls this too.
 */

const SOUND_KEY = "heidesPickleballHub.soundEnabled";

function isSoundOn() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

/** A short sine/triangle blip with an exponential decay envelope. */
function tone(
  ctx: AudioContext,
  time: number,
  freq: number,
  opts: { type?: OscillatorType; duration?: number; peak?: number; freqTo?: number } = {}
) {
  const { type = "sine", duration = 0.2, peak = 0.18, freqTo } = opts;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  if (freqTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), time + duration);
  }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + Math.min(0.03, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

/** Filtered white-noise burst — used for whooshes, engulf swells, thumps, and the zing transient. */
function noiseBurst(
  ctx: AudioContext,
  time: number,
  opts: {
    duration?: number;
    filterType?: BiquadFilterType;
    freqFrom?: number;
    freqTo?: number;
    q?: number;
    peak?: number;
  } = {}
) {
  const { duration = 0.3, filterType = "bandpass", freqFrom = 800, freqTo, q = 1, peak = 0.16 } = opts;
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freqFrom, time);
  if (freqTo !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), time + duration);
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + Math.min(0.04, duration * 0.2));
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(time);
  src.stop(time + duration + 0.02);
}

/**
 * The signature moment: a sharp metallic "ZING" at the exact instant the
 * blade connects. Layers a bright noise transient, a fast descending
 * metallic sweep (two slightly detuned oscillators for shimmer), and a
 * low sub-thump for impact weight.
 */
function playZing(ctx: AudioContext, time: number) {
  // Bright transient "crack"
  noiseBurst(ctx, time, { duration: 0.09, filterType: "bandpass", freqFrom: 4200, freqTo: 2200, q: 2.2, peak: 0.32 });

  // Metallic descending sweep, two detuned voices for shimmer
  [1, 1.012].forEach((detune, i) => {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(3400 * detune, time);
    osc.frequency.exponentialRampToValueAtTime(650 * detune, time + 0.22);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(i === 0 ? 0.22 : 0.14, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.26);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.28);
  });

  // Sub thump for impact weight
  const thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(150, time);
  thump.frequency.exponentialRampToValueAtTime(55, time + 0.18);
  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.0001, time);
  thumpGain.gain.exponentialRampToValueAtTime(0.26, time + 0.01);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  thump.connect(thumpGain).connect(ctx.destination);
  thump.start(time);
  thump.stop(time + 0.24);
}

/** Soft confirmation chime — a small major triad, gentler/shorter than the spin-wheel win chime. */
function playSuccessChime(ctx: AudioContext, time: number) {
  [659, 831, 988].forEach((freq, i) => {
    const t = time + i * 0.07;
    tone(ctx, t, freq, { type: "triangle", duration: 0.5, peak: 0.14 });
  });
}

/** Fast high tinkles for the final sparkle finish. */
function playSparkleFinish(ctx: AudioContext, time: number) {
  [2093, 2637, 3136, 3520].forEach((freq, i) => {
    const t = time + i * 0.06;
    tone(ctx, t, freq, { type: "sine", duration: 0.22, peak: 0.06 });
  });
}

/**
 * Schedules the full promo-success sound sequence (all 14 cues from the
 * spec, synthesized) against FX's timing. Returns a cleanup function that
 * closes the AudioContext — call it on unmount / when the animation ends.
 * No-ops entirely (and returns a no-op cleanup) if sound is muted or Web
 * Audio isn't available.
 */
export function playPromoFxSequence(): () => void {
  if (!isSoundOn()) return () => {};
  if (typeof window === "undefined") return () => {};
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return () => {};
  const ctx = new AC();
  const now = ctx.currentTime;
  const at = (ms: number) => now + ms / 1000;

  // 1. Promo activation — soft magical shimmer
  tone(ctx, at(0), 520, { type: "sine", duration: 0.3, peak: 0.14, freqTo: 880 });
  // 2. Liquid engulf
  noiseBurst(ctx, at(120), { duration: 0.4, filterType: "bandpass", freqFrom: 300, freqTo: 1400, q: 0.8, peak: 0.1 });
  // 3. Orb bounce/wobble
  tone(ctx, at(950), 660, { type: "triangle", duration: 0.14, peak: 0.16, freqTo: 520 });
  // 4. Energy whoosh (flight)
  noiseBurst(ctx, at(FX.FLIGHT_START), { duration: 0.55, filterType: "bandpass", freqFrom: 250, freqTo: 2400, q: 0.7, peak: 0.14 });
  // 6. Price lifting
  tone(ctx, at(FX.PRICE_LIFT_START), 420, { type: "sine", duration: 0.32, peak: 0.09, freqTo: 640 });
  // 5. Hovering energy hum
  tone(ctx, at(FX.FLIGHT_END), 180, { type: "sine", duration: 0.5, peak: 0.06, freqTo: 200 });
  // 7. Orb transformation / energy charging
  const chargeOsc = ctx.createOscillator();
  chargeOsc.type = "sawtooth";
  chargeOsc.frequency.setValueAtTime(120, at(FX.DAGGER_FORM_START));
  chargeOsc.frequency.exponentialRampToValueAtTime(560, at(FX.DAGGER_PAUSE_END));
  const chargeFilter = ctx.createBiquadFilter();
  chargeFilter.type = "lowpass";
  chargeFilter.frequency.setValueAtTime(400, at(FX.DAGGER_FORM_START));
  chargeFilter.frequency.exponentialRampToValueAtTime(2400, at(FX.DAGGER_PAUSE_END));
  const chargeGain = ctx.createGain();
  chargeGain.gain.setValueAtTime(0.0001, at(FX.DAGGER_FORM_START));
  chargeGain.gain.exponentialRampToValueAtTime(0.09, at(FX.DAGGER_FORM_START + 200));
  chargeGain.gain.exponentialRampToValueAtTime(0.14, at(FX.DAGGER_PAUSE_END - 60));
  chargeGain.gain.exponentialRampToValueAtTime(0.0001, at(FX.DAGGER_PAUSE_END + 40));
  chargeOsc.connect(chargeFilter).connect(chargeGain).connect(ctx.destination);
  chargeOsc.start(at(FX.DAGGER_FORM_START));
  chargeOsc.stop(at(FX.DAGGER_PAUSE_END + 60));
  // Small anticipation tick right before the strike
  tone(ctx, at(FX.SLASH_START), 1200, { type: "square", duration: 0.05, peak: 0.05 });

  // 8/9. THE ZING — signature sword slash + impact burst
  playZing(ctx, at(FX.IMPACT_AT));
  // 10. Slice separation shimmer
  tone(ctx, at(FX.IMPACT_AT + 160), 1568, { type: "sine", duration: 0.18, peak: 0.07 });
  tone(ctx, at(FX.IMPACT_AT + 230), 2093, { type: "sine", duration: 0.18, peak: 0.06 });

  // 11. Magical reveal
  [784, 988, 1245].forEach((freq, i) => {
    tone(ctx, at(FX.REVEAL_SHARP_AT - 300 + i * 90), freq, { type: "sine", duration: 0.3, peak: 0.08 });
  });

  // 12. Success chime
  playSuccessChime(ctx, at(FX.SPARKLE_AT - 300));
  // 13. Sparkle finish
  playSparkleFinish(ctx, at(FX.SPARKLE_AT));

  const closeAt = FX.TOTAL + 300;
  const timer = window.setTimeout(() => {
    try {
      ctx.close();
    } catch {
      /* ignore */
    }
  }, closeAt);

  return () => {
    window.clearTimeout(timer);
    try {
      ctx.close();
    } catch {
      /* ignore */
    }
  };
}
