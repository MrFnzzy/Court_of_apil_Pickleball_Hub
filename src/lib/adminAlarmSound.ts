/**
 * Cheerful "new booking" notification cue for the admin dashboard.
 *
 * Synthesized in-browser with the Web Audio API (same approach as
 * promoFxSound.ts) — no audio file to fetch or bundle. Unlike the
 * customer-facing sound effects, this does NOT respect the site's
 * "soundEnabled" mute flag: it's a work tool for staff, not a promo
 * effect for visitors, and it has its own mute switch (see
 * isAlarmMuted / setAlarmMuted below, wired up in the admin header).
 *
 * The cue is a soft "paddle tap" (a short woody thump, like a paddle
 * meeting a ball) followed by a catchy "ding-ding-dong" bell chime —
 * two matching high notes then a lower one, doorbell-style. It's built
 * to be noticeable but pleasant — nothing here hits full gain or uses a
 * harsh waveform — and it still repeats so it can't be missed even if
 * the admin has stepped away from the desk. Call startRepeatingAlarm()
 * to begin; it returns a stop() function so the caller can cut it off
 * early (e.g. the moment the admin opens the notification bell, or the
 * pending count drops back to zero).
 *
 * IMPORTANT — browser autoplay policy: Chrome/Safari/Firefox all refuse
 * to play ANY audio (including Web Audio) on a page until the person
 * has interacted with that page at least once (a click, tap, or
 * keypress). Since new bookings arrive via a background poll — not a
 * click — the very first cue after a fresh page load can be silently
 * blocked even though this code runs without error. Call unlockAudio()
 * from a real click handler (see the "Test alarm sound" button in the
 * admin header) to prime the AudioContext ahead of time so later
 * automatic cues aren't silently swallowed.
 *
 * A separate entry point, playPushChime(), plays this same cue (once,
 * respecting the mute flag) when the service worker relays a real push
 * notification while this tab is open — see the comment on that
 * function for why that hand-off exists.
 */

const MUTE_KEY = "heidesPickleballHub.adminAlarmMuted";

export function isAlarmMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setAlarmMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "on" : "off");
  } catch {
    // ignore
  }
}

let sharedCtx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctor();
  }
  if (sharedCtx.state === "suspended") {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

/**
 * Must be called synchronously inside a real user gesture (onClick,
 * onTouchStart, etc). Creates/resumes the AudioContext, which "unlocks"
 * that browser tab to play audio automatically later, without the admin
 * actually hearing anything at unlock time. Safe to call more than once.
 */
export function unlockAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  unlocked = true;
}

/** Whether unlockAudio() has run in this tab yet — lets the UI show a
 * "tap to enable sound" hint only when it's actually still needed. */
export function isAudioUnlocked(): boolean {
  return unlocked;
}

/** A soft "paddle tap" — a quick, woody thump (a low sine burst) plus a
 * touch of filtered noise for the "tock" of contact, like a paddle
 * gently meeting a ball. Kept well under full gain and over almost
 * instantly, so it reads as a friendly tap-tap rather than a bang. */
function playPaddleTap(ctx: AudioContext, startTime: number) {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.5, startTime);
  master.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(210, startTime);
  osc.frequency.exponentialRampToValueAtTime(130, startTime + 0.09);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.0001, startTime);
  oscGain.gain.exponentialRampToValueAtTime(0.7, startTime + 0.008);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.12);
  osc.connect(oscGain).connect(master);
  osc.start(startTime);
  osc.stop(startTime + 0.13);

  // Short burst of filtered noise for the "tock" of paddle-on-ball contact.
  const bufferSize = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1800;
  filter.Q.value = 1.1;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.35, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.045);
  noise.connect(filter).connect(noiseGain).connect(master);
  noise.start(startTime);
  noise.stop(startTime + 0.05);
}

/** A classic "ding-ding-dong" doorbell-style chime — two quick matching
 * high notes followed by a lower one, using a bell-like timbre (a
 * fundamental tone plus a quiet, slightly-detuned overtone, the way a
 * real bell or doorbell chime isn't a pure single frequency) with a soft
 * attack and a long, natural-sounding decay so each note actually rings
 * out rather than cutting off abruptly. Short, catchy, and instantly
 * recognizable as "someone's at the door" — here, "someone booked a
 * court". */
