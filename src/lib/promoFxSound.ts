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
 * A brief dissonant "tension sting" — two close, slightly clashing tones
 * that swell and cut off sharply, the way an anime holds a beat right
 * before the hero strikes.
 */
function playTensionChord(ctx: AudioContext, time: number) {
  [440, 466.16].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, time);
    filter.frequency.exponentialRampToValueAtTime(2600, time + 0.35);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(i === 0 ? 0.1 : 0.08, time + 0.28);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.4);
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.42);
  });
}

/** A fast, bright pitch-sweep whistle — the classic anime "swoosh" right as a blade cuts the air. */
function playSwooshWhistle(ctx: AudioContext, time: number) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(2600, time);
  osc.frequency.exponentialRampToValueAtTime(900, time + 0.16);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.16, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.2);
}

/** A firm, punchy "thunk" — like an ink stamp hitting paper — for the bonus discount-badge stamp beat. */
function playStampThunk(ctx: AudioContext, time: number) {
  const thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(190, time);
  thump.frequency.exponentialRampToValueAtTime(70, time + 0.1);
  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.0001, time);
  thumpGain.gain.exponentialRampToValueAtTime(0.24, time + 0.008);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
  thump.connect(thumpGain).connect(ctx.destination);
  thump.start(time);
  thump.stop(time + 0.16);

  // Tiny high "tak" click on top for a crisp stamp edge
  tone(ctx, time + 0.01, 1800, { type: "square", duration: 0.04, peak: 0.05 });
}

/**
 * The signature moment: a sharp metallic "ZING" at the exact instant the
 * blade connects. Layers a bright noise transient, a fast descending
 * metallic sweep (two slightly detuned oscillators for shimmer), a low
 * sub-thump for impact weight, and a long, slowly-decaying bell-like ring
 * tail — the resonant "hum" a blade leaves behind after an anime strike.
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

  // Long bell-like ring tail — the blade's resonance hanging in the air
  const ring = ctx.createOscillator();
  ring.type = "sine";
  ring.frequency.setValueAtTime(2637, time + 0.03);
  const ringGain = ctx.createGain();
  ringGain.gain.setValueAtTime(0.0001, time + 0.03);
  ringGain.gain.exponentialRampToValueAtTime(0.1, time + 0.05);
  ringGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.75);
  ring.connect(ringGain).connect(ctx.destination);
  ring.start(time + 0.03);
  ring.stop(time + 0.8);
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

  // 1. Promo activation — soft magical shimmer, charging
  tone(ctx, at(0), 220, { type: "sine", duration: 0.5, peak: 0.1, freqTo: 660 });
  noiseBurst(ctx, at(40), { duration: 0.45, filterType: "bandpass", freqFrom: 400, freqTo: 2200, q: 0.8, peak: 0.06 });
  // 2. Orb launches — energy whoosh (flight)
  noiseBurst(ctx, at(FX.FLIGHT_START), { duration: 0.5, filterType: "highpass", freqFrom: 600, freqTo: 3000, q: 0.7, peak: 0.12 });
  // 3. Hovering hum right as it arrives
  tone(ctx, at(FX.FLIGHT_END), 180, { type: "sine", duration: 0.3, peak: 0.06, freqTo: 200 });
  // 4. Orb -> dagger transformation thunk
  tone(ctx, at(FX.DAGGER_FORM_START), 90, { type: "sawtooth", duration: 0.1, peak: 0.16 });
  // 5. Katana glint chime + tension sting, held right before the strike
  tone(ctx, at(FX.GLINT_AT), 1400, { type: "triangle", duration: 0.12, peak: 0.1, freqTo: 2600 });
  playTensionChord(ctx, at(FX.TENSION_CHORD_AT));
  // Fast whistle-swoosh as the blade cuts the air
  playSwooshWhistle(ctx, at(FX.SPEEDLINES_AT + 10));

  // 6. THE ZING — signature sword slash + impact burst
  playZing(ctx, at(FX.IMPACT_AT));
  // 7. Slice separation shimmer
  tone(ctx, at(FX.IMPACT_AT + 80), 1568, { type: "sine", duration: 0.16, peak: 0.07 });
  tone(ctx, at(FX.IMPACT_AT + 140), 2093, { type: "sine", duration: 0.16, peak: 0.06 });

  // 8. Glitch-decode reveal shimmer
  [784, 988, 1245].forEach((freq, i) => {
    tone(ctx, at(FX.IMPACT_AT + 120 + i * 60), freq, { type: "sine", duration: 0.25, peak: 0.07 });
  });

  // 9. Success chime + sparkle finish as it settles
  playSuccessChime(ctx, at(FX.SETTLE_START));
  playSparkleFinish(ctx, at(FX.SPARKLE_AT));
  // Bonus: the discount badge stamps down
  playStampThunk(ctx, at(FX.STAMP_AT));

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