function playDingDingDongChime(ctx: AudioContext, startTime: number) {
  // A5, A5, E5 — same "ding, ding" note twice, then a "dong" a fourth
  // below.
  const notes = [880, 880, 659.25];
  const noteSpacing = 0.3;
  const decay = 0.55;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.55, startTime);
  master.connect(ctx.destination);

  notes.forEach((freq, i) => {
    const t = startTime + i * noteSpacing;

    const fundamental = ctx.createOscillator();
    fundamental.type = "sine";
    fundamental.frequency.setValueAtTime(freq, t);
    const fundamentalGain = ctx.createGain();
    fundamentalGain.gain.setValueAtTime(0.0001, t);
    fundamentalGain.gain.exponentialRampToValueAtTime(0.9, t + 0.012);
    fundamentalGain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    fundamental.connect(fundamentalGain).connect(master);
    fundamental.start(t);
    fundamental.stop(t + decay + 0.02);

    // A quiet, slightly inharmonic overtone is what makes a chime sound
    // like an actual bell instead of a flat electronic beep.
    const overtone = ctx.createOscillator();
    overtone.type = "sine";
    overtone.frequency.setValueAtTime(freq * 2.4, t);
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.0001, t);
    overtoneGain.gain.exponentialRampToValueAtTime(0.18, t + 0.012);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.6);
    overtone.connect(overtoneGain).connect(master);
    overtone.start(t);
    overtone.stop(t + decay + 0.02);
  });
}

/** The full cue: a paddle tap, then (once it settles) the ding-ding-dong
 * chime. */
function playCheerfulCue(ctx: AudioContext, startTime: number) {
  playPaddleTap(ctx, startTime);
  playDingDingDongChime(ctx, startTime + 0.16);
}

/**
 * Starts the cue, repeating up to `times` rounds (default 100) a couple
 * of seconds apart — each a paddle tap + ding-ding-dong chime. Returns a
 * stop() function to cancel any rounds that haven't played yet.
 * Automatically stops after `times` plays. Does nothing (and returns a
 * no-op stop) if muted or Web Audio isn't available.
 */
export function startRepeatingAlarm(times = 100): { stop: () => void } {
  if (isAlarmMuted()) return { stop: () => {} };
  const ctx = getCtx();
  if (!ctx) return { stop: () => {} };

  let stopped = false;
  const roundInterval = 2.2; // seconds between rounds — leaves room for the chime to ring out

  // Schedule a first round immediately so the cue starts without delay,
  // then keep topping up on a timer so we don't schedule 100 rounds
  // at once (and so stop() actually prevents future rounds from firing).
  let played = 0;
  function scheduleNext() {
    if (stopped || played >= times) return;
    const ctxNow = getCtx();
    if (!ctxNow) return;
    playCheerfulCue(ctxNow, ctxNow.currentTime);
    played += 1;
    if (played < times) {
      timer = window.setTimeout(scheduleNext, roundInterval * 1000);
    }
  }
  let timer = window.setTimeout(scheduleNext, 0);

  return {
    stop: () => {
      stopped = true;
      window.clearTimeout(timer);
    },
  };
}

/** Plays a single round (paddle tap + chime) immediately, ignoring the
 * mute flag — used by the "Test alarm sound" button so the admin can
 * always check what it sounds like (and, as a side effect, this click
 * also unlocks audio for this tab per the autoplay-policy note above). */
export function playTestAlarm() {
  unlockAudio();
  const ctx = getCtx();
  if (!ctx) return;
  playCheerfulCue(ctx, ctx.currentTime);
}

/**
 * Plays a single round (paddle tap + chime), respecting the mute flag —
 * used when a real Web Push notification arrives (see sw.js) while this
 * tab is open. The Web Notifications API has no way to attach a custom
 * sound file to the OS-level notification itself (every major browser
 * ignores anything but its own default alert tone there), so the
 * service worker posts a message to any open admin tab and this is how
 * that tab plays our actual branded cue instead of just the phone's
 * generic ping. Does nothing if muted, if Web Audio isn't available, or
 * if audio hasn't been unlocked yet in this tab (see unlockAudio) — same
 * constraints as the polling-driven alarm above.
 */
export function playPushChime() {
  if (isAlarmMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  playCheerfulCue(ctx, ctx.currentTime);
}
